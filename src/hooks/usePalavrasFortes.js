import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchPalavrasFortesPorSetor } from '@/lib/palavrasFortes'

/**
 * Hook para buscar palavras fortes por setor (filtro dinâmico).
 * Retorna { setor_nome: [palavra1, palavra2, ...], ... }.
 * O filtro semântico mescla com o fallback do código quando o banco tem dados.
 */
export function usePalavrasFortes() {
  return useQuery({
    queryKey: ['palavras-fortes-setor'],
    queryFn: () => fetchPalavrasFortesPorSetor(supabase),
    staleTime: 1000 * 60 * 60, // 1 hora
    placeholderData: {},
    enabled: !!supabase,
  })
}
