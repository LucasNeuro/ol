// ============================================
// HOOK: useFiltrosExclusao
// ============================================
// Gerencia filtros de exclusão salvos do usuário

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'

export function useFiltrosExclusao() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()

  // Buscar filtros de exclusão salvos (apenas os que têm filtros_exclusao preenchido)
  const { data: filtrosExclusaoSalvos = [], isLoading } = useQuery({
    queryKey: ['filtros-exclusao-salvos', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('filtros_salvos')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('ativo', true)
        // Buscar apenas filtros que têm filtros_exclusao preenchido
        .not('filtros_exclusao', 'eq', '{}')
        .order('atualizado_em', { ascending: false })

      if (error) throw error
      
      // Filtrar apenas os que realmente têm filtros de exclusão válidos
      return (data || []).filter(filtro => {
        const exclusao = filtro.filtros_exclusao || {}
        return exclusao.excluirUfs?.length > 0 || exclusao.excluirPalavrasObjeto?.length > 0
      })
    },
    enabled: !!user?.id,
  })

  // Salvar filtro de exclusão
  const salvarFiltroExclusao = useMutation({
    mutationFn: async ({ nome, descricao, filtrosExclusao }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      const { data, error } = await supabase
        .from('filtros_salvos')
        .insert({
          usuario_id: user.id,
          nome,
          descricao: descricao || '',
          filtros_inclusao: {}, // Vazio para filtros de exclusão
          filtros_exclusao: filtrosExclusao || {},
          filtros_cnaes: {},
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['filtros-exclusao-salvos', user?.id])
      queryClient.invalidateQueries(['filtros-salvos', user?.id])
    },
  })

  // Atualizar filtro de exclusão
  const atualizarFiltroExclusao = useMutation({
    mutationFn: async ({ id, nome, descricao, filtrosExclusao }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      const { data, error } = await supabase
        .from('filtros_salvos')
        .update({
          nome,
          descricao: descricao || '',
          filtros_exclusao: filtrosExclusao || {},
        })
        .eq('id', id)
        .eq('usuario_id', user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['filtros-exclusao-salvos', user?.id])
      queryClient.invalidateQueries(['filtros-salvos', user?.id])
    },
  })

  // Deletar filtro de exclusão
  const deletarFiltroExclusao = useMutation({
    mutationFn: async (id) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      const { error } = await supabase
        .from('filtros_salvos')
        .update({ ativo: false })
        .eq('id', id)
        .eq('usuario_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['filtros-exclusao-salvos', user?.id])
      queryClient.invalidateQueries(['filtros-salvos', user?.id])
    },
  })

  // Carregar filtro de exclusão
  const carregarFiltroExclusao = async (id) => {
    if (!user?.id) return null

    const { data, error } = await supabase
      .from('filtros_salvos')
      .select('*')
      .eq('id', id)
      .eq('usuario_id', user.id)
      .eq('ativo', true)
      .single()

    if (error) throw error
    return data
  }

  return {
    filtrosExclusaoSalvos,
    isLoading,
    salvarFiltroExclusao,
    atualizarFiltroExclusao,
    deletarFiltroExclusao,
    carregarFiltroExclusao,
  }
}

