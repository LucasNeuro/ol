// ============================================
// HOOK: useAlertasEmail
// ============================================
// Lista, cria, atualiza e remove alertas por e-mail (filtros salvos com envio no horário)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'

// Colunas sem resumo_semanal_ativo para compatibilidade com bancos que ainda não rodaram a migration
const COLS = 'id, nome_alerta, filtros, ativo, horario_verificacao, email_notificacao, created_at, updated_at'

export function useAlertasEmail() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ['alertas-email', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('alertas_usuario')
        .select(COLS)
        .eq('usuario_id', user.id)
        .eq('tipo', 'email')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!user?.id,
  })

  const criar = useMutation({
    mutationFn: async ({ nome_alerta, filtros, email_notificacao, horario_verificacao = '08:00', ativo = false }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      const payload = {
        usuario_id: user.id,
        nome_alerta: nome_alerta || 'Filtro salvo',
        tipo: 'email',
        filtros: filtros || {},
        ativo: !!ativo,
        frequencia: 'diario',
        email_notificacao: email_notificacao || null,
        horario_verificacao: horario_verificacao && String(horario_verificacao).trim() ? String(horario_verificacao).trim().slice(0, 8) : '08:00:00',
      }
      const { data, error } = await supabase.from('alertas_usuario').insert(payload).select(COLS).single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas-email', user?.id])
    },
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, nome_alerta, filtros, ativo, horario_verificacao, email_notificacao }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      const upd = {}
      if (nome_alerta !== undefined) upd.nome_alerta = nome_alerta
      if (filtros !== undefined) upd.filtros = filtros
      if (ativo !== undefined) upd.ativo = ativo
      if (email_notificacao !== undefined) upd.email_notificacao = email_notificacao
      if (horario_verificacao !== undefined) upd.horario_verificacao = horario_verificacao && String(horario_verificacao).trim() ? String(horario_verificacao).trim().slice(0, 8) : null
      upd.updated_at = new Date().toISOString()
      const { data, error } = await supabase.from('alertas_usuario').update(upd).eq('id', id).eq('usuario_id', user.id).select(COLS).single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas-email', user?.id])
    },
  })

  const remover = useMutation({
    mutationFn: async (id) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      const { error } = await supabase.from('alertas_usuario').delete().eq('id', id).eq('usuario_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas-email', user?.id])
    },
  })

  return { alertas, isLoading, criar, atualizar, remover }
}

/** Retorna um resumo legível dos filtros (UF, palavra, setor, etc.) */
export function resumoFiltros(filtros) {
  if (!filtros || typeof filtros !== 'object') return 'Nenhum filtro'
  const p = []
  if (filtros.uf) p.push(`UF: ${filtros.uf}`)
  if (filtros.buscaObjeto) p.push(`Busca: ${String(filtros.buscaObjeto).slice(0, 30)}${String(filtros.buscaObjeto).length > 30 ? '…' : ''}`)
  if (filtros.excluirPalavras) p.push(`Excluir: ${String(filtros.excluirPalavras).slice(0, 20)}…`)
  if (filtros.valorMin || filtros.valorMax) p.push(`Valor: ${filtros.valorMin || '0'} - ${filtros.valorMax || '∞'}`)
  if (filtros.modalidade) p.push(filtros.modalidade)
  if ((filtros.excluirAtividadesIds || []).length > 0) p.push(`${filtros.excluirAtividadesIds.length} atividade(s) excl.`)
  if (filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim) p.push(`Data: ${filtros.dataPublicacaoInicio || '?'} a ${filtros.dataPublicacaoFim || '?'}`)
  return p.length ? p.join(' · ') : 'Nenhum filtro'
}
