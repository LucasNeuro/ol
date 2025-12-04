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
        const nomeArquivo = doc.nomeArquivo || doc.nomeDocumento || doc.nome || 'Documento sem nome'
        
        // Extrair extensão do arquivo
        const extensao = nomeArquivo.includes('.') 
          ? nomeArquivo.split('.').pop().toLowerCase() 
          : null
        
        // Tentar determinar tipo MIME pela extensão
        const tiposMime = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'zip': 'application/zip',
          'rar': 'application/x-rar-compressed',
        }
        const tipoMime = extensao ? tiposMime[extensao] || 'application/octet-stream' : null
        
        return {
          licitacao_id: licitacaoId,
          tipo_documento_id: doc.codigoTipoDocumento || doc.tipoDocumentoId || doc.codigoTipo || null,
          tipo_documento_nome: doc.nomeTipoDocumento || doc.tipoDocumentoNome || doc.tipoDocumento?.nome || null,
          nome_arquivo: nomeArquivo,
          url_documento: urlDocumento, // LINKS DOS DOCUMENTOS - PRIORIDADE MÁXIMA
          url_original: urlDocumento, // Preservar URL original
          tamanho_bytes: doc.tamanhoArquivo || doc.tamanhoBytes || doc.tamanho || null,
          data_publicacao: doc.dataPublicacao || doc.dataPublicacaoDocumento || null,
          extensao: extensao,
          tipo_mime: tipoMime || doc.tipoMime || null,
          dados_complementares: {
            // Preservar todos os dados originais do documento
            dadosOriginais: doc,
          },
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

/**
 * Gera hash MD5 dos filtros para comparação rápida
 */
function gerarHashFiltros(filtros) {
  const crypto = window.crypto || window.msCrypto
  if (crypto && crypto.subtle) {
    // Usar Web Crypto API se disponível (mais seguro)
    const str = JSON.stringify(filtros)
    // Para simplificar, vamos usar uma função hash simples
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  }
  // Fallback: usar hash simples baseado em string
  const str = JSON.stringify(filtros)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

/**
 * Gera link direto do PNCP para uma contratação
 */
function gerarLinkPNCP(numeroControlePNCP) {
  if (!numeroControlePNCP) return null
  return `https://pncp.gov.br/app/contratacao/${encodeURIComponent(numeroControlePNCP)}`
}

/**
 * Salva um lote de licitações no banco e retorna os IDs salvos
 * Agora inclui TODOS os campos disponíveis da API
 */
async function salvarLoteLicitacoes(licitacoes) {
  if (!supabase || !licitacoes || licitacoes.length === 0) {
    return { ids: [], numeros: [] }
  }

  const idsSalvos = []
  const numerosSalvos = []

  try {
    // Processar em lotes menores para evitar timeout
    const tamanhoLote = 50
    for (let i = 0; i < licitacoes.length; i += tamanhoLote) {
      const lote = licitacoes.slice(i, i + tamanhoLote)
      
      for (const licitacao of lote) {
        try {
          // Verificar se já existe
          const { data: existente } = await supabase
            .from('licitacoes')
            .select('id')
            .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
            .maybeSingle()

          // Preparar dados_complementares com TODOS os campos extras
          const dadosComplementares = {
            // Campos que não estão na tabela principal
            tipoInstrumentoConvocatorioId: licitacao.tipoInstrumentoConvocatorioId,
            tipoInstrumentoConvocatorioNome: licitacao.tipoInstrumentoConvocatorioNome,
            sequencialCompra: licitacao.sequencialCompra,
            srp: licitacao.srp,
            amparoLegal: licitacao.amparoLegal ? {
              codigo: licitacao.amparoLegal.codigo,
              nome: licitacao.amparoLegal.nome,
              descricao: licitacao.amparoLegal.descricao,
            } : null,
            justificativaPresencial: licitacao.justificativaPresencial,
            usuarioNome: licitacao.usuarioNome,
            orgaoSubRogado: licitacao.orgaoSubRogado ? {
              cnpj: licitacao.orgaoSubRogado.cnpj,
              razaosocial: licitacao.orgaoSubRogado.razaosocial,
              poderId: licitacao.orgaoSubRogado.poderId,
              esferaId: licitacao.orgaoSubRogado.esferaId,
            } : null,
            unidadeSubRogada: licitacao.unidadeSubRogada ? {
              codigoUnidade: licitacao.unidadeSubRogada.codigoUnidade,
              nomeUnidade: licitacao.unidadeSubRogada.nomeUnidade,
              codigoIbge: licitacao.unidadeSubRogada.codigoIbge,
              municipioNome: licitacao.unidadeSubRogada.municipioNome,
              ufSigla: licitacao.unidadeSubRogada.ufSigla,
              ufNome: licitacao.unidadeSubRogada.ufNome,
            } : null,
            // Preservar dados originais completos da API
            dadosOriginais: licitacao,
          }

          const dadosLicitacao = {
            numero_controle_pncp: licitacao.numeroControlePNCP,
            numero_compra: licitacao.numeroCompra,
            ano_compra: licitacao.anoCompra,
            processo: licitacao.processo,
            objeto_compra: licitacao.objetoCompra,
            informacao_complementar: licitacao.informacaoComplementar,
            modalidade_id: licitacao.codigoModalidadeContratacao || licitacao.modalidadeId,
            modalidade_nome: licitacao.modalidadeNome,
            modo_disputa_id: licitacao.codigoModoDisputa || licitacao.modoDisputaId,
            modo_disputa_nome: licitacao.modoDisputaNome,
            situacao_id: licitacao.codigoSituacaoCompra || licitacao.situacaoCompraId,
            situacao_nome: licitacao.situacaoCompraNome,
            valor_total_estimado: licitacao.valorTotalEstimado,
            valor_total_homologado: licitacao.valorTotalHomologado,
            data_abertura_proposta: licitacao.dataAberturaProposta || licitacao.dataAberturaPropostaData,
            data_encerramento_proposta: licitacao.dataEncerramentoProposta || licitacao.dataEncerramentoPropostaData,
            data_publicacao_pncp: licitacao.dataPublicacaoPNCP || licitacao.dataPublicacao,
            link_sistema_origem: licitacao.linkSistemaOrigem,
            // NOVOS CAMPOS
            tipo_instrumento_convocatorio_id: licitacao.tipoInstrumentoConvocatorioId,
            tipo_instrumento_convocatorio_nome: licitacao.tipoInstrumentoConvocatorioNome,
            sequencial_compra: licitacao.sequencialCompra,
            srp: licitacao.srp || false,
            amparo_legal_codigo: licitacao.amparoLegal?.codigo,
            amparo_legal_nome: licitacao.amparoLegal?.nome,
            amparo_legal_descricao: licitacao.amparoLegal?.descricao,
            justificativa_presencial: licitacao.justificativaPresencial,
            usuario_nome: licitacao.usuarioNome,
            // Órgão subrogado
            orgao_subrogado_cnpj: licitacao.orgaoSubRogado?.cnpj,
            orgao_subrogado_razao_social: licitacao.orgaoSubRogado?.razaosocial,
            orgao_subrogado_poder_id: licitacao.orgaoSubRogado?.poderId,
            orgao_subrogado_poder_nome: licitacao.orgaoSubRogado?.poderNome,
            orgao_subrogado_esfera_id: licitacao.orgaoSubRogado?.esferaId,
            orgao_subrogado_esfera_nome: licitacao.orgaoSubRogado?.esferaNome,
            // Unidade subrogada
            unidade_subrogada_codigo: licitacao.unidadeSubRogada?.codigoUnidade,
            unidade_subrogada_nome: licitacao.unidadeSubRogada?.nomeUnidade,
            unidade_subrogada_municipio_codigo_ibge: licitacao.unidadeSubRogada?.codigoIbge,
            unidade_subrogada_municipio_nome: licitacao.unidadeSubRogada?.municipioNome,
            unidade_subrogada_uf_sigla: licitacao.unidadeSubRogada?.ufSigla,
            unidade_subrogada_uf_nome: licitacao.unidadeSubRogada?.ufNome,
            // Órgão principal
            orgao_cnpj: licitacao.orgaoEntidade?.cnpj,
            orgao_razao_social: licitacao.orgaoEntidade?.razaosocial,
            orgao_poder_id: licitacao.orgaoEntidade?.poderId,
            orgao_poder_nome: licitacao.orgaoEntidade?.poderNome,
            orgao_esfera_id: licitacao.orgaoEntidade?.esferaId,
            orgao_esfera_nome: licitacao.orgaoEntidade?.esferaNome,
            // Unidade principal
            unidade_codigo: licitacao.unidadeOrgao?.codigoUnidade,
            unidade_nome: licitacao.unidadeOrgao?.nomeUnidade,
            municipio_codigo_ibge: licitacao.municipio?.codigoIBGE || licitacao.unidadeOrgao?.codigoIbge,
            municipio_nome: licitacao.municipio?.nomeIBGE || licitacao.unidadeOrgao?.municipioNome,
            uf_sigla: licitacao.municipio?.uf || licitacao.unidadeOrgao?.ufSigla,
            uf_nome: licitacao.unidadeOrgao?.ufNome,
            // Link PNCP
            link_pncp: gerarLinkPNCP(licitacao.numeroControlePNCP),
            // Dados complementares (JSONB com tudo)
            dados_complementares: dadosComplementares,
            sincronizado_em: new Date().toISOString(),
            data_atualizacao: new Date().toISOString(),
          }

          let licitacaoId

          if (existente) {
            // Atualizar existente
            const { data: atualizada } = await supabase
              .from('licitacoes')
              .update(dadosLicitacao)
              .eq('id', existente.id)
              .select('id')
              .single()
            
            licitacaoId = atualizada?.id || existente.id
          } else {
            // Inserir nova
            const { data: nova } = await supabase
              .from('licitacoes')
              .insert(dadosLicitacao)
              .select('id')
              .single()
            
            licitacaoId = nova?.id
          }

          if (licitacaoId) {
            idsSalvos.push(licitacaoId)
            numerosSalvos.push(licitacao.numeroControlePNCP)
          }
        } catch (err) {
          console.warn(`⚠️ [Salvar Lote] Erro ao salvar licitação ${licitacao.numeroControlePNCP}:`, err.message)
          // Continuar com as próximas mesmo se uma falhar
        }
      }
    }

    return { ids: idsSalvos, numeros: numerosSalvos }
  } catch (error) {
    console.error('❌ [Salvar Lote] Erro ao salvar lote:', error)
    return { ids: idsSalvos, numeros: numerosSalvos }
  }
}

/**
 * Busca e salva licitações em lotes de 150, registrando a busca do usuário
 * Mostra progresso em tempo real e atualiza a tabela conforme os lotes são salvos
 * @param {Object} filtros - Filtros da busca (dataInicial, dataFinal, modalidade, etc)
 * @param {string} userId - ID do usuário
 * @param {Function} onProgress - Callback de progresso (loteAtual, totalLotes, totalEncontrado, licitacoesSalvas)
 * @returns {Promise<Object>} Resultado da busca com licitações e IDs salvos
 */
export async function buscarESalvarLicitacoesEmLotes(filtros, userId, onProgress = null) {
  if (!supabase || !userId) {
    throw new Error('Supabase ou userId não configurado')
  }

  const inicioBusca = Date.now()
  let todasLicitacoes = []
  let todasIdsSalvas = []
  let todasNumerosSalvos = []
  let buscaId = null

  try {
    // 1. Verificar se já existe busca similar em cache
    const filtrosHash = gerarHashFiltros(filtros)
    console.log('🔍 [Buscar e Salvar] Verificando cache...', { filtrosHash, userId })
    
    const { data: buscaExistente, error: errorCache } = await supabase
      .from('buscas_usuario')
      .select('*')
      .eq('usuario_id', userId)
      .eq('filtros_hash', filtrosHash)
      .eq('cache_valido', true)
      .gt('expira_em', new Date().toISOString())
      .order('data_busca', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (errorCache) {
      console.warn('⚠️ [Buscar e Salvar] Erro ao verificar cache:', errorCache)
    }

    // Se cache válido encontrado, retornar do banco
    if (buscaExistente && buscaExistente.licitacoes_ids && buscaExistente.licitacoes_ids.length > 0) {
      console.log('✅ [Buscar e Salvar] Cache encontrado! Retornando do banco...')
      console.log('📊 [Buscar e Salvar] Cache:', {
        buscaId: buscaExistente.id,
        totalEncontrado: buscaExistente.total_encontrado,
        dataBusca: buscaExistente.data_busca,
        expiraEm: buscaExistente.expira_em,
      })
      
      const { data: licitacoesDoBanco, error: errorLicitacoes } = await supabase
        .from('licitacoes')
        .select('*')
        .in('id', buscaExistente.licitacoes_ids)
        .order('data_publicacao_pncp', { ascending: false })

      if (errorLicitacoes) {
        console.error('❌ [Buscar e Salvar] Erro ao buscar licitações do cache:', errorLicitacoes)
      } else {
        console.log(`✅ [Buscar e Salvar] ${licitacoesDoBanco?.length || 0} licitações carregadas do cache`)
        
        // Notificar progresso com dados do cache
        if (onProgress) {
          onProgress({
            loteAtual: 1,
            totalLotes: 1,
            totalEncontrado: licitacoesDoBanco?.length || 0,
            licitacoesSalvas: licitacoesDoBanco || [],
            todasLicitacoes: licitacoesDoBanco || [],
            salvando: false,
            finalizado: true,
            origem: 'cache',
          })
        }

        return {
          licitacoes: licitacoesDoBanco || [],
          totalEncontrado: buscaExistente.total_encontrado || 0,
          idsSalvos: buscaExistente.licitacoes_ids || [],
          numerosSalvos: buscaExistente.licitacoes_numeros || [],
          origem: 'cache',
          buscaId: buscaExistente.id,
        }
      }
    }
    
    console.log('📡 [Buscar e Salvar] Cache não encontrado ou inválido. Buscando da API...')

    // 2. Buscar da API em lotes de 150
    console.log('📡 [Buscar e Salvar] Buscando da API em lotes de 150...')
    
    const { buscarContratacoesPorData } = await import('./pncp')
    
    const TAMANHO_LOTE = 50 // Lotes de 50 licitações (padrão da API, máximo confiável)
    let paginaAtual = 1
    let continuar = true
    let loteNumero = 0

    // Buscar em lotes de 50 para garantir compatibilidade com a API
    while (continuar) {
      loteNumero++
      console.log(`📦 [Buscar e Salvar] Processando lote ${loteNumero} (página ${paginaAtual})...`)

      try {
        const resultadoLote = await buscarContratacoesPorData({
          ...filtros,
          pagina: paginaAtual,
          tamanhoPagina: TAMANHO_LOTE,
        })

        if (!resultadoLote?.data || resultadoLote.data.length === 0) {
          console.log(`✅ [Buscar e Salvar] Nenhuma licitação encontrada no lote ${loteNumero}. Finalizando.`)
          continuar = false
          break
        }

        const licitacoesLote = resultadoLote.data
        console.log(`✅ [Buscar e Salvar] Lote ${loteNumero}: ${licitacoesLote.length} licitações encontradas`)

      // Salvar lote imediatamente
      console.log(`💾 [Buscar e Salvar] Salvando lote ${loteNumero} no banco...`)
      const { ids, numeros } = await salvarLoteLicitacoes(licitacoesLote)
      todasIdsSalvas.push(...ids)
      todasNumerosSalvos.push(...numeros)
      todasLicitacoes.push(...licitacoesLote)
      
      console.log(`✅ [Buscar e Salvar] Lote ${loteNumero} salvo: ${ids.length} licitações`)

        // Buscar licitações salvas do banco para retornar dados completos
        let licitacoesSalvas = []
        if (ids.length > 0) {
          const { data: licitacoesDoBanco } = await supabase
            .from('licitacoes')
            .select('*')
            .in('id', ids)
            .order('data_publicacao_pncp', { ascending: false })
          
          licitacoesSalvas = licitacoesDoBanco || []
        }

        // Chamar callback de progresso com as licitações salvas para atualizar a tabela
        if (onProgress) {
          onProgress({
            loteAtual: loteNumero,
            totalLotes: resultadoLote.totalPaginas || '?',
            totalEncontrado: todasLicitacoes.length,
            licitacoesSalvas: licitacoesSalvas, // Licitações deste lote para atualizar a tabela
            todasLicitacoes: todasLicitacoes, // Todas as licitações acumuladas
            salvando: true,
            finalizado: false,
          })
        }

        // Verificar se há mais páginas
        const totalPaginas = resultadoLote.totalPaginas || 1
        if (paginaAtual >= totalPaginas || licitacoesLote.length < TAMANHO_LOTE) {
          continuar = false
          console.log(`✅ [Buscar e Salvar] Todas as páginas processadas. Total: ${todasLicitacoes.length} licitações`)
        } else {
          paginaAtual++
          // Pequeno delay entre lotes para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        console.error(`❌ [Buscar e Salvar] Erro ao buscar lote ${loteNumero}:`, error)
        
        // Se for erro 400, pode ser problema com parâmetros ou data inválida
        if (error.message?.includes('400') || error.message?.includes('Bad Request')) {
          console.warn('⚠️ [Buscar e Salvar] Erro 400 - Verifique se a data é válida e se há licitações para esta data')
          
          // Verificar se a data é futura
          const dataInicial = filtros.dataInicial
          if (dataInicial) {
            const ano = parseInt(dataInicial.substring(0, 4))
            const mes = parseInt(dataInicial.substring(4, 6))
            const dia = parseInt(dataInicial.substring(6, 8))
            const dataBusca = new Date(ano, mes - 1, dia)
            const hoje = new Date()
            
            if (dataBusca > hoje) {
              console.warn(`⚠️ [Buscar e Salvar] Data ${dataInicial} é futura. Não há licitações para datas futuras.`)
            }
          }
        }
        
        // Se for primeiro lote e der erro, parar
        if (loteNumero === 1) {
          continuar = false
          throw error
        }
        
        // Se não for primeiro lote, continuar tentando (pode ser problema temporário)
        paginaAtual++
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Remover duplicatas finais
    const unicas = Array.from(
      new Map(todasLicitacoes.map(item => [item.numeroControlePNCP, item])).values()
    )

    const idsUnicos = Array.from(new Set(todasIdsSalvas))
    const numerosUnicos = Array.from(new Set(todasNumerosSalvos))

    // Buscar todas as licitações salvas do banco para retornar dados completos
    let licitacoesCompletas = []
    if (idsUnicos.length > 0) {
      const { data: todasDoBanco } = await supabase
        .from('licitacoes')
        .select('*')
        .in('id', idsUnicos)
        .order('data_publicacao_pncp', { ascending: false })
      
      licitacoesCompletas = todasDoBanco || []
    }

    // Chamar callback final
    if (onProgress) {
      onProgress({
        loteAtual: loteNumero,
        totalLotes: loteNumero,
        totalEncontrado: unicas.length,
        licitacoesSalvas: licitacoesCompletas,
        todasLicitacoes: unicas,
        salvando: false,
        finalizado: true,
        origem: 'api',
      })
    }
    
    console.log(`✅ [Buscar e Salvar] Busca concluída: ${unicas.length} licitações únicas encontradas`)

    // 3. Salvar busca do usuário em buscas_usuario
    const tempoBusca = Date.now() - inicioBusca
    const expiraEm = new Date()
    expiraEm.setDate(expiraEm.getDate() + 7) // Cache válido por 7 dias

    const dadosBusca = {
      usuario_id: userId,
      filtros: filtros,
      filtros_hash: filtrosHash,
      total_encontrado: unicas.length,
      licitacoes_ids: idsUnicos,
      licitacoes_numeros: numerosUnicos,
      tempo_busca_ms: tempoBusca,
      origem_busca: 'api',
      cache_valido: true,
      expira_em: expiraEm.toISOString(),
      sucesso: true,
    }

    const { data: buscaSalva, error: errorBusca } = await supabase
      .from('buscas_usuario')
      .insert(dadosBusca)
      .select()
      .single()

    if (errorBusca) {
      console.error('❌ [Buscar e Salvar] Erro ao salvar busca:', errorBusca)
    } else {
      buscaId = buscaSalva?.id
      console.log('✅ [Buscar e Salvar] Busca salva:', buscaId)
    }

    // 4. Log da ação do usuário
    try {
      await supabase
        .from('logs_usuario')
        .insert({
          usuario_id: userId,
          acao: 'buscar_boletim',
          entidade: 'busca',
          entidade_id: buscaId,
          dados_acao: {
            filtros,
            total_encontrado: unicas.length,
            tempo_ms: tempoBusca,
          },
        })
    } catch (err) {
      console.warn('⚠️ [Buscar e Salvar] Erro ao salvar log:', err)
    }

    return {
      licitacoes: licitacoesCompletas.length > 0 ? licitacoesCompletas : unicas,
      totalEncontrado: unicas.length,
      idsSalvos: idsUnicos,
      numerosSalvos: numerosUnicos,
      origem: 'api',
      buscaId,
      tempoBusca,
    }
  } catch (error) {
    console.error('❌ [Buscar e Salvar] Erro:', error)
    
    // Salvar busca com erro
    if (userId && supabase) {
      try {
        await supabase
          .from('buscas_usuario')
          .insert({
            usuario_id: userId,
            filtros: filtros,
            filtros_hash: gerarHashFiltros(filtros),
            total_encontrado: todasLicitacoes.length,
            licitacoes_ids: todasIdsSalvas,
            licitacoes_numeros: todasNumerosSalvos,
            tempo_busca_ms: Date.now() - inicioBusca,
            origem_busca: 'api',
            cache_valido: false,
            sucesso: false,
            erro_mensagem: error.message,
          })
      } catch (err) {
        console.error('❌ [Buscar e Salvar] Erro ao salvar busca com erro:', err)
      }
    }

    throw error
  }
}


