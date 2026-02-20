/**
 * Script para classificar licitações por setor e UF e gravar em licitacoes_por_setor.
 * Usa a mesma lógica do filtro semântico (filtroSemantico.js).
 * Uso: node scripts/classificar-licitacoes-por-setor.js [dias]
 * Ex.: node scripts/classificar-licitacoes-por-setor.js 7  (últimos 7 dias)
 * Requer .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou SUPABASE_*).
 * Preferir SUPABASE_SERVICE_ROLE_KEY para escrita em massa.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  correspondeAtividades,
  extrairPalavrasChaveDosSetores,
  normalizarTexto,
} from '../src/lib/filtroSemantico.js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error(
    '❌ Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou SUPABASE_SERVICE_ROLE_KEY) no .env'
  )
  process.exit(1)
}

const supabase = createClient(url, key)
const DIAS = parseInt(process.argv[2] || '7', 10)
const BATCH_UPSERT = 200

function log(...args) {
  console.log('[classificar-por-setor]', ...args)
}

/** Busca palavras fortes por setor (setor_nome normalizado -> [palavras]) */
async function fetchPalavrasFortesPorSetor() {
  try {
    const { data, error } = await supabase
      .from('setores_palavras_fortes')
      .select('setor_nome, palavra')
      .eq('ativo', true)

    if (error) {
      if (error.code === '42P01' || error.code === '42703') return {}
      log('Aviso palavras fortes:', error.message)
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
    return porSetor
  } catch (e) {
    log('Erro palavras fortes:', e.message)
    return {}
  }
}

/** Busca palavras incompatibilidade por setor */
async function fetchPalavrasIncompatibilidadePorSetor() {
  try {
    const { data, error } = await supabase
      .from('setores_palavras_incompatibilidade')
      .select('setor_nome, palavra')
      .eq('ativo', true)

    if (error) {
      if (error.code === '42P01' || error.code === '42703') return {}
      log('Aviso palavras incompatibilidade:', error.message)
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
    return porSetor
  } catch (e) {
    log('Erro palavras incompatibilidade:', e.message)
    return {}
  }
}

/** Sinônimos gerais + por setor: { palavra_base: [{ sinonimo, peso }] } */
async function fetchSinonimosBanco(setoresIds = []) {
  const sinonimosMap = {}

  try {
    const { data: gerais, error: errG } = await supabase
      .from('sinonimos')
      .select('palavra_base, sinonimo, peso')
      .eq('ativo', true)

    if (!errG && gerais) {
      gerais.forEach((s) => {
        const base = (s.palavra_base || '').toLowerCase()
        if (!base) return
        if (!sinonimosMap[base]) sinonimosMap[base] = []
        sinonimosMap[base].push({
          sinonimo: (s.sinonimo || '').toLowerCase(),
          peso: s.peso || 1,
        })
      })
    }

    if (setoresIds.length > 0) {
      const { data: porSetor, error: errS } = await supabase
        .from('setores_sinonimos')
        .select(
          `
          sinonimos ( palavra_base, sinonimo, peso )
        `
        )
        .in('setor_id', setoresIds)
        .eq('ativo', true)

      if (!errS && porSetor) {
        porSetor.forEach((row) => {
          const s = row.sinonimos
          if (!s || !s.palavra_base) return
          const base = s.palavra_base.toLowerCase()
          if (!sinonimosMap[base]) sinonimosMap[base] = []
          sinonimosMap[base].push({
            sinonimo: (s.sinonimo || '').toLowerCase(),
            peso: s.peso || 1,
          })
        })
      }
    }

    return sinonimosMap
  } catch (e) {
    log('Erro sinônimos:', e.message)
    return {}
  }
}

async function main() {
  const inicio = Date.now()
  log(`Iniciando classificação (últimos ${DIAS} dias)...`)

  const dataFinal = new Date()
  const dataInicial = new Date()
  dataInicial.setDate(dataFinal.getDate() - DIAS)
  const dataInicialStr = dataInicial.toISOString().slice(0, 10)
  const dataFinalStr = dataFinal.toISOString().slice(0, 10)

  // 1) Setores ativos com subsetores
  const { data: setoresRows, error: errSetores } = await supabase
    .from('setores')
    .select('id, nome')
    .eq('ativo', true)
    .order('ordem')

  if (errSetores) {
    log('Erro ao carregar setores:', errSetores)
    process.exit(1)
  }

  const { data: subsetoresRows, error: errSub } = await supabase
    .from('subsetores')
    .select('id, setor_id, nome')
    .eq('ativo', true)
    .order('ordem')

  if (errSub) {
    log('Erro ao carregar subsetores:', errSub)
    process.exit(1)
  }

  const setores = (setoresRows || []).map((s) => ({
    id: s.id,
    nome: s.nome || '',
    subsetores: (subsetoresRows || [])
      .filter((ss) => ss.setor_id === s.id)
      .map((ss) => ss.nome),
  }))

  if (setores.length === 0) {
    log('Nenhum setor ativo. Encerrando.')
    process.exit(0)
  }

  log(`Setores: ${setores.length}`)

  const palavrasFortesPorSetor = await fetchPalavrasFortesPorSetor()
  const palavrasIncompatibilidadePorSetor =
    await fetchPalavrasIncompatibilidadePorSetor()
  const setoresIds = setores.map((s) => s.id)
  const sinonimosBanco = await fetchSinonimosBanco(setoresIds)

  // 2) Licitações na janela (por data_publicacao_pncp)
  let licitacoes = []
  const pageSize = 1000
  let page = 0
  let hasMore = true

  while (hasMore) {
    const { data: chunk, error } = await supabase
      .from('licitacoes')
      .select('id, objeto_compra, dados_completos, uf_sigla')
      .gte('data_publicacao_pncp', dataInicialStr)
      .lte('data_publicacao_pncp', dataFinalStr)
      .order('data_publicacao_pncp', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      log('Erro ao buscar licitações:', error.message)
      process.exit(1)
    }
    const list = chunk || []
    licitacoes = licitacoes.concat(list)
    hasMore = list.length === pageSize
    page++
    if (list.length === 0) break
  }

  // Se não filtrou por data (coluna inexistente), limitar por quantidade
  if (licitacoes.length > 15000) {
    licitacoes = licitacoes.slice(0, 15000)
    log('Limitando a 15000 licitações para esta execução.')
  }

  log(`Licitações a classificar: ${licitacoes.length}`)

  const rows = []

  for (const setor of setores) {
    const setoresAtividades = [
      { setor: setor.nome, subsetores: setor.subsetores || [] },
    ]
    const palavrasChave = extrairPalavrasChaveDosSetores(
      setoresAtividades,
      {},
      sinonimosBanco
    )

    for (const lic of licitacoes) {
      const ok = correspondeAtividades(
        lic,
        palavrasChave,
        {},
        sinonimosBanco,
        setoresAtividades,
        palavrasFortesPorSetor,
        palavrasIncompatibilidadePorSetor
      )
      if (ok) {
        rows.push({
          licitacao_id: lic.id,
          setor_id: setor.id,
          uf_sigla: lic.uf_sigla ?? null,
        })
      }
    }
  }

  log(`Inserções a gravar: ${rows.length}`)

  let inseridas = 0
  for (let i = 0; i < rows.length; i += BATCH_UPSERT) {
    const batch = rows.slice(i, i + BATCH_UPSERT)
    const { error } = await supabase.from('licitacoes_por_setor').upsert(batch, {
      onConflict: 'licitacao_id,setor_id,uf_sigla',
      ignoreDuplicates: true,
    })
    if (error) {
      log('Erro upsert batch:', error.message)
      process.exit(1)
    }
    inseridas += batch.length
    log(`Upsert ${inseridas}/${rows.length}`)
  }

  const tempo = ((Date.now() - inicio) / 1000).toFixed(1)
  log(`Concluído em ${tempo}s. Inseridas/atualizadas: ${inseridas}.`)
  process.exit(0)
}

main().catch((err) => {
  log('Erro fatal:', err)
  process.exit(1)
})
