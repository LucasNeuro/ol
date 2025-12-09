// ============================================
// HOOK: useFiltrosSalvos
// ============================================
// Gerencia filtros salvos do usuário

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'

export function useFiltrosSalvos() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()

  // Buscar filtros salvos
  const { data: filtrosSalvos = [], isLoading } = useQuery({
    queryKey: ['filtros-salvos', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('filtros_salvos')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('ativo', true)
        .order('atualizado_em', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!user?.id,
  })

  // Salvar filtro
  const salvarFiltro = useMutation({
    mutationFn: async ({ nome, descricao, filtrosInclusao, filtrosExclusao, filtrosCnaes }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      const { data, error } = await supabase
        .from('filtros_salvos')
        .insert({
          usuario_id: user.id,
          nome,
          descricao: descricao || '',
          filtros_inclusao: filtrosInclusao || {},
          filtros_exclusao: filtrosExclusao || {},
          filtros_cnaes: filtrosCnaes || {},
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['filtros-salvos', user?.id])
    },
  })

  // Atualizar filtro
  const atualizarFiltro = useMutation({
    mutationFn: async ({ id, nome, descricao, filtrosInclusao, filtrosExclusao, filtrosCnaes }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      const { data, error } = await supabase
        .from('filtros_salvos')
        .update({
          nome,
          descricao: descricao || '',
          filtros_inclusao: filtrosInclusao || {},
          filtros_exclusao: filtrosExclusao || {},
          filtros_cnaes: filtrosCnaes || {},
        })
        .eq('id', id)
        .eq('usuario_id', user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['filtros-salvos', user?.id])
    },
  })

  // Deletar filtro
  const deletarFiltro = useMutation({
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
      queryClient.invalidateQueries(['filtros-salvos', user?.id])
    },
  })

  // Carregar filtro
  const carregarFiltro = async (id) => {
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
    filtrosSalvos,
    isLoading,
    salvarFiltro,
    atualizarFiltro,
    deletarFiltro,
    carregarFiltro,
  }
}

