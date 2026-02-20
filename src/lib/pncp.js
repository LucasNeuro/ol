// Integração DIRETA com API do PNCP
// A aplicação é uma "máscara" da API do PNCP com funcionalidades extras
const PNCP_BASE_URL = 'https://pncp.gov.br/api/consulta'

/**
 * Busca contratações por data de publicação
 * Chama DIRETAMENTE a API do PNCP
 */
export async function buscarContratacoesPorData(params) {
  const {
    dataInicial, // formato AAAAMMDD
    dataFinal,   // formato AAAAMMDD
    codigoModalidadeContratacao,
    codigoModoDisputa,
    uf,
    codigoMunicipioIbge,
    cnpj,
    codigoUnidadeAdministrativa,
    idUsuario,
    numeroControlePNCP, // Filtro opcional
    pagina = 1,
    tamanhoPagina = 50,
    limiteInicial = null // Se definido, retorna após buscar este número de licitações
  } = params || {}

  // Buscar DIRETAMENTE do PNCP (conforme manual da API)
  // IMPORTANTE: codigoModalidadeContratacao é OBRIGATÓRIO (valores 1-13)
  // Se for 0 ou não especificado, não podemos enviar 0
  // Solução: fazer buscas múltiplas para todas as modalidades (1-13)
  
  // Validar tamanho da página (máximo 500 segundo manual, mas usar 50 como padrão seguro)
  const tamanhoPaginaValido = Math.min(Math.max(1, tamanhoPagina || 50), 500)
  
  const queryParams = new URLSearchParams({
    dataInicial: dataInicial || '',
    dataFinal: dataFinal || '',
    pagina: pagina.toString(),
    tamanhoPagina: tamanhoPaginaValido.toString(),
  })

  // Verificar se modalidade é válida (1-13)
  const modalidade = codigoModalidadeContratacao ? parseInt(codigoModalidadeContratacao) : null
  const modalidadeValida = modalidade && modalidade >= 1 && modalidade <= 13
  
  if (modalidadeValida) {
    queryParams.append('codigoModalidadeContratacao', modalidade.toString())
  } else {
    // Se for 0 ou não especificado, fazer buscas para todas as modalidades (1-13)
    // Mas por enquanto, vamos tentar não enviar e ver se a API aceita
    // Se não aceitar, faremos buscas múltiplas
  }
  
  if (codigoModoDisputa) queryParams.append('codigoModoDisputa', codigoModoDisputa.toString())
  if (uf) queryParams.append('uf', uf)
  if (codigoMunicipioIbge) queryParams.append('codigoMunicipioIbge', codigoMunicipioIbge.toString())
  if (cnpj) queryParams.append('cnpj', cnpj.replace(/\D/g, ''))
  if (codigoUnidadeAdministrativa) queryParams.append('codigoUnidadeAdministrativa', codigoUnidadeAdministrativa)
  if (idUsuario) queryParams.append('idUsuario', idUsuario.toString())
  // Número de controle é apenas um filtro opcional - não limita a busca total
  if (numeroControlePNCP && numeroControlePNCP.trim()) {
    queryParams.append('numeroControlePNCP', numeroControlePNCP.trim())
  }

  // Se não tiver modalidade válida, tentar buscar apenas as modalidades mais comuns
  // Em vez de todas as 13, vamos tentar apenas algumas para evitar problemas
  if (!modalidadeValida) {
    
    // Modalidades mais comuns: 6 (Pregão Eletrônico), 8 (Dispensa), 4 (Concorrência Eletrônica)
    const modalidadesComuns = [6, 8, 4]
    const todasLicitacoes = []
    
    // Fazer buscas SEQUENCIAIS com paginação para cada modalidade
    for (const mod of modalidadesComuns) {
      let paginaAtual = 1
      let totalPaginas = 1
      let continuar = true
      
      const maxPaginasPorModalidade = 20 // Limitar a 20 páginas por modalidade (1000 licitações)
      while (continuar && paginaAtual <= maxPaginasPorModalidade) {
        const paramsComModalidade = new URLSearchParams(queryParams)
        paramsComModalidade.set('codigoModalidadeContratacao', mod.toString())
        paramsComModalidade.set('pagina', paginaAtual.toString())
        
        try {
          const url = `${PNCP_BASE_URL}/v1/contratacoes/publicacao?${paramsComModalidade}`
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            mode: 'cors',
          })
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            
            // Se for 400, pode ser problema com parâmetros ou data
            if (response.status === 400) {
              // Continuar com próxima modalidade
              continuar = false
              break
            }
            
            // Se for 429 (rate limit), aguardar mais
            if (response.status === 429) {
              await new Promise(resolve => setTimeout(resolve, 2000))
              continue
            }
            
            // Para outros erros, parar esta modalidade
            continuar = false
            break
          }
          
          if (response.ok) {
            const text = await response.text()
            
            if (text && text.trim()) {
              try {
                const data = JSON.parse(text)
                const count = data.data?.length || 0
                
                if (data.data && data.data.length > 0) {
                  todasLicitacoes.push(...data.data)
                  
                  // Se tiver limite inicial e já atingimos, parar
                  if (limiteInicial && todasLicitacoes.length >= limiteInicial) {
                    continuar = false
                    break
                  }
                }
                
                // Verificar se há mais páginas
                totalPaginas = data.totalPaginas || 1
                if (paginaAtual >= totalPaginas || data.data?.length === 0) {
                  continuar = false
                } else {
                  paginaAtual++
                }
              } catch (parseError) {
                continuar = false
              }
            } else {
              continuar = false
            }
          } else {
            const errorText = await response.text().catch(() => 'Erro desconhecido')
            
            // Se for CORS ou 429, parar e retornar o que temos
            if (response.status === 429 || response.status === 0) {
              continuar = false
              break
            } else {
              continuar = false
            }
          }
        } catch (error) {
          
          // Se for erro de CORS, parar
          if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
            continuar = false
            break
          } else {
            continuar = false
          }
        }
        
        // Delay entre requisições (500ms para ser mais rápido)
        if (continuar) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      
      // Delay entre modalidades
      if (mod !== modalidadesComuns[modalidadesComuns.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    
    // Remover duplicatas por numeroControlePNCP
    const unicas = Array.from(
      new Map(todasLicitacoes.map(item => [item.numeroControlePNCP, item])).values()
    )
    
    
    // Se não encontrou nada, retornar vazio mas com estrutura correta
    if (unicas.length === 0) {
    }
    
    return {
      data: unicas,
      totalRegistros: unicas.length,
      totalPaginas: 1,
      numeroPagina: 1,
      paginasRestantes: 0,
      empty: unicas.length === 0
    }
  }

  // Busca normal com modalidade específica
  // Se tiver limiteInicial, buscar apenas até esse limite para retornar rápido
  // MAS: se tiver numeroControlePNCP, não aplicar limite (precisa encontrar a específica)
  const todasLicitacoes = []
  let paginaAtual = pagina
  let totalPaginas = 1
  let continuar = true
  
  // Se tiver limite inicial E não tiver filtro de número de controle, calcular quantas páginas precisamos
  // Se tiver filtro de número de controle, buscar todas as páginas até encontrar
  const temFiltroNumeroControle = numeroControlePNCP && numeroControlePNCP.trim()
  const paginasParaLimite = limiteInicial && !temFiltroNumeroControle ? Math.ceil(limiteInicial / tamanhoPagina) : 50
  const maxPaginas = limiteInicial && !temFiltroNumeroControle ? Math.min(paginasParaLimite, 50) : 50
  
  while (continuar && paginaAtual <= maxPaginas) {
    const paramsPagina = new URLSearchParams(queryParams)
    paramsPagina.set('pagina', paginaAtual.toString())
    
    const url = `${PNCP_BASE_URL}/v1/contratacoes/publicacao?${paramsPagina}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      mode: 'cors',
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido')
      
      // Se for 400, pode ser problema com parâmetros ou data
      if (response.status === 400) {
        continuar = false
        break
      }
      
      // Se for 429, sugerir aguardar
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      
      continuar = false
      break
    }

    // Verificar se a resposta tem conteúdo antes de fazer JSON.parse
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      continuar = false
      break
    }

    const text = await response.text()
    if (!text || !text.trim()) {
      continuar = false
      break
    }

    let resultado
    try {
      resultado = JSON.parse(text)
    } catch (parseError) {
      continuar = false
      break
    }

    if (resultado.data && resultado.data.length > 0) {
      todasLicitacoes.push(...resultado.data)
      
      // Se tiver filtro de número de controle e encontramos, parar
      if (temFiltroNumeroControle) {
        const encontrada = todasLicitacoes.find(l => l.numeroControlePNCP === numeroControlePNCP)
        if (encontrada) {
          continuar = false
          break
        }
      }
      
      // Se tiver limite inicial e já atingimos, parar
      if (limiteInicial && !temFiltroNumeroControle && todasLicitacoes.length >= limiteInicial) {
        continuar = false
        break
      }
    }

    // Verificar se há mais páginas
    totalPaginas = resultado.totalPaginas || 1
    const totalRegistros = resultado.totalRegistros || 0
    
    
    if (paginaAtual >= totalPaginas || resultado.data?.length === 0) {
      continuar = false
    } else {
      paginaAtual++
      // Delay entre páginas para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  
  // Remover duplicatas
  const unicas = Array.from(
    new Map(todasLicitacoes.map(item => [item.numeroControlePNCP, item])).values()
  )
  
  return {
    data: unicas,
    totalRegistros: unicas.length,
    totalPaginas: 1,
    numeroPagina: 1,
    paginasRestantes: 0,
    empty: unicas.length === 0
  }
}

/**
 * Busca contratações com período de recebimento de propostas em aberto
 */
export async function buscarContratacoesEmAberto(params) {
  const {
    dataFinal,   // formato AAAAMMDD
    codigoModalidadeContratacao,
    uf,
    codigoMunicipioIbge,
    cnpj,
    codigoUnidadeAdministrativa,
    idUsuario,
    pagina = 1,
    tamanhoPagina = 50
  } = params

  const queryParams = new URLSearchParams({
    dataFinal,
    codigoModalidadeContratacao: codigoModalidadeContratacao?.toString() || '',
    pagina: pagina.toString(),
    tamanhoPagina: tamanhoPagina.toString(),
  })

  if (uf) queryParams.append('uf', uf)
  if (codigoMunicipioIbge) queryParams.append('codigoMunicipioIbge', codigoMunicipioIbge.toString())
  if (cnpj) queryParams.append('cnpj', cnpj)
  if (codigoUnidadeAdministrativa) queryParams.append('codigoUnidadeAdministrativa', codigoUnidadeAdministrativa)
  if (idUsuario) queryParams.append('idUsuario', idUsuario.toString())

  const response = await fetch(`${PNCP_BASE_URL}/v1/contratacoes/proposta?${queryParams}`)
  
  if (!response.ok) {
    throw new Error(`Erro ao buscar contratações em aberto: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Formata data para formato AAAAMMDD
 */
export function formatarDataParaPNCP(data) {
  if (!data) return ''
  const date = new Date(data)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Busca todas as páginas de uma consulta
 */
export async function buscarTodasPaginas(funcaoBusca, params, maxPaginas = 100) {
  const resultados = []
  let pagina = 1
  let totalPaginas = 1

  do {
    const resultado = await funcaoBusca({ ...params, pagina })
    
    if (resultado.data && resultado.data.length > 0) {
      resultados.push(...resultado.data)
    }

    totalPaginas = resultado.totalPaginas || 1
    pagina++

    // Pequeno delay para evitar rate limiting
    if (pagina <= totalPaginas && pagina <= maxPaginas) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  } while (pagina <= totalPaginas && pagina <= maxPaginas)

  return resultados
}

/**
 * Busca dados completos de uma contratação específica (endpoint 2)
 * Manual 6.3.5 - Consultar uma Contratação
 */
export async function buscarContratacaoCompleta(numeroControlePNCP) {
  if (!numeroControlePNCP) {
    throw new Error('Número de controle PNCP é obrigatório')
  }


  try {
    const numeroEncoded = encodeURIComponent(numeroControlePNCP)
    const url = `${PNCP_BASE_URL}/v1/contratacoes/${numeroEncoded}`
    

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      mode: 'cors',
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      const errorText = await response.text().catch(() => '')
      return null
    }

    const text = await response.text()
    if (!text || !text.trim()) {
      return null
    }

    const dados = JSON.parse(text)
    
    return dados
  } catch (error) {
    return null
  }
}

/**
 * Busca detalhes completos de uma contratação por número de controle PNCP
 * Inclui itens, documentos e anexos
 */
export async function buscarDetalhesContratacao(numeroControlePNCP) {
  if (!numeroControlePNCP) {
    throw new Error('Número de controle PNCP é obrigatório')
  }


  try {
    // Segundo a documentação do PNCP, os endpoints são:
    // GET /v1/contratacoes/{numeroControlePNCP}/itens
    // GET /v1/contratacoes/{numeroControlePNCP}/documentos
    
    // O número de controle pode ter "/" que precisa ser codificado
    const numeroEncoded = encodeURIComponent(numeroControlePNCP)
    const urlItens = `${PNCP_BASE_URL}/v1/contratacoes/${numeroEncoded}/itens`
    const urlDocs = `${PNCP_BASE_URL}/v1/contratacoes/${numeroEncoded}/documentos`
    

    // Buscar em paralelo
    const [responseItens, responseDocs] = await Promise.allSettled([
      fetch(urlItens, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
      }),
      fetch(urlDocs, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
      })
    ])

    let itens = []
    if (responseItens.status === 'fulfilled' && responseItens.value) {
      if (responseItens.value.ok) {
        try {
          const textItens = await responseItens.value.text()
          
          if (textItens && textItens.trim()) {
            const dadosItens = JSON.parse(textItens)
            
            // A API pode retornar de várias formas
            if (Array.isArray(dadosItens)) {
              itens = dadosItens
            } else if (dadosItens.data && Array.isArray(dadosItens.data)) {
              itens = dadosItens.data
            } else if (dadosItens.itens && Array.isArray(dadosItens.itens)) {
              itens = dadosItens.itens
            } else if (dadosItens.content && Array.isArray(dadosItens.content)) {
              itens = dadosItens.content
            } else if (dadosItens.resultado && Array.isArray(dadosItens.resultado)) {
              itens = dadosItens.resultado
            }
            
          }
        } catch (error) {
        }
      } else {
        const status = responseItens.value.status
        const statusText = responseItens.value.statusText
        const errorText = await responseItens.value.text().catch(() => '')
      }
    } else {
    }

    let documentos = []
    if (responseDocs.status === 'fulfilled' && responseDocs.value) {
      if (responseDocs.value.ok) {
        try {
          const textDocs = await responseDocs.value.text()
          
          if (textDocs && textDocs.trim()) {
            const dadosDocs = JSON.parse(textDocs)
            
            // A API pode retornar de várias formas
            if (Array.isArray(dadosDocs)) {
              documentos = dadosDocs
            } else if (dadosDocs.data && Array.isArray(dadosDocs.data)) {
              documentos = dadosDocs.data
            } else if (dadosDocs.documentos && Array.isArray(dadosDocs.documentos)) {
              documentos = dadosDocs.documentos
            } else if (dadosDocs.content && Array.isArray(dadosDocs.content)) {
              documentos = dadosDocs.content
            } else if (dadosDocs.resultado && Array.isArray(dadosDocs.resultado)) {
              documentos = dadosDocs.resultado
            }
            
            // Garantir que temos os links dos documentos
            documentos = documentos.map(doc => ({
              ...doc,
              // Extrair URL do documento (pode vir em vários formatos)
              urlDocumento: doc.urlDocumento || doc.url || doc.linkDocumento || doc.link || doc.urlArquivo || null,
              url_original: doc.urlDocumento || doc.url || doc.linkDocumento || doc.link || doc.urlArquivo || null,
              nomeArquivo: doc.nomeArquivo || doc.nomeDocumento || doc.nome || 'Documento sem nome',
              tipoDocumento: doc.tipoDocumento || doc.codigoTipoDocumento || null,
            }))
            
            // Log dos links encontrados
            documentos.forEach((doc, idx) => {
              if (doc.urlDocumento) {
              } else {
              }
            })
          }
        } catch (error) {
        }
      } else {
        const status = responseDocs.value.status
        const statusText = responseDocs.value.statusText
        const errorText = await responseDocs.value.text().catch(() => '')
      }
    } else {
    }

    const resultado = {
      itens: itens,
      documentos: documentos
    }

    return resultado
  } catch (error) {
    // Não lançar erro, retornar vazio para não quebrar a aplicação
    return {
      itens: [],
      documentos: []
    }
  }
}

