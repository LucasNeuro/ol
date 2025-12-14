import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Hook para buscar setores e subsetores do banco de dados
 */
export function useSetores() {
  return useQuery({
    queryKey: ['setores'],
    queryFn: async () => {
      console.log('🔍 Buscando setores do banco...')
      
      // Buscar setores ativos ordenados
      const { data: setores, error: errorSetores } = await supabase
        .from('setores')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })

      if (errorSetores) {
        console.error('❌ Erro ao buscar setores:', errorSetores)
        throw errorSetores
      }

      console.log('✅ Setores encontrados:', setores?.length || 0)

      // Buscar subsetores ativos ordenados
      const { data: subsetores, error: errorSubsetores } = await supabase
        .from('subsetores')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })

      if (errorSubsetores) {
        console.error('❌ Erro ao buscar subsetores:', errorSubsetores)
        throw errorSubsetores
      }

      console.log('✅ Subsetores encontrados:', subsetores?.length || 0)

      // Organizar subsetores por setor
      const setoresComSubsetores = (setores || []).map(setor => ({
        id: setor.id,
        setor: setor.nome,
        subsetores: (subsetores || [])
          .filter(sub => sub.setor_id === setor.id)
          .map(sub => sub.nome)
      }))

      console.log('✅ Setores organizados:', setoresComSubsetores.length)
      return setoresComSubsetores
    },
    staleTime: 1000 * 60 * 60, // Cache por 1 hora
    cacheTime: 1000 * 60 * 60 * 24, // Manter no cache por 24 horas
    retry: 2, // Tentar 2 vezes em caso de erro
  })
}

