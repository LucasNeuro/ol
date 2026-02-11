/**
 * Palavras incompatíveis por setor (filtro semântico).
 * Carrega do banco (tabela setores_palavras_incompatibilidade).
 * Se o objeto do edital contiver alguma dessas palavras, a licitação é rejeitada para esse setor.
 * Formato: { setor_nome: [palavra1, palavra2, ...], ... }
 * setor_nome = chave normalizada (ex: saude, engenharia, informatica).
 */

/**
 * Busca palavras incompatíveis por setor no Supabase.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @returns {Promise<Record<string, string[]>>} Objeto { setor_nome: [palavras] }
 */
export async function fetchPalavrasIncompatibilidadePorSetor(supabaseClient) {
  if (!supabaseClient) return {}

  try {
    const { data, error } = await supabaseClient
      .from('setores_palavras_incompatibilidade')
      .select('setor_nome, palavra')
      .eq('ativo', true)
      .order('setor_nome')

    if (error) {
      const tabelaNaoExiste =
        error.status === 404 ||
        error.code === '42P01' ||
        error.code === '42703' ||
        (error.message && (error.message.includes('does not exist') || error.message.includes('relation')))
      if (tabelaNaoExiste) {
        console.warn(
          '⚠️ [palavrasIncompatibilidade] Tabela setores_palavras_incompatibilidade não encontrada. Rode criar_tabela_setores_palavras_incompatibilidade.sql no Supabase.'
        )
        return {}
      }
      console.warn('⚠️ [palavrasIncompatibilidade] Erro ao buscar:', error)
      return {}
    }

    const porSetor = {}
    ;(data || []).forEach(({ setor_nome, palavra }) => {
      const chave = (setor_nome || '').toLowerCase().trim()
      if (!chave || !palavra) return
      if (!porSetor[chave]) porSetor[chave] = []
      const p = (palavra || '').toLowerCase().trim()
      if (p && !porSetor[chave].includes(p)) porSetor[chave].push(p)
    })

    if (Object.keys(porSetor).length > 0) {
      console.log(`✅ [palavrasIncompatibilidade] Carregadas ${Object.keys(porSetor).length} setores do banco`)
    }
    return porSetor
  } catch (err) {
    console.warn('⚠️ [palavrasIncompatibilidade] Erro:', err)
    return {}
  }
}
