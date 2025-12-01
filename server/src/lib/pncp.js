// Cópia das funções do PNCP para o backend
// Reutiliza a mesma lógica do frontend

const PNCP_BASE_URL = 'https://pncp.gov.br/api/consulta'

/**
 * Formata data para formato AAAAMMDD
 */
function formatarDataParaPNCP(data) {
  if (!data) return ''
  
  // Se já for string no formato AAAAMMDD, retornar direto
  if (typeof data === 'string' && /^\d{8}$/.test(data)) {
    return data
  }
  
  // Se for Date, formatar
  if (data instanceof Date) {
    const year = data.getFullYear()
    const month = String(data.getMonth() + 1).padStart(2, '0')
    const day = String(data.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
  }
  
  // Tentar converter string para Date
  try {
    const date = new Date(data)
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }
  } catch (e) {
    // Ignorar erro
  }
  
  // Se chegou aqui, retornar string vazia (não lançar erro)
  console.warn(`⚠️ [PNCP] Não foi possível formatar data: ${data}`)
  return ''
}

/**
 * Busca contratações por data de publicação
 */
/**
 * Busca TODAS as contratações por data, paginando automaticamente
 * A API do PNCP aceita apenas 50 itens por página
 */
export async function buscarContratacoesPorData(params) {
  const {
    dataInicial,
    dataFinal,
    codigoModalidadeContratacao,
    pagina = 1,
    tamanhoPagina = 50, // API aceita apenas 50 por página
  } = params || {}

  // Validar datas
  const dataInicialStr = formatarDataParaPNCP(dataInicial)
  const dataFinalStr = formatarDataParaPNCP(dataFinal)

  if (!dataInicialStr || !dataFinalStr) {
    throw new Error('Datas inicial e final são obrigatórias')
  }

  // Se tamanhoPagina > 50, forçar para 50 (limite da API)
  const tamanhoPaginaValido = Math.min(tamanhoPagina, 50)

  const queryParams = new URLSearchParams({
    dataInicial: dataInicialStr,
    dataFinal: dataFinalStr,
    pagina: pagina.toString(),
    tamanhoPagina: tamanhoPaginaValido.toString(),
  })

  // Só adicionar modalidade se for válida (1-13)
  if (codigoModalidadeContratacao) {
    const modalidade = parseInt(codigoModalidadeContratacao)
    if (modalidade >= 1 && modalidade <= 13) {
      queryParams.append('codigoModalidadeContratacao', modalidade.toString())
    }
  }

  const url = `${PNCP_BASE_URL}/v1/contratacoes/publicacao?${queryParams}`
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      // Tentar ler o corpo da resposta para ver o erro detalhado
      let errorBody = ''
      try {
        errorBody = await response.text()
        console.error(`❌ [PNCP] Erro HTTP ${response.status}:`, errorBody.substring(0, 500))
      } catch (e) {
        console.error(`❌ [PNCP] Erro HTTP ${response.status}: Não foi possível ler o corpo da resposta`)
      }
      throw new Error(`HTTP ${response.status}: ${errorBody.substring(0, 200) || response.statusText}`)
    }

    const text = await response.text()
    if (!text || !text.trim()) {
      console.warn('⚠️ [PNCP] Resposta vazia da API')
      return { data: [], totalRegistros: 0, totalPaginas: 0 }
    }

    let data
    try {
      data = JSON.parse(text)
    } catch (parseError) {
      console.error('❌ [PNCP] Erro ao parsear JSON:', parseError)
      console.error('📄 [PNCP] Resposta recebida:', text.substring(0, 500))
      throw new Error('Resposta da API não é um JSON válido')
    }

    return {
      data: data.data || [],
      totalRegistros: data.totalRegistros || 0,
      totalPaginas: data.totalPaginas || 1,
      numeroPagina: data.numeroPagina || pagina,
    }
  } catch (error) {
    console.error('❌ [PNCP] Erro ao buscar contratações:', error.message)
    throw error
  }
}

/**
 * Busca TODAS as contratações de uma data, paginando automaticamente
 * Retorna todas as licitações sem duplicatas (usando numeroControlePNCP como chave)
 */
export async function buscarTodasContratacoesPorData(params) {
  const {
    dataInicial,
    dataFinal,
    codigoModalidadeContratacao,
  } = params || {}

  console.log(`🔍 [PNCP] Buscando TODAS as contratações de ${dataInicial} a ${dataFinal}${codigoModalidadeContratacao ? ` (modalidade ${codigoModalidadeContratacao})` : ''}`)

  const todasLicitacoes = new Map() // Usar Map para evitar duplicatas
  let paginaAtual = 1
  let totalPaginas = 1
  let continuar = true

  while (continuar) {
    try {
      const resultado = await buscarContratacoesPorData({
        dataInicial,
        dataFinal,
        codigoModalidadeContratacao,
        pagina: paginaAtual,
        tamanhoPagina: 50, // API aceita apenas 50
      })

      if (resultado.data && resultado.data.length > 0) {
        // Adicionar ao Map usando numeroControlePNCP como chave (evita duplicatas)
        resultado.data.forEach(lic => {
          if (lic.numeroControlePNCP) {
            todasLicitacoes.set(lic.numeroControlePNCP, lic)
          }
        })

        console.log(`✅ [PNCP] Página ${paginaAtual}/${resultado.totalPaginas}: ${resultado.data.length} licitações encontradas (total único: ${todasLicitacoes.size})`)
      }

      totalPaginas = resultado.totalPaginas || 1

      // Verificar se há mais páginas
      if (paginaAtual >= totalPaginas || resultado.data?.length === 0) {
        continuar = false
      } else {
        paginaAtual++
        // Delay entre páginas para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error(`❌ [PNCP] Erro ao buscar página ${paginaAtual}:`, error.message)
      continuar = false
    }
  }

  const licitacoesArray = Array.from(todasLicitacoes.values())
  console.log(`✅ [PNCP] Busca concluída: ${licitacoesArray.length} licitações únicas encontradas em ${paginaAtual} página(s)`)

  return {
    data: licitacoesArray,
    totalRegistros: licitacoesArray.length,
    totalPaginas: paginaAtual,
  }
}

/**
 * Busca uma URL e retorna os dados parseados
 */
async function buscarUrl(url, descricao) {
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      console.warn(`⚠️ [PNCP] Erro ao buscar ${descricao}: HTTP ${response.status}`)
      return null
    }

    const text = await response.text()
    if (!text || !text.trim()) {
      return null
    }

    const dados = JSON.parse(text)
    
    // A API pode retornar de várias formas
    if (Array.isArray(dados)) {
      return dados
    } else if (dados.data && Array.isArray(dados.data)) {
      return dados.data
    } else if (dados[descricao] && Array.isArray(dados[descricao])) {
      return dados[descricao]
    } else if (typeof dados === 'object') {
      return dados // Retornar objeto completo se não for array
    }
    
    return null
  } catch (error) {
    console.warn(`⚠️ [PNCP] Erro ao buscar ${descricao}:`, error.message)
    return null
  }
}

/**
 * Busca detalhes completos de uma contratação
 * Inclui: contratação, itens, documentos, resultados, histórico e imagens
 * Conforme documentação do PNCP (Manual de Integração)
 */
export async function buscarDetalhesContratacao(numeroControlePNCP) {
  if (!numeroControlePNCP) {
    throw new Error('Número de controle PNCP é obrigatório')
  }

  const numeroEncoded = encodeURIComponent(numeroControlePNCP)
  console.log(`🔍 [PNCP] Buscando detalhes completos para: ${numeroControlePNCP}`)

  // 1. Buscar dados básicos da contratação
  const urlContratacao = `${PNCP_BASE_URL}/v1/contratacoes/${numeroEncoded}`
  
  // 2. Buscar itens da contratação
  const urlItens = `${PNCP_BASE_URL}/v1/contratacoes/${numeroEncoded}/itens`
  
  // 3. Buscar documentos da contratação
  const urlDocs = `${PNCP_BASE_URL}/v1/contratacoes/${numeroEncoded}/documentos`
  
  // 4. Buscar histórico da contratação
  const urlHistorico = `${PNCP_BASE_URL}/v1/contratacoes/${numeroEncoded}/historico`

  // Buscar dados básicos em paralelo
  const [contratacao, itens, documentos, historico] = await Promise.allSettled([
    buscarUrl(urlContratacao, 'contratação'),
    buscarUrl(urlItens, 'itens'),
    buscarUrl(urlDocs, 'documentos'),
    buscarUrl(urlHistorico, 'histórico'),
  ])

  const dadosContratacao = contratacao.status === 'fulfilled' ? contratacao.value : null
  const dadosItens = itens.status === 'fulfilled' ? itens.value : []
  const dadosDocumentos = documentos.status === 'fulfilled' ? documentos.value : []
  const dadosHistorico = historico.status === 'fulfilled' ? historico.value : []

  // 5. Para cada item, buscar resultados e imagens
  const itensCompletos = []
  
  if (Array.isArray(dadosItens) && dadosItens.length > 0) {
    console.log(`📦 [PNCP] Buscando detalhes de ${dadosItens.length} itens...`)
    
    for (const item of dadosItens) {
      const itemId = item.numeroItem || item.id || item.numeroItemContratacao
      
      if (!itemId) {
        itensCompletos.push(item)
        continue
      }

      // Buscar resultados do item
      const urlResultados = `${PNCP_BASE_URL}/v1/contratacoes/${numeroEncoded}/itens/${itemId}/resultados`
      
      // Buscar imagens do item
      const urlImagens = `${PNCP_BASE_URL}/v1/contratacoes/${numeroEncoded}/itens/${itemId}/imagens`

      const [resultados, imagens] = await Promise.allSettled([
        buscarUrl(urlResultados, `resultados do item ${itemId}`),
        buscarUrl(urlImagens, `imagens do item ${itemId}`),
      ])

      const dadosResultados = resultados.status === 'fulfilled' ? resultados.value : []
      const dadosImagens = imagens.status === 'fulfilled' ? imagens.value : []

      // Adicionar resultados e imagens ao item
      itensCompletos.push({
        ...item,
        resultados: Array.isArray(dadosResultados) ? dadosResultados : [],
        imagens: Array.isArray(dadosImagens) ? dadosImagens : [],
      })

      // Delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  } else {
    itensCompletos.push(...(Array.isArray(dadosItens) ? dadosItens : []))
  }

  console.log(`✅ [PNCP] Detalhes obtidos:`, {
    contratacao: !!dadosContratacao,
    itens: itensCompletos.length,
    documentos: Array.isArray(dadosDocumentos) ? dadosDocumentos.length : 0,
    historico: Array.isArray(dadosHistorico) ? dadosHistorico.length : 0,
  })

  return {
    contratacao: dadosContratacao,
    itens: itensCompletos,
    documentos: Array.isArray(dadosDocumentos) ? dadosDocumentos : [],
    historico: Array.isArray(dadosHistorico) ? dadosHistorico : [],
  }
}

