/**
 * Palavras fortes por setor (filtro dinâmico).
 * Carrega do banco (tabela setores_palavras_fortes) e usa fallback do código se a tabela não existir.
 * A tabela pode ser populada dinamicamente a partir do cadastro (setores/subsetores escolhidos).
 * Formato retornado: { setor_nome: [palavra1, palavra2, ...], ... }
 * setor_nome = chave normalizada (ex: saude, engenharia, alimentacao).
 */

import { normalizarTexto } from '@/lib/filtroSemantico'

/**
 * Sincroniza palavras fortes a partir dos setores/subsetores escolhidos no cadastro.
 * Cada setor e cada subsetor vira uma linha (setor_nome, palavra) na tabela.
 * Assim a tabela cresce com o uso, sem depender só de lista fixa.
 * @param {Array<{ setor?: string, subsetores?: string[] }>} setoresAtividades - Ex.: [{ setor: 'Saúde', subsetores: ['Medicamentos', 'Hospitalar'] }]
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @returns {Promise<{ ok: boolean, inseridas?: number }>}
 */
export async function syncPalavrasFortesFromSetores(setoresAtividades, supabaseClient) {
  if (!supabaseClient || !setoresAtividades || setoresAtividades.length === 0) {
    return { ok: false }
  }

  const linhas = []
  const visto = new Set()

  for (const item of setoresAtividades) {
    const setor = item.setor || item.setor_nome
    if (!setor) continue
    const setorNorm = normalizarTexto(setor)
    if (setorNorm.length < 2) continue

    const chaveSetorPalavra = (sn, p) => `${sn}|${p}`
    if (!visto.has(chaveSetorPalavra(setorNorm, setorNorm))) {
      visto.add(chaveSetorPalavra(setorNorm, setorNorm))
      linhas.push({ setor_nome: setorNorm, palavra: setorNorm })
    }

    const subsetores = item.subsetores || []
    for (const sub of subsetores) {
      if (!sub || typeof sub !== 'string') continue
      const palavraNorm = normalizarTexto(sub)
      if (palavraNorm.length < 2) continue
      if (!visto.has(chaveSetorPalavra(setorNorm, palavraNorm))) {
        visto.add(chaveSetorPalavra(setorNorm, palavraNorm))
        linhas.push({ setor_nome: setorNorm, palavra: palavraNorm })
      }
    }
  }

  if (linhas.length === 0) return { ok: true, inseridas: 0 }

  try {
    const { error } = await supabaseClient
      .from('setores_palavras_fortes')
      .upsert(linhas, { onConflict: 'setor_nome,palavra', ignoreDuplicates: true })

    if (error) {
      if (error.code === '42P01' || error.status === 404) return { ok: false }
      console.warn('⚠️ [palavrasFortes] Erro ao sincronizar:', error)
      return { ok: false }
    }
    return { ok: true, inseridas: linhas.length }
  } catch (err) {
    console.warn('⚠️ [palavrasFortes] Erro ao sincronizar:', err)
    return { ok: false }
  }
}

/**
 * Busca palavras fortes por setor no Supabase.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @returns {Promise<Record<string, string[]>>} Objeto { setor_nome: [palavras] }
 */
export async function fetchPalavrasFortesPorSetor(supabaseClient) {
  if (!supabaseClient) return {}

  try {
    const { data, error } = await supabaseClient
      .from('setores_palavras_fortes')
      .select('setor_nome, palavra')
      .eq('ativo', true)
      .order('setor_nome')

    if (error) {
      const tabelaNaoExiste =
        error.status === 404 ||
        error.code === '42P01' ||
        error.code === '42703' ||
        error.code === 'PGRST301' ||
        (error.message && (error.message.includes('does not exist') || error.message.includes('relation')))
      if (tabelaNaoExiste) {
        console.warn(
          '⚠️ [palavrasFortes] Tabela setores_palavras_fortes não encontrada. Para filtros robustos, rode no Supabase (SQL Editor) o script: criar_tabela_setores_palavras_fortes.sql'
        )
        return {}
      }
      console.warn('⚠️ [palavrasFortes] Erro ao buscar:', error)
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
      console.log(`✅ [palavrasFortes] Carregadas ${Object.keys(porSetor).length} setores com palavras fortes do banco`)
    }
    return porSetor
  } catch (err) {
    console.warn('⚠️ [palavrasFortes] Erro:', err)
    return {}
  }
}
