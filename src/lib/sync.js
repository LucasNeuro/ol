// Funções para sincronizar dados do PNCP com o Supabase
import { supabase } from './supabase'
import { buscarContratacoesPorData, formatarDataParaPNCP, buscarTodasPaginas, buscarDetalhesContratacao } from './pncp'

/**
 * Sincroniza licitações do PNCP para o Supabase (usa cliente global)
 */
export async function sincronizarLicitacoes(dataInicial, dataFinal, modalidade = null) {
  return sincronizarLicitacoesComCliente(supabase, dataInicial, dataFinal, modalidade)
}

/**
 * Sincroniza licitações do PNCP para o Supabase usando o cliente informado.
 * Útil para scripts Node (ex.: npm run sincronizar-licitacoes) com dotenv.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 */
export async function sincronizarLicitacoesComCliente(supabaseClient, dataInicial, dataFinal, modalidade = null) {
  if (!supabaseClient) {
    throw new Error('Cliente Supabase não informado')
  }
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
      const { data: existente } = await supabaseClient
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
        const { error } = await supabaseClient
          .from('licitacoes')
          .update(dadosLicitacao)
          .eq('id', existente.id)

        if (!error) atualizadas++
      } else {
        // Inserir
        const { error } = await supabaseClient
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
    return null
  }

  try {
    
    if (!supabase) {
      return null
    }
    
    // 1. Buscar detalhes completos da API (itens e documentos com links)
    let detalhes = null
    try {
      detalhes = await buscarDetalhesContratacao(licitacaoBasica.numeroControlePNCP)
    } catch (err) {
      // Salvar apenas os dados básicos
      return await salvarLicitacaoBasica(licitacaoBasica, userId)
    }
    
    if (!detalhes) {
      // Salvar apenas os dados básicos
      return await salvarLicitacaoBasica(licitacaoBasica, userId)
    }
    
    // Usar dados básicos + detalhes (detalhes não tem contratacao, só itens e documentos)
    const licitacao = { ...licitacaoBasica }
    const itens = detalhes.itens || []
    const documentos = detalhes.documentos || []
    
    
    // 2. Salvar licitação principal
    const { data: existente, error: errorExistente } = await supabase
      .from('licitacoes')
      .select('id')
      .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
      .maybeSingle()
    
    if (errorExistente) {
      return null
    }
    

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
      const { data: atualizada, error: errorUpdate } = await supabase
        .from('licitacoes')
        .update(dadosLicitacao)
        .eq('id', existente.id)
        .select()
        .single()
      
      if (errorUpdate) {
        return null
      }
      
      licitacaoId = atualizada?.id || existente.id
    } else {
      const { data: nova, error: errorInsert } = await supabase
        .from('licitacoes')
        .insert(dadosLicitacao)
        .select()
        .single()
      
      if (errorInsert) {
        return null
      }
      
      licitacaoId = nova?.id
    }

    if (!licitacaoId) {
      return null
    }

    // 3. Salvar itens (deletar existentes e inserir novos)
    if (itens.length > 0) {
      
      // Deletar itens existentes
      const { error: errorDeleteItens } = await supabase
        .from('licitacao_itens')
        .delete()
        .eq('licitacao_id', licitacaoId)

      if (errorDeleteItens) {
      } else {
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
      } else {
      }
    } else {
    }

    // 4. Salvar documentos COM LINKS (deletar existentes e inserir novos)
    if (documentos.length > 0) {
      
      // Deletar documentos existentes
      const { error: errorDeleteDocs } = await supabase
        .from('licitacao_documentos')
        .delete()
        .eq('licitacao_id', licitacaoId)

      if (errorDeleteDocs) {
      } else {
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

      documentosParaSalvar.forEach((doc, idx) => {
        if (doc.url_documento) {
        } else {
        }
      })

      const { data: docsSalvos, error: errorDocs } = await supabase
        .from('licitacao_documentos')
        .insert(documentosParaSalvar)
        .select()

      if (errorDocs) {
      } else {
        // Log dos links salvos
        docsSalvos?.forEach((doc, idx) => {
          if (doc.url_documento) {
          }
        })
      }
    } else {
    }

    return licitacaoId
  } catch (error) {
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
 * Salva um lote de licitações no banco e retorna os IDs salvos
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
            link_sistema_origem: licitacao.linkSistemaOrigem,
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
          // Continuar com as próximas mesmo se uma falhar
        }
      }
    }

    return { ids: idsSalvos, numeros: numerosSalvos }
  } catch (error) {
    return { ids: idsSalvos, numeros: numerosSalvos }
  }
}

/**
 * Busca e salva licitações em lotes, registrando a busca do usuário
 * @param {Object} filtros - Filtros da busca (dataInicial, dataFinal, modalidade, etc)
 * @param {string} userId - ID do usuário
 * @param {Function} onProgress - Callback de progresso (loteAtual, totalLotes, totalEncontrado)
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
    const { data: buscaExistente } = await supabase
      .from('buscas_usuario')
      .select('*')
      .eq('usuario_id', userId)
      .eq('filtros_hash', filtrosHash)
      .eq('cache_valido', true)
      .gt('expira_em', new Date().toISOString())
      .order('data_busca', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Se cache válido encontrado, retornar do banco
    if (buscaExistente && buscaExistente.licitacoes_ids && buscaExistente.licitacoes_ids.length > 0) {
      
      const { data: licitacoesDoBanco } = await supabase
        .from('licitacoes')
        .select('*')
        .in('id', buscaExistente.licitacoes_ids)
        .order('data_publicacao_pncp', { ascending: false })

      return {
        licitacoes: licitacoesDoBanco || [],
        totalEncontrado: buscaExistente.total_encontrado || 0,
        idsSalvos: buscaExistente.licitacoes_ids || [],
        numerosSalvos: buscaExistente.licitacoes_numeros || [],
        origem: 'cache',
        buscaId: buscaExistente.id,
      }
    }

    // 2. Buscar da API em lotes
    
    const { buscarContratacoesPorData } = await import('./pncp')
    
    // Buscar primeiro lote para mostrar rápido
    const primeiroLote = await buscarContratacoesPorData({
      ...filtros,
      pagina: 1,
      tamanhoPagina: 50,
      limiteInicial: 500, // Primeiro lote: 500 licitações
    })

    if (primeiroLote?.data && primeiroLote.data.length > 0) {
      todasLicitacoes.push(...primeiroLote.data)
      
      // Salvar primeiro lote
      const { ids, numeros } = await salvarLoteLicitacoes(primeiroLote.data)
      todasIdsSalvas.push(...ids)
      todasNumerosSalvos.push(...numeros)

      // Chamar callback de progresso
      if (onProgress) {
        onProgress({
          loteAtual: 1,
          totalLotes: '?',
          totalEncontrado: todasLicitacoes.length,
          salvando: true,
        })
      }

      // Buscar restante em background (sem limite)
      const buscaCompleta = await buscarContratacoesPorData({
        ...filtros,
        pagina: 1,
        tamanhoPagina: 50,
        // Sem limite - buscar tudo
      })

      if (buscaCompleta?.data && buscaCompleta.data.length > primeiroLote.data.length) {
        // Remover duplicatas
        const novas = buscaCompleta.data.filter(
          nova => !todasLicitacoes.some(antiga => antiga.numeroControlePNCP === nova.numeroControlePNCP)
        )

        if (novas.length > 0) {
          todasLicitacoes.push(...novas)
          
          // Salvar novas licitações
          const { ids, numeros } = await salvarLoteLicitacoes(novas)
          todasIdsSalvas.push(...ids)
          todasNumerosSalvos.push(...numeros)

          if (onProgress) {
            onProgress({
              loteAtual: 2,
              totalLotes: 'completo',
              totalEncontrado: todasLicitacoes.length,
              salvando: true,
            })
          }
        }
      }
    }

    // Remover duplicatas finais
    const unicas = Array.from(
      new Map(todasLicitacoes.map(item => [item.numeroControlePNCP, item])).values()
    )

    const idsUnicos = Array.from(new Set(todasIdsSalvas))
    const numerosUnicos = Array.from(new Set(todasNumerosSalvos))

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
    } else {
      buscaId = buscaSalva?.id
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
    }

    return {
      licitacoes: unicas,
      totalEncontrado: unicas.length,
      idsSalvos: idsUnicos,
      numerosSalvos: numerosUnicos,
      origem: 'api',
      buscaId,
      tempoBusca,
    }
  } catch (error) {
    
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
      }
    }

    throw error
  }
}


