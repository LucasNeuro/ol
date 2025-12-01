// Funções para sincronizar dados do PNCP com o Supabase
import { supabase } from './supabase'
import { buscarContratacoesPorData, formatarDataParaPNCP, buscarTodasPaginas, buscarDetalhesContratacao } from './pncp'

/**
 * Sincroniza licitações do PNCP para o Supabase
 */
export async function sincronizarLicitacoes(dataInicial, dataFinal, modalidade = null) {
  try {
    const params = {
      dataInicial: typeof dataInicial === 'string' ? dataInicial : formatarDataParaPNCP(dataInicial),
      dataFinal: typeof dataFinal === 'string' ? dataFinal : formatarDataParaPNCP(dataFinal),
      codigoModalidadeContratacao: modalidade || 0,
      pagina: 1,
      tamanhoPagina: 50,
    }

    // Buscar todas as páginas
    const licitacoes = await buscarTodasPaginas(buscarContratacoesPorData, params, 10) // Limitar a 10 páginas por vez

    let inseridas = 0
    let atualizadas = 0

    for (const licitacao of licitacoes) {
      // Verificar se já existe
      const { data: existente } = await supabase
        .from('licitacoes')
        .select('id, data_atualizacao')
        .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
        .single()

      const dadosLicitacao = {
        numero_controle_pncp: licitacao.numeroControlePNCP,
        numero_compra: licitacao.numeroCompra,
        ano_compra: licitacao.anoCompra,
        processo: licitacao.processo,
        objeto_compra: licitacao.objetoCompra,
        informacao_complementar: licitacao.informacaoComplementar,
        modalidade_id: licitacao.modalidadeId,
        modalidade_nome: licitacao.modalidadeNome,
        modo_disputa_id: licitacao.modoDisputaId,
        modo_disputa_nome: licitacao.modoDisputaNome,
        situacao_id: licitacao.situacaoCompraId,
        situacao_nome: licitacao.situacaoCompraNome,
        valor_total_estimado: licitacao.valorTotalEstimado,
        valor_total_homologado: licitacao.valorTotalHomologado,
        data_abertura_proposta: licitacao.dataAberturaProposta,
        data_encerramento_proposta: licitacao.dataEncerramentoProposta,
        data_publicacao_pncp: licitacao.dataPublicacaoPncp,
        link_sistema_origem: licitacao.linkSistemaOrigem,
        orgao_cnpj: licitacao.orgaoEntidade?.cnpj,
        orgao_razao_social: licitacao.orgaoEntidade?.razaosocial,
        orgao_poder_id: licitacao.orgaoEntidade?.poderId,
        orgao_esfera_id: licitacao.orgaoEntidade?.esferaId,
        unidade_codigo: licitacao.unidadeOrgao?.codigoUnidade,
        unidade_nome: licitacao.unidadeOrgao?.nomeUnidade,
        municipio_codigo_ibge: licitacao.unidadeOrgao?.codigoIbge,
        municipio_nome: licitacao.unidadeOrgao?.municipioNome,
        uf_sigla: licitacao.unidadeOrgao?.ufSigla,
        uf_nome: licitacao.unidadeOrgao?.ufNome,
        sincronizado_em: new Date().toISOString(),
      }

      if (existente) {
        // Atualizar
        const { error } = await supabase
          .from('licitacoes')
          .update(dadosLicitacao)
          .eq('id', existente.id)

        if (!error) atualizadas++
      } else {
        // Inserir
        const { error } = await supabase
          .from('licitacoes')
          .insert(dadosLicitacao)

        if (!error) inseridas++
      }
    }

    return {
      sucesso: true,
      inseridas,
      atualizadas,
      total: licitacoes.length,
    }
  } catch (error) {
    console.error('Erro ao sincronizar licitações:', error)
    return {
      sucesso: false,
      erro: error.message,
    }
  }
}

/**
 * Sincroniza licitações do dia atual
 */
export async function sincronizarLicitacoesHoje() {
  const hoje = new Date()
  return await sincronizarLicitacoes(hoje, hoje)
}

/**
 * Sincroniza licitações dos últimos N dias
 */
export async function sincronizarLicitacoesRecentes(dias = 7) {
  const hoje = new Date()
  const dataInicial = new Date(hoje)
  dataInicial.setDate(hoje.getDate() - dias)
  
  return await sincronizarLicitacoes(dataInicial, hoje)
}

/**
 * Salva uma licitação COMPLETA no banco (com itens e documentos incluindo links)
 * Esta função busca TODOS os dados da API PNCP e salva na tabela
 */
export async function salvarLicitacaoCompleta(licitacaoBasica, userId = null) {
  if (!supabase || !licitacaoBasica?.numeroControlePNCP) {
    console.error('❌ [Salvar Completa] Dados inválidos')
    return null
  }

  try {
    console.log(`💾 [Salvar Completa] ===== INICIANDO SALVAMENTO =====`)
    console.log(`💾 [Salvar Completa] Número de controle: ${licitacaoBasica.numeroControlePNCP}`)
    console.log(`💾 [Salvar Completa] User ID: ${userId}`)
    console.log(`💾 [Salvar Completa] Supabase configurado: ${!!supabase}`)
    
    if (!supabase) {
      console.error('❌ [Salvar Completa] Supabase não está configurado!')
      return null
    }
    
    // 1. Buscar detalhes completos da API (itens e documentos com links)
    console.log(`📡 [Salvar Completa] Buscando detalhes da API...`)
    let detalhes = null
    try {
      detalhes = await buscarDetalhesContratacao(licitacaoBasica.numeroControlePNCP)
      console.log(`✅ [Salvar Completa] Detalhes obtidos:`, {
        itens: detalhes?.itens?.length || 0,
        documentos: detalhes?.documentos?.length || 0,
      })
    } catch (err) {
      console.error(`❌ [Salvar Completa] Erro ao buscar detalhes:`, err)
      // Salvar apenas os dados básicos
      return await salvarLicitacaoBasica(licitacaoBasica, userId)
    }
    
    if (!detalhes) {
      console.warn(`⚠️ [Salvar Completa] Nenhum detalhe retornado da API`)
      // Salvar apenas os dados básicos
      return await salvarLicitacaoBasica(licitacaoBasica, userId)
    }
    
    // Usar dados básicos + detalhes (detalhes não tem contratacao, só itens e documentos)
    const licitacao = { ...licitacaoBasica }
    const itens = detalhes.itens || []
    const documentos = detalhes.documentos || []
    
    console.log(`✅ [Salvar Completa] Dados obtidos: ${itens.length} itens, ${documentos.length} documentos`)
    
    // 2. Salvar licitação principal
    console.log(`💾 [Salvar Completa] Verificando se licitação já existe...`)
    const { data: existente, error: errorExistente } = await supabase
      .from('licitacoes')
      .select('id')
      .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
      .maybeSingle()
    
    if (errorExistente) {
      console.error('❌ [Salvar Completa] Erro ao verificar existente:', errorExistente)
      console.error('❌ [Salvar Completa] Código:', errorExistente.code)
      console.error('❌ [Salvar Completa] Mensagem:', errorExistente.message)
      console.error('❌ [Salvar Completa] Detalhes:', errorExistente.details)
      return null
    }
    
    console.log(`💾 [Salvar Completa] Licitação existente: ${!!existente}`)

    const dadosLicitacao = {
      numero_controle_pncp: licitacao.numeroControlePNCP,
      numero_compra: licitacao.numeroCompra,
      ano_compra: licitacao.anoCompra,
      processo: licitacao.processo,
      objeto_compra: licitacao.objetoCompra,
      informacao_complementar: licitacao.informacaoComplementar,
      modalidade_id: licitacao.codigoModalidadeContratacao,
      modalidade_nome: licitacao.modalidadeNome,
      modo_disputa_id: licitacao.codigoModoDisputa,
      modo_disputa_nome: licitacao.modoDisputaNome,
      situacao_id: licitacao.codigoSituacaoCompra,
      situacao_nome: licitacao.situacaoCompraNome,
      valor_total_estimado: licitacao.valorTotalEstimado,
      valor_total_homologado: licitacao.valorTotalHomologado,
      data_abertura_proposta: licitacao.dataAberturaProposta || licitacao.dataAberturaPropostaData,
      data_encerramento_proposta: licitacao.dataEncerramentoProposta || licitacao.dataEncerramentoPropostaData,
      data_publicacao_pncp: licitacao.dataPublicacaoPNCP || licitacao.dataPublicacao,
      orgao_cnpj: licitacao.orgaoEntidade?.cnpj,
      orgao_razao_social: licitacao.orgaoEntidade?.razaosocial,
      orgao_poder_id: licitacao.orgaoEntidade?.poderId,
      orgao_esfera_id: licitacao.orgaoEntidade?.esferaId,
      unidade_codigo: licitacao.unidadeOrgao?.codigoUnidade,
      unidade_nome: licitacao.unidadeOrgao?.nomeUnidade,
      municipio_codigo_ibge: licitacao.municipio?.codigoIBGE || licitacao.unidadeOrgao?.codigoIbge,
      municipio_nome: licitacao.municipio?.nomeIBGE || licitacao.unidadeOrgao?.municipioNome,
      uf_sigla: licitacao.municipio?.uf || licitacao.unidadeOrgao?.ufSigla,
      uf_nome: licitacao.unidadeOrgao?.ufNome,
      sincronizado_em: new Date().toISOString(),
    }

    let licitacaoId
    if (existente) {
      console.log(`💾 [Salvar Completa] Atualizando licitação existente (ID: ${existente.id})...`)
      const { data: atualizada, error: errorUpdate } = await supabase
        .from('licitacoes')
        .update(dadosLicitacao)
        .eq('id', existente.id)
        .select()
        .single()
      
      if (errorUpdate) {
        console.error('❌ [Salvar Completa] Erro ao atualizar:', errorUpdate)
        console.error('❌ [Salvar Completa] Código:', errorUpdate.code)
        console.error('❌ [Salvar Completa] Mensagem:', errorUpdate.message)
        return null
      }
      
      licitacaoId = atualizada?.id || existente.id
      console.log(`✅ [Salvar Completa] Licitação atualizada: ${licitacaoId}`)
    } else {
      console.log(`💾 [Salvar Completa] Inserindo nova licitação...`)
      const { data: nova, error: errorInsert } = await supabase
        .from('licitacoes')
        .insert(dadosLicitacao)
        .select()
        .single()
      
      if (errorInsert) {
        console.error('❌ [Salvar Completa] Erro ao inserir:', errorInsert)
        console.error('❌ [Salvar Completa] Código:', errorInsert.code)
        console.error('❌ [Salvar Completa] Mensagem:', errorInsert.message)
        console.error('❌ [Salvar Completa] Detalhes:', errorInsert.details)
        console.error('❌ [Salvar Completa] Hint:', errorInsert.hint)
        return null
      }
      
      licitacaoId = nova?.id
      console.log(`✅ [Salvar Completa] Licitação inserida: ${licitacaoId}`)
    }

    if (!licitacaoId) {
      console.error('❌ [Salvar Completa] Erro: licitacaoId é null após salvar')
      return null
    }

    // 3. Salvar itens (deletar existentes e inserir novos)
    if (itens.length > 0) {
      console.log(`💾 [Salvar Completa] Salvando ${itens.length} itens...`)
      
      // Deletar itens existentes
      const { error: errorDeleteItens } = await supabase
        .from('licitacao_itens')
        .delete()
        .eq('licitacao_id', licitacaoId)

      if (errorDeleteItens) {
        console.warn('⚠️ [Salvar Completa] Erro ao deletar itens antigos:', errorDeleteItens)
      } else {
        console.log(`✅ [Salvar Completa] Itens antigos deletados`)
      }

      // Inserir novos itens
      const itensParaSalvar = itens.map(item => ({
        licitacao_id: licitacaoId,
        numero_item: item.numeroItem || item.numero,
        descricao_item: item.descricaoItem || item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario || item.valorUnitarioEstimado,
        valor_total: item.valorTotal || item.valorTotalEstimado,
        unidade_fornecimento: item.unidadeFornecimento,
        classificacao_codigo: item.codigoClassificacao,
        classificacao_nome: item.nomeClassificacao,
        situacao_item_id: item.codigoSituacaoItem,
        situacao_item_nome: item.situacaoItemNome,
        categoria_item: item.categoriaItem,
      }))

      const { data: itensSalvos, error: errorItens } = await supabase
        .from('licitacao_itens')
        .insert(itensParaSalvar)
        .select()

      if (errorItens) {
        console.error('❌ [Salvar Completa] Erro ao salvar itens:', errorItens)
        console.error('❌ [Salvar Completa] Código:', errorItens.code)
        console.error('❌ [Salvar Completa] Mensagem:', errorItens.message)
      } else {
        console.log(`✅ [Salvar Completa] ${itensSalvos?.length || itensParaSalvar.length} itens salvos com sucesso`)
      }
    } else {
      console.log(`⚠️ [Salvar Completa] Nenhum item para salvar`)
    }

    // 4. Salvar documentos COM LINKS (deletar existentes e inserir novos)
    if (documentos.length > 0) {
      console.log(`💾 [Salvar Completa] Salvando ${documentos.length} documentos (com links)...`)
      
      // Deletar documentos existentes
      const { error: errorDeleteDocs } = await supabase
        .from('licitacao_documentos')
        .delete()
        .eq('licitacao_id', licitacaoId)

      if (errorDeleteDocs) {
        console.warn('⚠️ [Salvar Completa] Erro ao deletar documentos antigos:', errorDeleteDocs)
      } else {
        console.log(`✅ [Salvar Completa] Documentos antigos deletados`)
      }

      // Inserir novos documentos (INCLUINDO LINKS)
      const documentosParaSalvar = documentos.map(doc => {
        // Extrair URL do documento (pode vir em vários formatos)
        const urlDocumento = doc.urlDocumento || doc.url || doc.linkDocumento || doc.link || doc.urlArquivo || null
        
        return {
          licitacao_id: licitacaoId,
          tipo_documento_id: doc.codigoTipoDocumento || doc.tipoDocumentoId || doc.codigoTipo || null,
          tipo_documento_nome: doc.nomeTipoDocumento || doc.tipoDocumentoNome || doc.tipoDocumento?.nome || null,
          nome_arquivo: doc.nomeArquivo || doc.nomeDocumento || doc.nome || 'Documento sem nome',
          url_documento: urlDocumento, // LINKS DOS DOCUMENTOS - PRIORIDADE MÁXIMA
          tamanho_bytes: doc.tamanhoArquivo || doc.tamanhoBytes || doc.tamanho || null,
          data_publicacao: doc.dataPublicacao || doc.dataPublicacaoDocumento || null,
        }
      })

      console.log(`📎 [Salvar Completa] Preparando ${documentosParaSalvar.length} documentos com links:`)
      documentosParaSalvar.forEach((doc, idx) => {
        if (doc.url_documento) {
          console.log(`   ${idx + 1}. ${doc.nome_arquivo}: ${doc.url_documento.substring(0, 80)}...`)
        } else {
          console.warn(`   ⚠️ ${idx + 1}. ${doc.nome_arquivo}: SEM LINK`)
        }
      })

      const { data: docsSalvos, error: errorDocs } = await supabase
        .from('licitacao_documentos')
        .insert(documentosParaSalvar)
        .select()

      if (errorDocs) {
        console.error('❌ [Salvar Completa] Erro ao salvar documentos:', errorDocs)
        console.error('❌ [Salvar Completa] Código:', errorDocs.code)
        console.error('❌ [Salvar Completa] Mensagem:', errorDocs.message)
        console.error('❌ [Salvar Completa] Detalhes:', errorDocs.details)
      } else {
        console.log(`✅ [Salvar Completa] ${docsSalvos?.length || documentosParaSalvar.length} documentos salvos com sucesso (com links)`)
        // Log dos links salvos
        docsSalvos?.forEach((doc, idx) => {
          if (doc.url_documento) {
            console.log(`   ✅ ${idx + 1}. ${doc.nome_arquivo}: Link salvo`)
          }
        })
      }
    } else {
      console.log(`⚠️ [Salvar Completa] Nenhum documento para salvar`)
    }

    console.log(`✅ [Salvar Completa] Licitação salva com sucesso: ${licitacaoId}`)
    return licitacaoId
  } catch (error) {
    console.error('❌ [Salvar Completa] Erro:', error)
    return null
  }
}

/**
 * Salva apenas dados básicos da licitação (sem itens/documentos)
 */
async function salvarLicitacaoBasica(licitacao, userId = null) {
  if (!supabase || !licitacao?.numeroControlePNCP) return null

  try {
    const { data: existente } = await supabase
      .from('licitacoes')
      .select('id')
      .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
      .maybeSingle()

    const dadosLicitacao = {
      numero_controle_pncp: licitacao.numeroControlePNCP,
      numero_compra: licitacao.numeroCompra,
      ano_compra: licitacao.anoCompra,
      processo: licitacao.processo,
      objeto_compra: licitacao.objetoCompra,
      informacao_complementar: licitacao.informacaoComplementar,
      modalidade_id: licitacao.codigoModalidadeContratacao,
      modalidade_nome: licitacao.modalidadeNome,
      valor_total_estimado: licitacao.valorTotalEstimado,
      data_abertura_proposta: licitacao.dataAberturaProposta || licitacao.dataAberturaPropostaData,
      data_encerramento_proposta: licitacao.dataEncerramentoProposta || licitacao.dataEncerramentoPropostaData,
      data_publicacao_pncp: licitacao.dataPublicacaoPNCP || licitacao.dataPublicacao,
      orgao_cnpj: licitacao.orgaoEntidade?.cnpj,
      orgao_razao_social: licitacao.orgaoEntidade?.razaosocial,
      municipio_codigo_ibge: licitacao.municipio?.codigoIBGE || licitacao.unidadeOrgao?.codigoIbge,
      municipio_nome: licitacao.municipio?.nomeIBGE || licitacao.unidadeOrgao?.municipioNome,
      uf_sigla: licitacao.municipio?.uf || licitacao.unidadeOrgao?.ufSigla,
      sincronizado_em: new Date().toISOString(),
    }

    if (existente) {
      const { data } = await supabase
        .from('licitacoes')
        .update(dadosLicitacao)
        .eq('id', existente.id)
        .select()
        .single()
      return data?.id
    } else {
      const { data } = await supabase
        .from('licitacoes')
        .insert(dadosLicitacao)
        .select()
        .single()
      return data?.id
    }
  } catch (error) {
    console.error('❌ [Salvar Básica] Erro:', error)
    return null
  }
}

/**
 * Busca licitação completa do banco (com itens e documentos)
 */
/**
 * Busca licitações do banco por data (para o boletim diário)
 * @param {string} dataPublicacao - Data no formato AAAAMMDD (ex: "20251201")
 */
export async function buscarLicitacoesDoBanco(dataPublicacao) {
  if (!supabase || !dataPublicacao) return null

  try {
    console.log('📦 [Buscar Banco] Buscando licitações para data:', dataPublicacao)
    
    // Formatar data para busca no banco
    // O banco pode ter a data em formato DATE (YYYY-MM-DD) ou texto (AAAAMMDD)
    // Vamos tentar ambos os formatos
    
    // Formato 1: AAAAMMDD -> YYYY-MM-DD
    const dataFormatada1 = dataPublicacao.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
    // Formato 2: AAAAMMDD (texto)
    const dataFormatada2 = dataPublicacao

    // Tentar buscar com ambos os formatos
    let licitacoes = []
    
    // Primeiro tentar formato DATE
    const { data: licitacoes1, error: error1 } = await supabase
      .from('licitacoes')
      .select('*')
      .eq('data_publicacao_pncp', dataFormatada1)
      .order('valor_total_estimado', { ascending: false })

    if (!error1 && licitacoes1 && licitacoes1.length > 0) {
      licitacoes = licitacoes1
    } else {
      // Tentar formato texto
      const { data: licitacoes2, error: error2 } = await supabase
        .from('licitacoes')
        .select('*')
        .eq('data_publicacao_pncp', dataFormatada2)
        .order('valor_total_estimado', { ascending: false })

      if (!error2 && licitacoes2) {
        licitacoes = licitacoes2
      } else if (error2) {
        console.error('❌ [Buscar Banco] Erro:', error2)
        return null
      }
    }

    console.log(`✅ [Buscar Banco] ${licitacoes.length} licitações encontradas no banco`)

    // Converter para formato esperado pelo frontend
    return licitacoes.map(lic => ({
      numeroControlePNCP: lic.numero_controle_pncp,
      numeroCompra: lic.numero_compra,
      anoCompra: lic.ano_compra,
      processo: lic.processo,
      objetoCompra: lic.objeto_compra,
      informacaoComplementar: lic.informacao_complementar,
      codigoModalidadeContratacao: lic.modalidade_id,
      modalidadeNome: lic.modalidade_nome,
      valorTotalEstimado: lic.valor_total_estimado,
      dataAberturaProposta: lic.data_abertura_proposta,
      dataEncerramentoProposta: lic.data_encerramento_proposta,
      dataPublicacaoPNCP: lic.data_publicacao_pncp,
      orgaoEntidade: {
        cnpj: lic.orgao_cnpj,
        razaosocial: lic.orgao_razao_social,
      },
      municipio: {
        codigoIBGE: lic.municipio_codigo_ibge,
        nomeIBGE: lic.municipio_nome,
        uf: lic.uf_sigla,
      },
      unidadeOrgao: {
        municipioNome: lic.municipio_nome,
        ufSigla: lic.uf_sigla,
      },
    }))
  } catch (error) {
    console.error('❌ [Buscar Banco] Erro:', error)
    return null
  }
}

export async function buscarLicitacaoDoBanco(numeroControlePNCP) {
  if (!supabase || !numeroControlePNCP) return null

  try {
    // Buscar licitação principal
    const { data: licitacao } = await supabase
      .from('licitacoes')
      .select('*')
      .eq('numero_controle_pncp', numeroControlePNCP)
      .maybeSingle()

    if (!licitacao) return null

    // Buscar itens
    const { data: itens } = await supabase
      .from('licitacao_itens')
      .select('*')
      .eq('licitacao_id', licitacao.id)
      .order('numero_item')

    // Buscar documentos (COM LINKS)
    const { data: documentos } = await supabase
      .from('licitacao_documentos')
      .select('*')
      .eq('licitacao_id', licitacao.id)

    return {
      contratacao: licitacao,
      itens: itens || [],
      documentos: documentos || [],
    }
  } catch (error) {
    console.error('❌ [Buscar Banco] Erro:', error)
    return null
  }
}


