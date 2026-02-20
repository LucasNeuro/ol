/**
 * Store para cache de licitações usando IndexedDB
 * IndexedDB oferece muito mais espaço (GBs) comparado ao sessionStorage (MBs)
 *
 * Nova dinâmica (usuário com setores):
 * - Lista vem só do banco (setor_principal_id), sem processamento no front.
 * - Cache é usado só se carregadoPorSetor === true (lista já filtrada no backend).
 * - Cache antigo (10k) é ignorado ou limpo; nunca reutilizamos para quem tem setores.
 *
 * Usuário sem setores: cache da lista completa (até 10k), filtros no cliente.
 */

import { supabase } from '../supabase'
import * as idb from '../indexedDB'

// Funções auxiliares para gerar chaves de cache específicas por usuário
const getCacheKey = (userId) => `licitacoes_cache_session_${userId || 'guest'}`
const getCacheSemanticoKey = (userId) => `licitacoes_cache_semantico_${userId || 'guest'}`
const getCacheTimestampKey = (userId) => `licitacoes_cache_timestamp_${userId || 'guest'}`
const getCacheResultadoFinalKey = (userId) => `licitacoes_resultado_final_${userId || 'guest'}`
const getCachePartialKey = (userId) => `licitacoes_cache_parcial_${userId || 'guest'}`
const CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 horas (dados brutos – ao recarregar não refaz busca; limpa no logout)
const CACHE_DURATION_SEMANTICO = 1000 * 60 * 60 * 4 // 4 horas (resultado do filtro por setor – reutilizar ao recarregar/navegar)
const CACHE_DURATION_RESULTADO_FINAL = 1000 * 60 * 60 * 24 // 24 horas (lista já filtrada – ao recarregar não refaz busca nem filtro; limpa no logout)
const CACHE_DURATION_PARCIAL = 1000 * 60 * 15 // 15 min (checkpoint durante busca do banco – retomar ao recarregar)

/**
 * Verifica se o cache é válido para um usuário específico
 */
async function isCacheValid(userId) {
  try {
    if (!idb.isAvailable()) {
      return false
    }
    
    const timestamp = await idb.getItem(getCacheTimestampKey(userId))
    if (!timestamp) {
      return false
    }
    
    // Garantir que timestamp seja número
    const timestampNum = typeof timestamp === 'number' ? timestamp : parseInt(timestamp, 10)
    if (isNaN(timestampNum)) {
      return false
    }
    
    const cacheAge = Date.now() - timestampNum
    const isValid = cacheAge < CACHE_DURATION
    
    if (!isValid) {
    } else {
    }
    
    return isValid
  } catch (e) {
    return false
  }
}

/**
 * Salva licitações no cache (IndexedDB) - específico por usuário.
 * @param {boolean} [carregadoPorSetor=false] - true se a lista veio filtrada por setor/subsetor
 * @param {string} [setoresHash=''] - hash dos setores do perfil (obrigatório quando carregadoPorSetor); usado para não reutilizar cache de outro perfil de setores
 */
export async function salvarCacheLicitacoes(licitacoes, userId = null, carregadoPorSetor = false, setoresHash = '') {
  if (!userId) {
    return
  }
  
  if (!idb.isAvailable()) {
    return
  }
  
  try {
    const dataToSave = {
      licitacoes,
      timestamp: Date.now(),
      userId,
      carregadoPorSetor: !!carregadoPorSetor,
      setoresHash: carregadoPorSetor ? (setoresHash || '') : '',
    }
    
    await idb.setItem(getCacheKey(userId), dataToSave)
    await idb.setItem(getCacheTimestampKey(userId), Date.now())
    
  } catch (e) {
  }
}

/**
 * Salva checkpoint parcial (durante busca do banco) para retomar após recarregar
 */
export async function salvarCacheParcialLicitacoes(licitacoes, userId = null) {
  if (!userId || !idb.isAvailable()) return
  try {
    await idb.setItem(getCachePartialKey(userId), {
      licitacoes,
      timestamp: Date.now(),
      userId,
    })
  } catch (e) {
  }
}

/**
 * Carrega checkpoint parcial (válido por 15 min) para retomar busca do banco
 * @returns {{ licitacoes: Array } | null}
 */
export async function carregarCacheParcialLicitacoes(userId = null) {
  if (!userId || !idb.isAvailable()) return null
  try {
    const data = await idb.getItem(getCachePartialKey(userId))
    if (!data?.licitacoes?.length) return null
    if (data.userId !== userId) return null
    const age = Date.now() - (data.timestamp || 0)
    if (age > CACHE_DURATION_PARCIAL) {
      await idb.removeItem(getCachePartialKey(userId))
      return null
    }
    return { licitacoes: data.licitacoes }
  } catch (e) {
    return null
  }
}

/**
 * Remove o checkpoint parcial (chamar quando a busca do banco terminar)
 */
export async function removerCacheParcialLicitacoes(userId = null) {
  if (!userId || !idb.isAvailable()) return
  try {
    await idb.removeItem(getCachePartialKey(userId))
  } catch (e) {
  }
}

/**
 * Carrega licitações do cache (IndexedDB) - específico por usuário
 */
export async function carregarCacheLicitacoes(userId = null) {
  if (!userId) {
    return null
  }
  
  if (!idb.isAvailable()) {
    return null
  }
  
  try {
    const isValid = await isCacheValid(userId)
    if (!isValid) {
      return null
    }

    const data = await idb.getItem(getCacheKey(userId))
    if (!data) return null
    
    // Validar se o cache pertence ao usuário atual
    if (data.userId !== userId) {
      await limparCacheLicitacoes(userId)
      return null
    }
    
    return {
      licitacoes: data.licitacoes,
      carregadoPorSetor: !!data.carregadoPorSetor,
      setoresHash: data.setoresHash || '',
    }
  } catch (e) {
    return null
  }
}

/**
 * Salva licitações após filtro semântico (cache otimizado) - específico por usuário.
 * Inclui setoresHash para não reutilizar cache quando o perfil (setores/atividades) mudar.
 */
export async function salvarCacheSemantico(licitacoes, userId = null, licitacoesTotalLength = null, setoresHash = '') {
  if (!userId) {
    return
  }
  
  if (!idb.isAvailable()) {
    return
  }
  
  try {
    const dataToSave = {
      licitacoes,
      timestamp: Date.now(),
      userId,
      licitacoesTotalLength: licitacoesTotalLength ?? licitacoes?.length,
      setoresHash: setoresHash || '',
    }
    
    await idb.setItem(getCacheSemanticoKey(userId), dataToSave)
  } catch (e) {
  }
}

/**
 * Carrega licitações após filtro semântico - específico por usuário.
 * Só retorna cache se setoresHashAtual bater com o salvo (evita usar lista de outro perfil/setores).
 */
export async function carregarCacheSemantico(userId = null, setoresHashAtual = '') {
  if (!userId) {
    return null
  }
  
  if (!idb.isAvailable()) {
    return null
  }
  
  try {
    const data = await idb.getItem(getCacheSemanticoKey(userId))
    if (!data || !data.licitacoes) return null
    
    if (data.userId !== userId) {
      await limparCacheLicitacoes(userId)
      return null
    }
    
    if ((data.setoresHash || '') !== (setoresHashAtual || '')) {
      return null
    }
    
    const cacheAge = Date.now() - (data.timestamp || 0)
    if (cacheAge > CACHE_DURATION_SEMANTICO) {
      return null
    }

    return {
      licitacoes: data.licitacoes,
      licitacoesTotalLength: data.licitacoesTotalLength ?? data.licitacoes?.length,
    }
  } catch (e) {
    return null
  }
}

/**
 * Limpa apenas o cache semântico (resultado do filtro). Usado quando os dados brutos são atualizados.
 */
export async function limparCacheSemantico(userId = null) {
  if (!userId || !idb.isAvailable()) return
  try {
    await idb.removeItem(getCacheSemanticoKey(userId))
  } catch (e) {
  }
}

/**
 * Gera hash estável dos setores/atividades do perfil (para invalidar cache quando mudar)
 * Assim, ao alterar setores cadastrados, não restauramos lista filtrada com perfil antigo.
 */
export function hashSetoresAtividades(setoresAtividades = null) {
  if (!setoresAtividades || !Array.isArray(setoresAtividades) || setoresAtividades.length === 0) {
    return 'sem_setores'
  }
  const normalized = setoresAtividades.map(s => ({
    setor: (s.setor || '').trim(),
    subsetores: Array.isArray(s.subsetores) ? s.subsetores.map(x => (x || '').trim()).sort() : [],
  }))
  return JSON.stringify(normalized)
}

/**
 * Gera hash dos filtros aplicados (para validar cache do resultado final).
 * Inclui setores_atividades para que mudança no perfil invalide o cache.
 */
export function hashFiltrosAplicados(filtros = {}, mostrarTodasLicitacoes = false, setoresAtividades = null) {
  const excluirAtiv = Array.isArray(filtros.excluirAtividadesIds) ? filtros.excluirAtividadesIds.sort() : []
  const o = {
    buscaObjeto: (filtros.buscaObjeto || '').trim(),
    excluirPalavras: (filtros.excluirPalavras || '').trim(),
    uf: (filtros.uf || '').trim(),
    statusEdital: (filtros.statusEdital || '').trim(),
    excluirAtividadesIds: JSON.stringify(excluirAtiv),
    dataPublicacaoInicio: (filtros.dataPublicacaoInicio || '').trim(),
    dataPublicacaoFim: (filtros.dataPublicacaoFim || '').trim(),
    valorMin: (filtros.valorMin || '').trim(),
    valorMax: (filtros.valorMax || '').trim(),
    comDocumentos: !!filtros.comDocumentos,
    comItens: !!filtros.comItens,
    comValor: !!filtros.comValor,
    mostrarTodas: !!mostrarTodasLicitacoes,
    setores: hashSetoresAtividades(setoresAtividades),
  }
  return JSON.stringify(o)
}

/**
 * Salva o resultado final (lista já filtrada) para reutilizar ao recarregar/navegar.
 * Evita refazer busca e filtragem.
 */
export async function salvarResultadoFinal(licitacoes, userId = null, filtrosHash = '') {
  if (!userId || !idb.isAvailable()) return
  try {
    await idb.setItem(getCacheResultadoFinalKey(userId), {
      licitacoes,
      filtrosHash,
      timestamp: Date.now(),
      userId,
    })
  } catch (e) {
  }
}

/**
 * Carrega o resultado final do cache. Retorna null se expirado ou hash diferente.
 * @returns {{ licitacoes: Array, filtrosHash: string } | null}
 */
export async function carregarResultadoFinal(userId = null, filtrosHashAtual = '') {
  if (!userId || !idb.isAvailable()) return null
  try {
    const data = await idb.getItem(getCacheResultadoFinalKey(userId))
    if (!data || !Array.isArray(data.licitacoes)) return null
    if (data.userId !== userId) return null
    const age = Date.now() - (data.timestamp || 0)
    if (age > CACHE_DURATION_RESULTADO_FINAL) return null
    if ((data.filtrosHash || '') !== filtrosHashAtual) return null
    return { licitacoes: data.licitacoes, filtrosHash: data.filtrosHash }
  } catch (e) {
    return null
  }
}

/**
 * Limpa o cache de um usuário específico (ou todos se userId não fornecido)
 */
export async function limparCacheLicitacoes(userId = null) {
  if (!idb.isAvailable()) {
    return
  }
  
  try {
    if (userId) {
      // Limpar cache específico do usuário (inclui checkpoint parcial)
      await idb.removeItem(getCacheKey(userId))
      await idb.removeItem(getCacheSemanticoKey(userId))
      await idb.removeItem(getCacheTimestampKey(userId))
      await idb.removeItem(getCacheResultadoFinalKey(userId))
      await idb.removeItem(getCachePartialKey(userId))
    } else {
      // Limpar TODOS os caches (útil no logout) - limpar por prefixo
      const count1 = await idb.clearByPrefix('licitacoes_cache_session_')
      const count2 = await idb.clearByPrefix('licitacoes_cache_semantico_')
      const count3 = await idb.clearByPrefix('licitacoes_cache_timestamp_')
      const count4 = await idb.clearByPrefix('licitacoes_resultado_final_')
      const count5 = await idb.clearByPrefix('licitacoes_cache_parcial_')
    }
  } catch (e) {
  }
}

/**
 * Processa um lote bruto do Supabase para o formato usado na aplicação
 */
function processarLoteLicitacoes(data) {
  if (!data || !Array.isArray(data)) return []
  return data.map(licitacao => {
    let dadosCompletos = licitacao.dados_completos
    if (typeof dadosCompletos === 'string') {
      try { dadosCompletos = JSON.parse(dadosCompletos) } catch (e) { dadosCompletos = {} }
    }
    let anexos = licitacao.anexos
    if (typeof anexos === 'string') {
      try { anexos = JSON.parse(anexos) } catch (e) { anexos = [] }
    }
    if (!Array.isArray(anexos)) {
      anexos = dadosCompletos?.anexos && Array.isArray(dadosCompletos.anexos) ? dadosCompletos.anexos : []
    }
    let itens = licitacao.itens
    if (typeof itens === 'string') {
      try { itens = JSON.parse(itens) } catch (e) { itens = [] }
    }
    if (!Array.isArray(itens)) {
      itens = dadosCompletos?.itens && Array.isArray(dadosCompletos.itens) ? dadosCompletos.itens : []
    }
    return {
      ...licitacao,
      dados_completos: dadosCompletos || {},
      anexos: anexos || [],
      itens: itens || []
    }
  })
}

const LICITACOES_SELECT = `
  id,
  numero_controle_pncp,
  objeto_compra,
  data_publicacao_pncp,
  data_atualizacao,
  uf_sigla,
  modalidade_nome,
  orgao_razao_social,
  valor_total_estimado,
  subsetor_principal_id,
  dados_completos,
  anexos,
  itens
`

/** Flag: última carga veio filtrada por classificação no backend. Front não deve rodar filtro semântico. */
let _lastLoadWasPreFiltered = false
export function setLastLoadWasPreFiltered(value) {
  _lastLoadWasPreFiltered = !!value
}
export function getLastLoadWasPreFiltered() {
  return _lastLoadWasPreFiltered
}

/** Flag: última carga foi fallback (todas de licitacoes, sem classificação). Exibir direto, sem filtro semântico. */
let _lastLoadWasFallbackAll = false
export function setLastLoadWasFallbackAll(value) {
  _lastLoadWasFallbackAll = !!value
}
export function getLastLoadWasFallbackAll() {
  return _lastLoadWasFallbackAll
}

/**
 * Resolve setores_atividades do perfil para IDs (setores.id e subsetores.id).
 * O cadastro pode salvar com nomes: { setor: "Alimentação", subsetores: ["Gêneros alimentícios", ...] }.
 * Retorna { setorIds: uuid[], subsetorIds: uuid[] } para usar em licitacoes.setor_principal_id e subsetor_principal_id.
 */
async function resolverSetoresAtividadesParaIds(setoresAtividades) {
  if (!supabase || !setoresAtividades?.length) return { setorIds: [], subsetorIds: [] }
  const setorIds = setoresAtividades.map(s => s.setor_id || s.id).filter(Boolean)
  const subsetorIds = []
  setoresAtividades.forEach(s => {
    if (Array.isArray(s.subsetor_ids) && s.subsetor_ids.length) subsetorIds.push(...s.subsetor_ids)
  })
  if (setorIds.length > 0) {
    return { setorIds, subsetorIds: [...new Set(subsetorIds)] }
  }
  const { data: setores } = await supabase.from('setores').select('id, nome').eq('ativo', true)
  const { data: subsetores } = await supabase.from('subsetores').select('id, setor_id, nome').eq('ativo', true)
  if (!setores?.length) return { setorIds: [], subsetorIds: [] }
  const byNomeSetor = Object.fromEntries((setores || []).map(s => [String(s.nome).trim().toLowerCase(), s.id]))
  const byNomeSubsetor = {}
  ;(subsetores || []).forEach(sub => {
    const k = String(sub.nome).trim().toLowerCase()
    if (!byNomeSubsetor[k]) byNomeSubsetor[k] = []
    byNomeSubsetor[k].push({ id: sub.id, setor_id: sub.setor_id })
  })
  const resolvedSetorIds = []
  const resolvedSubsetorIds = []
  setoresAtividades.forEach(item => {
    const nomeSetor = (item.setor || '').trim()
    const idSetor = byNomeSetor[nomeSetor.toLowerCase()]
    if (idSetor) {
      resolvedSetorIds.push(idSetor)
      const nomesSub = Array.isArray(item.subsetores) ? item.subsetores : []
      nomesSub.forEach(nomeSub => {
        const subs = byNomeSubsetor[String(nomeSub).trim().toLowerCase()]
        if (subs) {
          const subDoSetor = subs.find(s => s.setor_id === idSetor)
          if (subDoSetor) resolvedSubsetorIds.push(subDoSetor.id)
        }
      })
    }
  })
  return {
    setorIds: [...new Set(resolvedSetorIds)],
    subsetorIds: [...new Set(resolvedSubsetorIds)]
  }
}

/**
 * Retorna lista de subsetores (atividades) com IDs para os setores_atividades do perfil.
 * Usado no filtro "Excluir atividades" para mapear nome -> id.
 * @param {Array} setoresAtividades - Ex.: [{ setor: "Alimentação", subsetores: ["Gêneros alimentícios", ...] }]
 * @returns {Promise<Array<{ nome: string, id: string, setor: string }>>}
 */
export async function resolverSubsetoresComIds(setoresAtividades) {
  if (!supabase || !setoresAtividades?.length) return []
  const { data: setores } = await supabase.from('setores').select('id, nome').eq('ativo', true)
  const { data: subsetores } = await supabase.from('subsetores').select('id, setor_id, nome').eq('ativo', true)
  if (!setores?.length || !subsetores?.length) return []
  const byNomeSetor = Object.fromEntries((setores || []).map(s => [String(s.nome).trim().toLowerCase(), s]))
  const bySetorId = Object.fromEntries((subsetores || []).map(sub => [sub.id, sub]))
  const resultado = []
  setoresAtividades.forEach(item => {
    const nomeSetor = (item.setor || '').trim()
    const setorObj = byNomeSetor[nomeSetor.toLowerCase()]
    if (!setorObj) return
    const nomesSub = Array.isArray(item.subsetores) ? item.subsetores : []
    const subsDoSetor = (subsetores || []).filter(s => s.setor_id === setorObj.id)
    nomesSub.forEach(nomeSub => {
      const sub = subsDoSetor.find(s => String(s.nome).trim().toLowerCase() === String(nomeSub).trim().toLowerCase())
      if (sub) resultado.push({ nome: sub.nome, id: sub.id, setor: nomeSetor })
    })
  })
  return resultado
}

/**
 * Busca licitações já classificadas na tabela licitacoes.
 * Filtra sempre por setor E subsetor (como no cadastro da empresa): setor_principal_id (FK setores.id),
 * subsetor_principal_id (FK subsetores.id). Aceita perfil com setores_atividades em nomes (setor, subsetores)
 * ou em IDs (setor_id, subsetor_ids). Ordenação: mais recentes primeiro. Nenhum processamento no front.
 *
 * @param {{ setores_atividades: Array, estados_interesse?: Array }} perfil
 * @returns {Promise<Array>} Lista no mesmo formato de buscarLicitacoesDoBanco
 */
export async function buscarLicitacoesPorClassificacaoPrincipal(perfil) {
  if (!supabase || !perfil?.setores_atividades?.length) return []
  const { setorIds, subsetorIds } = await resolverSetoresAtividadesParaIds(perfil.setores_atividades)
  if (setorIds.length === 0) return []


  try {
    let q = supabase
      .from('licitacoes')
      .select(LICITACOES_SELECT)
      .in('setor_principal_id', setorIds)
      .order('data_publicacao_pncp', { ascending: false })

    if (subsetorIds.length > 0) {
      q = q.in('subsetor_principal_id', subsetorIds)
    }

    const estadosInteresse = perfil.estados_interesse || []
    const temNacional = estadosInteresse.some(e => String(e).toUpperCase() === 'NACIONAL')
    if (!temNacional && estadosInteresse.length > 0) {
      const ufList = estadosInteresse.map(e => String(e).toUpperCase())
      q = q.in('uf_sigla', ufList)
    }

    const { data, error } = await q.limit(10000)

    if (error) {
      return []
    }
    const todas = processarLoteLicitacoes(data || [])
    if (todas.length > 0) {
    }
    return todas
  } catch (e) {
    return []
  }
}

/**
 * Busca as licitações mais recentes do banco (COM PAGINAÇÃO).
 * Ordenação: data_publicacao_pncp DESC — só os N mais recentes.
 * Suporta retomar a partir de cache parcial (checkpoint ao recarregar).
 * @param {Function} onProgress - Callback opcional (buscados, total)
 * @param {number} maxRegistros - Máximo de registros (default: 10000)
 * @param {Object} opts - { licitacoesIniciais: Array, onSavePartial: (arr) => Promise } para retomar e salvar checkpoint a cada lote
 */
export async function buscarLicitacoesDoBanco(onProgress = null, maxRegistros = 10000, opts = {}) {
  if (!supabase) {
    return []
  }

  const TAMANHO_LOTE = 1000
  const { licitacoesIniciais = [], onSavePartial } = opts
  const todasLicitacoes = Array.isArray(licitacoesIniciais) && licitacoesIniciais.length > 0
    ? [...licitacoesIniciais]
    : []
  let offset = todasLicitacoes.length
  let continuar = true

  try {
    if (todasLicitacoes.length > 0) {
    } else {
    }

    while (continuar && todasLicitacoes.length < maxRegistros) {
      const { data, error } = await supabase
        .from('licitacoes')
        .select(LICITACOES_SELECT)
        .order('data_publicacao_pncp', { ascending: false })
        .range(offset, offset + TAMANHO_LOTE - 1)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        continuar = false
      } else {
        const processados = processarLoteLicitacoes(data)
        todasLicitacoes.push(...processados)
        offset += data.length
        if (onProgress) onProgress(todasLicitacoes.length, maxRegistros)
        if (typeof onSavePartial === 'function') {
          await onSavePartial(todasLicitacoes)
        }
        if (data.length < TAMANHO_LOTE) continuar = false
      }
    }

    return todasLicitacoes
  } catch (error) {
    return todasLicitacoes.length > 0 ? todasLicitacoes : []
  }
}

