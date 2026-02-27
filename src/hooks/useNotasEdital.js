import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'

/**
 * Hook para gerenciar notas e anotações de editais/licitações.
 * Requer que licitacaoId seja um UUID válido (não 'visualizacao').
 */
export function useNotasEdital(licitacaoId) {
  const { user } = useUserStore()
  const queryClient = useQueryClient()

  // UUID simples: 8-4-4-4-12 hex
  const idValido =
    licitacaoId &&
    licitacaoId !== 'visualizacao' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(licitacaoId)

  const queryKey = ['notas-edital', licitacaoId, user?.id]

  // ── Buscar notas ──────────────────────────────────────────────────────────
  const { data: notas = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !idValido) return []
      const { data, error } = await supabase
        .from('notas_edital')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('licitacao_id', licitacaoId)
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!user?.id && idValido,
  })

  // ── Adicionar nota ────────────────────────────────────────────────────────
  const { mutateAsync: adicionarNota, isPending: adicionando } = useMutation({
    mutationFn: async ({ nota, trechoCitado = null, pagina = null }) => {
      if (!user?.id || !idValido) throw new Error('ID de licitação inválido para notas.')
      if (!nota?.trim()) throw new Error('A nota não pode estar vazia.')
      const { data, error } = await supabase
        .from('notas_edital')
        .insert({
          usuario_id: user.id,
          licitacao_id: licitacaoId,
          nota: nota.trim(),
          trecho_citado: trechoCitado?.trim() || null,
          pagina: pagina ? parseInt(pagina, 10) : null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  // ── Editar nota ───────────────────────────────────────────────────────────
  const { mutateAsync: editarNota } = useMutation({
    mutationFn: async ({ id, nota }) => {
      if (!nota?.trim()) throw new Error('A nota não pode estar vazia.')
      const { error } = await supabase
        .from('notas_edital')
        .update({ nota: nota.trim() })
        .eq('id', id)
        .eq('usuario_id', user.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  // ── Deletar nota ──────────────────────────────────────────────────────────
  const { mutateAsync: deletarNota } = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('notas_edital')
        .delete()
        .eq('id', id)
        .eq('usuario_id', user.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    notas,
    isLoading,
    adicionarNota,
    adicionando,
    editarNota,
    deletarNota,
    habilitado: idValido && !!user?.id,
  }
}
