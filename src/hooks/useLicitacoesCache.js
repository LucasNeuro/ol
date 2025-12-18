import { useEffect, useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { eq, and, or, like } from '@tanstack/db'
import { licitacoesCollection } from '@/lib/collections/licitacoes'
import { useQuery } from '@tanstack/react-query'

/**
 * Hook para gerenciar cache de licitações com TanStack DB
 * 
 * Funcionalidades:
 * 1. Carrega licitações do banco uma vez (via collection)
 * 2. Aplica filtro semântico uma vez após carregamento
 * 3. Usa live queries para todos os outros filtros (sem chamadas ao banco)
 * 
 * @param {Object} options - Opções do hook
 * @param {Object} options.perfilUsuario - Perfil do usuário (estados, setores)
 * @param {Object} options.filtros - Filtros a aplicar (busca, excluir palavras, etc)
 * @param {Function} options.filtroSemantico - Função para aplicar filtro semântico
 */
export function useLicitacoesCache({ perfilUsuario, filtros, filtroSemantico }) {
  const [licitacoesIniciais, setLicitacoesIniciais] = useState(null)
  const [filtroSemanticoAplicado, setFiltroSemanticoAplicado] = useState(false)
  const [isLoadingSemantico, setIsLoadingSemantico] = useState(false)

  // Passo 1: Carregar licitações do banco (uma vez via collection)
  // A collection usa TanStack Query internamente, então busca apenas uma vez
  const { data: todasLicitacoes = [], isLoading: isLoadingBanco } = useQuery({
    queryKey: ['licitacoes-collection'],
    queryFn: async () => {
      // A collection já tem a função de busca configurada
      // Aqui apenas inicializamos ela
      await licitacoesCollection.startSync()
      return licitacoesCollection.toArray()
    },
    staleTime: Infinity, // Nunca considera stale - cache permanente na sessão
    gcTime: 1000 * 60 * 60 * 24, // Mantém cache por 24 horas
  })

  // Passo 2: Aplicar filtro semântico UMA VEZ após carregar do banco
  useEffect(() => {
    if (isLoadingBanco || !todasLicitacoes.length || filtroSemanticoAplicado) {
      return
    }

    if (!filtroSemantico || !perfilUsuario) {
      // Sem filtro semântico, usar todas as licitações
      setLicitacoesIniciais(todasLicitacoes)
      setFiltroSemanticoAplicado(true)
      return
    }

    // Aplicar filtro semântico uma vez
    setIsLoadingSemantico(true)
    const aplicarFiltro = async () => {
      try {
        const resultado = await filtroSemantico(todasLicitacoes, perfilUsuario)
        setLicitacoesIniciais(resultado)
        setFiltroSemanticoAplicado(true)
      } catch (error) {
        console.error('Erro ao aplicar filtro semântico:', error)
        setLicitacoesIniciais(todasLicitacoes)
        setFiltroSemanticoAplicado(true)
      } finally {
        setIsLoadingSemantico(false)
      }
    }

    aplicarFiltro()
  }, [isLoadingBanco, todasLicitacoes, filtroSemantico, perfilUsuario, filtroSemanticoAplicado])

  // Passo 3: Usar live query para aplicar filtros em tempo real (sem chamadas ao banco)
  // Só funciona se já temos as licitações iniciais
  const { data: licitacoesFiltradas = [] } = useLiveQuery(
    (q) => {
      if (!licitacoesIniciais || licitacoesIniciais.length === 0) {
        return q.from({ lic: licitacoesCollection }).select(() => [])
      }

      // Criar collection temporária com licitações já filtradas semanticamente
      // Por enquanto, vamos usar as licitações iniciais diretamente
      // TODO: Criar collection derivada ou usar filtros inline
      
      let query = q.from({ lic: licitacoesCollection })

      // Aplicar filtros usando live query
      const conditions = []

      // Busca rápida (INCLUIR)
      if (filtros?.buscaObjeto) {
        const termosBusca = filtros.buscaObjeto
          .split(',')
          .map(t => t.trim().toLowerCase())
          .filter(t => t.length > 0)
        
        if (termosBusca.length > 0) {
          const buscaConditions = termosBusca.map(termo => 
            or(
              like('objeto_compra', `%${termo}%`),
              like('orgao_razao_social', `%${termo}%`),
              like('numero_controle_pncp', `%${termo}%`),
              like('modalidade_nome', `%${termo}%`)
            )
          )
          conditions.push(or(...buscaConditions))
        }
      }

      // UF
      if (filtros?.uf) {
        conditions.push(eq('uf_sigla', filtros.uf.toUpperCase()))
      }

      // Modalidade
      if (filtros?.modalidade) {
        conditions.push(like('modalidade_nome', `%${filtros.modalidade}%`))
      }

      // Valor mínimo
      if (filtros?.valorMin) {
        conditions.push(q.gte('valor_total_estimado', parseFloat(filtros.valorMin)))
      }

      // Valor máximo
      if (filtros?.valorMax) {
        conditions.push(q.lte('valor_total_estimado', parseFloat(filtros.valorMax)))
      }

      if (conditions.length > 0) {
        query = query.where(({ lic }) => and(...conditions))
      }

      // Excluir palavras será aplicado depois (não suportado diretamente nas live queries)
      // Vamos aplicar isso manualmente no resultado
      
      return query
    },
    {
      enabled: filtroSemanticoAplicado && !!licitacoesIniciais,
    }
  )

  // Aplicar filtro de exclusão de palavras (não suportado diretamente em live queries)
  const licitacoesFinais = licitacoesFiltradas.filter(licitacao => {
    if (!filtros?.excluirPalavras) return true

    const termosExclusao = filtros.excluirPalavras
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0)

    if (termosExclusao.length === 0) return true

    const objeto = (licitacao.objeto_compra || '').toLowerCase()
    const orgao = (licitacao.orgao_razao_social || '').toLowerCase()
    const numeroControle = (licitacao.numero_controle_pncp || '').toLowerCase()
    const modalidade = (licitacao.modalidade_nome || '').toLowerCase()

    const contemAlgumaPalavra = termosExclusao.some(termo =>
      objeto.includes(termo) ||
      orgao.includes(termo) ||
      numeroControle.includes(termo) ||
      modalidade.includes(termo)
    )

    return !contemAlgumaPalavra
  })

  return {
    licitacoes: licitacoesFinais,
    isLoading: isLoadingBanco || isLoadingSemantico,
    isInitialLoad: isLoadingBanco || !filtroSemanticoAplicado,
  }
}

