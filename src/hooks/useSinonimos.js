import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Hook para buscar sinônimos do banco de dados
 * Busca sinônimos gerais e específicos por setor
 */
export function useSinonimos(setoresIds = []) {
  return useQuery({
    queryKey: ['sinonimos', setoresIds],
    queryFn: async () => {
      console.log('🔍 [useSinonimos] Buscando sinônimos do banco...')
      
      // Verificar se tabela existe tentando buscar
      let sinonimosGerais = []
      try {
        const { data, error: errorGerais } = await supabase
          .from('sinonimos')
          .select('*')
          .eq('ativo', true)
          .order('peso', { ascending: false })
        
        if (errorGerais) {
          // Se tabela não existe (42P01) ou coluna não existe (42703), retornar vazio
          if (errorGerais.code === '42P01' || errorGerais.code === '42703') {
            console.warn('⚠️ [useSinonimos] Tabela sinonimos não existe ainda, usando sinônimos base do código')
            return {} // Retornar objeto vazio, sistema usará sinônimos base
          }
          throw errorGerais
        }
        
        sinonimosGerais = data || []

        console.log(`✅ [useSinonimos] ${sinonimosGerais?.length || 0} sinônimos gerais encontrados.`)
      } catch (error) {
        console.warn('⚠️ [useSinonimos] Erro ao buscar sinônimos:', error)
        return {} // Retornar vazio, sistema usará sinônimos base
      }

      // Se tem setores específicos, buscar sinônimos associados a esses setores
      let sinonimosPorSetor = []
      if (setoresIds && setoresIds.length > 0) {
        try {
          const { data: sinonimosSetores, error: errorSetores } = await supabase
            .from('setores_sinonimos')
            .select(`
              sinonimo_id,
              sinonimos (
                id,
                palavra_base,
                sinonimo,
                peso
              )
            `)
            .in('setor_id', setoresIds)
            .eq('ativo', true)

          if (errorSetores) {
            // Se tabela não existe, ignorar silenciosamente
            if (errorSetores.code !== '42P01' && errorSetores.code !== '42703') {
              console.warn('⚠️ [useSinonimos] Erro ao buscar sinônimos por setor:', errorSetores)
            }
          } else {
            sinonimosPorSetor = (sinonimosSetores || [])
              .map(ss => ss.sinonimos)
              .filter(s => s && s.ativo)
            console.log(`✅ [useSinonimos] ${sinonimosPorSetor.length} sinônimos específicos por setor encontrados.`)
          }
        } catch (error) {
          // Ignorar erros de tabela não existente
          if (error.code !== '42P01' && error.code !== '42703') {
            console.warn('⚠️ [useSinonimos] Erro ao buscar sinônimos por setor:', error)
          }
        }
      }

      // Combinar sinônimos gerais e específicos
      // Sinônimos específicos têm prioridade (maior peso)
      const todosSinonimos = [...(sinonimosGerais || []), ...sinonimosPorSetor]

      // Organizar em formato de objeto para fácil acesso
      const sinonimosMap = {}
      todosSinonimos.forEach(sin => {
        const palavraBase = sin.palavra_base?.toLowerCase()
        if (!palavraBase) return

        if (!sinonimosMap[palavraBase]) {
          sinonimosMap[palavraBase] = []
        }

        // Adicionar sinônimo com peso
        sinonimosMap[palavraBase].push({
          sinonimo: sin.sinonimo?.toLowerCase(),
          peso: sin.peso || 1
        })
      })

      // Remover duplicatas mantendo maior peso
      Object.keys(sinonimosMap).forEach(palavra => {
        const unicos = new Map()
        sinonimosMap[palavra].forEach(s => {
          const existente = unicos.get(s.sinonimo)
          if (!existente || s.peso > existente.peso) {
            unicos.set(s.sinonimo, s)
          }
        })
        sinonimosMap[palavra] = Array.from(unicos.values())
      })

      console.log(`✅ [useSinonimos] ${Object.keys(sinonimosMap).length} palavras-base com sinônimos organizados.`)
      console.log(`📊 [useSinonimos] Exemplo de sinônimos:`, Object.keys(sinonimosMap).slice(0, 5).map(k => ({
        palavra: k,
        sinonimos: sinonimosMap[k].length
      })))
      return sinonimosMap
    },
    staleTime: 1000 * 60 * 60, // Cache por 1 hora
    cacheTime: 1000 * 60 * 60 * 24, // Manter no cache por 24 horas
    enabled: !!supabase, // Só busca se Supabase estiver configurado
  })
}

