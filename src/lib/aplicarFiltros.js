/**
 * Utilitário para aplicar filtros a licitações
 * Suporta modo incluir/excluir e múltiplos critérios
 */

/**
 * Verifica se uma licitação atende aos critérios (AND entre critérios)
 * @param {Object} licitacao - Licitação a verificar
 * @param {Object} criterios - Critérios do filtro
 * @returns {boolean} - true se atende a TODOS os critérios
 */
function atendeCriterios(licitacao, criterios) {
  if (!criterios || Object.keys(criterios).length === 0) {
    return true // Sem critérios, sempre atende
  }

  // Palavras no objeto (OR dentro do critério)
  if (criterios.palavras_objeto && criterios.palavras_objeto.length > 0) {
    const objeto = (licitacao.objeto_compra || '').toLowerCase()
    const temPalavra = criterios.palavras_objeto.some(palavra =>
      objeto.includes(palavra.toLowerCase())
    )
    if (!temPalavra) return false // Não tem nenhuma palavra, não atende
  }

  // Estados (OR dentro do critério)
  if (criterios.estados && criterios.estados.length > 0) {
    const uf = (licitacao.uf_sigla || '').toUpperCase()
    const temEstado = criterios.estados.map(e => e.toUpperCase()).includes(uf)
    if (!temEstado) return false // Não está em nenhum estado, não atende
  }

  // Modalidades (OR dentro do critério)
  if (criterios.modalidades && criterios.modalidades.length > 0) {
    const modalidade = (licitacao.modalidade_nome || '').toLowerCase()
    const temModalidade = criterios.modalidades.some(mod =>
      modalidade.includes(mod.toLowerCase())
    )
    if (!temModalidade) return false
  }

  // Valor mínimo
  if (criterios.valor_min !== undefined && criterios.valor_min !== null) {
    const valor = licitacao.valor_total_estimado || 0
    if (valor < criterios.valor_min) return false
  }

  // Valor máximo
  if (criterios.valor_max !== undefined && criterios.valor_max !== null) {
    const valor = licitacao.valor_total_estimado || 0
    if (valor > criterios.valor_max) return false
  }

  // Órgãos (OR dentro do critério)
  if (criterios.orgaos && criterios.orgaos.length > 0) {
    const orgao = (licitacao.orgao_razao_social || '').toLowerCase()
    const temOrgao = criterios.orgaos.some(org =>
      orgao.includes(org.toLowerCase())
    )
    if (!temOrgao) return false
  }

  // CNAEs (OR dentro do critério)
  if (criterios.cnaes && criterios.cnaes.length > 0) {
    // Verificar se a licitação tem algum dos CNAEs nos itens
    const itens = licitacao.itens || []
    const temCnae = criterios.cnaes.some(cnae => {
      return itens.some(item => {
        const classificacao = item.classificacao?.codigo || item.classificacao_codigo || ''
        return classificacao.includes(cnae)
      })
    })
    if (!temCnae) return false
  }

  // Se passou por todos os critérios, atende
  return true
}

/**
 * Aplica múltiplos filtros a uma lista de licitações
 * @param {Array} licitacoes - Lista de licitações
 * @param {Array} filtrosAtivos - Lista de filtros ativos com aplicar_automaticamente = true
 * @returns {Object} - { licitacoesFiltradas, totalExcluido, totalIncluido }
 */
export function aplicarFiltrosAvancados(licitacoes, filtrosAtivos) {
  if (!filtrosAtivos || filtrosAtivos.length === 0) {
    return { 
      licitacoesFiltradas: licitacoes, 
      totalExcluido: 0,
      totalIncluido: 0
    }
  }

  let licitacoesFiltradas = [...licitacoes]
  let totalExcluido = 0
  let totalIncluido = 0

  // Separar filtros inclusivos e excludentes
  const filtrosIncluir = filtrosAtivos.filter(f => {
    const modo = f.modo || f.filtros_exclusao?._modo || 'excluir'
    return modo === 'incluir'
  })
  
  const filtrosExcluir = filtrosAtivos.filter(f => {
    const modo = f.modo || f.filtros_exclusao?._modo || 'excluir'
    return modo === 'excluir'
  })

  // Aplicar filtros inclusivos primeiro (AND entre filtros - todos devem atender)
  if (filtrosIncluir.length > 0) {
    const antes = licitacoesFiltradas.length
    
    filtrosIncluir.forEach(filtro => {
      let criterios = filtro.criterios || {}
      
      // Se não tem critérios estruturados, tentar converter estrutura antiga
      if (Object.keys(criterios).length === 0) {
        if (filtro.filtros_inclusao) {
          // Converter estrutura antiga para nova
          criterios.palavras_objeto = filtro.filtros_inclusao.buscaObjeto ? [filtro.filtros_inclusao.buscaObjeto] : []
          criterios.estados = filtro.filtros_inclusao.uf ? [filtro.filtros_inclusao.uf] : []
          criterios.modalidades = filtro.filtros_inclusao.modalidade ? [filtro.filtros_inclusao.modalidade] : []
          criterios.valor_min = filtro.filtros_inclusao.valorMin
          criterios.valor_max = filtro.filtros_inclusao.valorMax
          criterios.orgaos = filtro.filtros_inclusao.orgao ? [filtro.filtros_inclusao.orgao] : []
        } else if (filtro.filtros_exclusao?._criterios) {
          // Usar critérios da estrutura JSONB
          criterios = filtro.filtros_exclusao._criterios
        }
      }

      // Filtrar: manter apenas licitações que ATENDEM os critérios
      licitacoesFiltradas = licitacoesFiltradas.filter(licitacao =>
        atendeCriterios(licitacao, criterios)
      )
    })

    // Total incluído = quantos foram mantidos após aplicar filtros inclusivos
    totalIncluido = licitacoesFiltradas.length
  } else {
    // Se não há filtros inclusivos, todas as licitações estão "incluídas"
    totalIncluido = licitacoesFiltradas.length
  }

  // Aplicar filtros excludentes (OR entre filtros - se atender QUALQUER um, exclui)
  if (filtrosExcluir.length > 0) {
    const antes = licitacoesFiltradas.length

    licitacoesFiltradas = licitacoesFiltradas.filter(licitacao => {
      // Se atende critérios de QUALQUER filtro excludente, EXCLUIR
      const deveExcluir = filtrosExcluir.some(filtro => {
        let criterios = filtro.criterios || {}
        
        // Se não tem critérios estruturados, tentar converter
        if (Object.keys(criterios).length === 0) {
          if (filtro.filtros_exclusao?._criterios) {
            criterios = filtro.filtros_exclusao._criterios
          } else if (filtro.filtros_exclusao) {
            // Converter estrutura antiga
            if (filtro.filtros_exclusao.palavras_objeto) {
              criterios.palavras_objeto = filtro.filtros_exclusao.palavras_objeto
            }
            if (filtro.filtros_exclusao.estados_excluir) {
              criterios.estados = filtro.filtros_exclusao.estados_excluir
            }
          }
        }

        return atendeCriterios(licitacao, criterios)
      })
      
      // Manter apenas se NÃO deve excluir
      return !deveExcluir
    })

    totalExcluido = antes - licitacoesFiltradas.length
  }

  return { 
    licitacoesFiltradas, 
    totalExcluido,
    totalIncluido
  }
}

