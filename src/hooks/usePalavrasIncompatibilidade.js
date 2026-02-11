import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchPalavrasIncompatibilidadePorSetor } from '@/lib/palavrasIncompatibilidade'

/**
 * Hook para buscar palavras incompatíveis por setor (filtro semântico).
 * Retorna { setor_nome: [palavra1, palavra2, ...], ... }.
 * Quando o objeto do edital contém uma dessas palavras, a licitação é rejeitada para esse setor.
 */
export function usePalavrasIncompatibilidade() {
  return useQuery({
    queryKey: ['palavras-incompatibilidade-setor'],
    queryFn: () => fetchPalavrasIncompatibilidadePorSetor(supabase),
    staleTime: 1000 * 60 * 60, // 1 hora
    placeholderData: {},
    enabled: !!supabase,
  })
}
