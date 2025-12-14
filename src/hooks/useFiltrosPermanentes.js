import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'
import { aplicarFiltrosAvancados } from '@/lib/aplicarFiltros'

/**
 * Hook para gerenciar filtros permanentes (excludentes)
 */
export function useFiltrosPermanentes() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()

  // Buscar filtros permanentes do usuário
  const { data: filtrosPermanentes = [], isLoading } = useQuery({
    queryKey: ['filtros-permanentes', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('filtros_salvos')
        .select('*')
        .eq('usuario_id', user.id)
        .order('criado_em', { ascending: false })

      if (error) throw error

      // Filtrar e normalizar filtros permanentes
      return (data || []).filter(f => {
        // Verificar se é permanente (campo direto ou na estrutura JSONB)
        const permanente = f.permanente !== undefined 
          ? f.permanente 
          : f.filtros_exclusao?._permanente === true
        return permanente
      }).map(f => {
        // Normalizar dados: se não tem campos diretos, usar estrutura JSONB
        if (!f.criterios && f.filtros_exclusao?._criterios) {
          f.criterios = f.filtros_exclusao._criterios
        }
        if (!f.modo && f.filtros_exclusao?._modo) {
          f.modo = f.filtros_exclusao._modo
        }
        if (f.aplicar_automaticamente === undefined && f.filtros_exclusao?._aplicar_automaticamente !== undefined) {
          f.aplicar_automaticamente = f.filtros_exclusao._aplicar_automaticamente
        }
        return f
      })
    },
    enabled: !!user?.id
  })

  // Buscar apenas filtros permanentes ativos com aplicar_automaticamente
  const { data: filtrosAtivos = [] } = useQuery({
    queryKey: ['filtros-permanentes-ativos', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('filtros_salvos')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('ativo', true)
        .order('criado_em', { ascending: false })

      if (error) throw error

      // Filtrar e normalizar filtros permanentes ativos
      return (data || []).filter(f => {
        // Verificar se é permanente
        const permanente = f.permanente !== undefined 
          ? f.permanente 
          : f.filtros_exclusao?._permanente === true
        
        // Verificar se deve aplicar automaticamente
        const aplicarAuto = f.aplicar_automaticamente !== undefined
          ? f.aplicar_automaticamente
          : f.filtros_exclusao?._aplicar_automaticamente === true
        
        return permanente && aplicarAuto
      }).map(f => {
        // Normalizar dados: se não tem campos diretos, usar estrutura JSONB
        if (!f.criterios && f.filtros_exclusao?._criterios) {
          f.criterios = f.filtros_exclusao._criterios
        }
        if (!f.modo && f.filtros_exclusao?._modo) {
          f.modo = f.filtros_exclusao._modo
        }
        if (f.aplicar_automaticamente === undefined && f.filtros_exclusao?._aplicar_automaticamente !== undefined) {
          f.aplicar_automaticamente = f.filtros_exclusao._aplicar_automaticamente
        }
        return f
      })
    },
    enabled: !!user?.id
  })

  // Criar/atualizar filtro permanente
  const criarFiltroPermanente = useMutation({
    mutationFn: async (filtroData) => {
      // Preparar dados base (sempre funcionam)
      const dadosInsercao = {
        usuario_id: user.id,
        nome: filtroData.nome,
        descricao: filtroData.descricao || '',
        ativo: filtroData.ativo ?? true,
        filtros_inclusao: {},
        filtros_cnaes: {}
      }

      // Armazenar dados novos na estrutura JSONB (fallback seguro)
      const criterios = filtroData.criterios || {}
      const modo = filtroData.modo || 'incluir'
      const aplicarAuto = filtroData.aplicar_automaticamente ?? false

      // Usar filtros_exclusao para armazenar metadados temporariamente
      dadosInsercao.filtros_exclusao = {
        _permanente: true,
        _tipo: 'permanente',
        _modo: modo,
        _aplicar_automaticamente: aplicarAuto,
        _criterios: criterios,
        // Manter compatibilidade com estrutura antiga
        palavras_objeto: criterios.palavras_objeto || [],
        estados_excluir: criterios.estados || []
      }

      // Tentar adicionar campos novos (se existirem no banco)
      // Se der erro, os dados já estão em filtros_exclusao
      try {
        // Verificar se as colunas existem tentando fazer um select primeiro
        const { error: testError } = await supabase
          .from('filtros_salvos')
          .select('permanente, aplicar_automaticamente, modo, criterios')
          .limit(0)
        
        if (!testError) {
          // Colunas existem, usar estrutura nova
          dadosInsercao.permanente = true
          dadosInsercao.tipo = 'permanente'
          dadosInsercao.aplicar_automaticamente = aplicarAuto
          dadosInsercao.modo = modo
          dadosInsercao.criterios = criterios
          // Limpar metadados do filtros_exclusao se usar estrutura nova
          dadosInsercao.filtros_exclusao = {
            palavras_objeto: criterios.palavras_objeto || [],
            estados_excluir: criterios.estados || []
          }
        }
      } catch (e) {
        // Campos não existem, usar estrutura antiga (já configurada acima)
        console.warn('Usando estrutura JSONB para campos novos:', e.message)
      }

      const { data, error } = await supabase
        .from('filtros_salvos')
        .insert(dadosInsercao)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['filtros-permanentes', user?.id])
      queryClient.invalidateQueries(['filtros-permanentes-ativos', user?.id])
    }
  })

  // Atualizar filtro permanente
  const atualizarFiltroPermanente = useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const updatesFinal = {
        ...updates,
        atualizado_em: new Date().toISOString()
      }

      // Se atualizando critérios, garantir que modo está definido
      if (updates.criterios && !updates.modo) {
        updatesFinal.modo = 'incluir' // Default
      }

      const { data, error } = await supabase
        .from('filtros_salvos')
        .update(updatesFinal)
        .eq('id', id)
        .eq('usuario_id', user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['filtros-permanentes', user?.id])
      queryClient.invalidateQueries(['filtros-permanentes-ativos', user?.id])
    }
  })

  // Toggle ativo/inativo
  const toggleFiltroPermanente = useMutation({
    mutationFn: async ({ id, ativo }) => {
      const { data, error } = await supabase
        .from('filtros_salvos')
        .update({ 
          ativo: !ativo,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', id)
        .eq('usuario_id', user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['filtros-permanentes', user?.id])
      queryClient.invalidateQueries(['filtros-permanentes-ativos', user?.id])
    }
  })

  // Deletar filtro permanente
  const deletarFiltroPermanente = useMutation({
    mutationFn: async (id) => {
      // Tentar deletar usando campo permanente, senão deletar direto
      try {
        const { error } = await supabase
          .from('filtros_salvos')
          .delete()
          .eq('id', id)
          .eq('usuario_id', user.id)
        if (error) throw error
      } catch (e) {
        // Se falhar, tentar sem o filtro permanente
        const { error } = await supabase
          .from('filtros_salvos')
          .delete()
          .eq('id', id)
          .eq('usuario_id', user.id)
        if (error) throw error
      }

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['filtros-permanentes', user?.id])
      queryClient.invalidateQueries(['filtros-permanentes-ativos', user?.id])
    }
  })

  // Aplicar filtros permanentes ativos a uma lista de licitações
  const aplicarFiltrosPermanentes = useCallback((licitacoes) => {
    return aplicarFiltrosAvancados(licitacoes, filtrosAtivos)
  }, [filtrosAtivos])

  return {
    filtrosPermanentes,
    filtrosAtivos,
    isLoading,
    criarFiltroPermanente,
    atualizarFiltroPermanente,
    toggleFiltroPermanente,
    deletarFiltroPermanente,
    aplicarFiltrosPermanentes
  }
}

