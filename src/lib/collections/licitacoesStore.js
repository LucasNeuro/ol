/**
 * Store para cache de licitações usando IndexedDB
 * IndexedDB oferece muito mais espaço (GBs) comparado ao sessionStorage (MBs)
 * 
 * Funcionalidades:
 * 1. Carrega licitações do banco uma vez
 * 2. Armazena em cache (IndexedDB) - específico por usuário
 * 3. Todos os filtros funcionam no cliente
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
      console.warn('⚠️ [Cache] IndexedDB não disponível')
      return false
    }
    
    const timestamp = await idb.getItem(getCacheTimestampKey(userId))
    if (!timestamp) {
      console.log(`⚠️ [Cache] Timestamp não encontrado para usuário: ${userId}`)
      return false
    }
    
    // Garantir que timestamp seja número
    const timestampNum = typeof timestamp === 'number' ? timestamp : parseInt(timestamp, 10)
    if (isNaN(timestampNum)) {
      console.warn(`⚠️ [Cache] Timestamp inválido para usuário ${userId}:`, timestamp)
      return false
    }
    
    const cacheAge = Date.now() - timestampNum
    const isValid = cacheAge < CACHE_DURATION
    
    if (!isValid) {
      console.log(`⚠️ [Cache] Cache expirado para usuário ${userId} (idade: ${Math.floor(cacheAge / 1000 / 60)} minutos, limite: ${Math.floor(CACHE_DURATION / 1000 / 60)} minutos)`)
    } else {
      console.log(`✅ [Cache] Cache válido para usuário ${userId} (idade: ${Math.floor(cacheAge / 1000 / 60)} minutos)`)
    }
    
    return isValid
  } catch (e) {
    console.warn('⚠️ [Cache] Erro ao verificar validade do cache:', e)
    return false
  }
}

/**
 * Salva licitações no cache (IndexedDB) - específico por usuário
 */
export async function salvarCacheLicitacoes(licitacoes, userId = null) {
  if (!userId) {
    console.warn('⚠️ [Cache] userId não fornecido, não salvando cache')
    return
  }
  
  if (!idb.isAvailable()) {
    console.warn('⚠️ [Cache] IndexedDB não disponível, não foi possível salvar cache')
    return
  }
  
  try {
    const dataToSave = {
      licitacoes,
      timestamp: Date.now(),
      userId, // Incluir userId no cache para validação
    }
    
    // Salvar dados e timestamp no IndexedDB
    await idb.setItem(getCacheKey(userId), dataToSave)
    await idb.setItem(getCacheTimestampKey(userId), Date.now())
    
    console.log(`✅ [Cache] ${licitacoes.length} licitações salvas no IndexedDB (usuário: ${userId})`)
  } catch (e) {
    console.warn('⚠️ [Cache] Erro ao salvar cache no IndexedDB:', e)
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
    console.warn('⚠️ [Cache Parcial] Erro ao salvar:', e)
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
    console.log(`✅ [Cache Parcial] ${data.licitacoes.length} licitações (retomando busca)`)
    return { licitacoes: data.licitacoes }
  } catch (e) {
    console.warn('⚠️ [Cache Parcial] Erro ao carregar:', e)
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
    console.warn('⚠️ [Cache Parcial] Erro ao remover:', e)
  }
}

/**
 * Carrega licitações do cache (IndexedDB) - específico por usuário
 */
export async function carregarCacheLicitacoes(userId = null) {
  if (!userId) {
    console.log('⚠️ [Cache] userId não fornecido, não carregando cache')
    return null
  }
  
  if (!idb.isAvailable()) {
    console.warn('⚠️ [Cache] IndexedDB não disponível')
    return null
  }
  
  try {
    const isValid = await isCacheValid(userId)
    if (!isValid) {
      console.log('⚠️ [Cache] Cache expirado ou inexistente para usuário:', userId)
      return null
    }

    const data = await idb.getItem(getCacheKey(userId))
    if (!data) return null
    
    // Validar se o cache pertence ao usuário atual
    if (data.userId !== userId) {
      console.warn('⚠️ [Cache] Cache pertence a outro usuário, limpando...')
      await limparCacheLicitacoes(userId)
      return null
    }
    
    console.log(`✅ [Cache] ${data.licitacoes?.length || 0} licitações carregadas do IndexedDB (usuário: ${userId})`)
    return data.licitacoes
  } catch (e) {
    console.warn('⚠️ [Cache] Erro ao carregar cache do IndexedDB:', e)
    return null
  }
}

/**
 * Salva licitações após filtro semântico (cache otimizado) - específico por usuário.
 * Inclui setoresHash para não reutilizar cache quando o perfil (setores/atividades) mudar.
 */
export async function salvarCacheSemantico(licitacoes, userId = null, licitacoesTotalLength = null, setoresHash = '') {
  if (!userId) {
    console.warn('⚠️ [Cache Semântico] userId não fornecido, não salvando cache')
    return
  }
  
  if (!idb.isAvailable()) {
    console.warn('⚠️ [Cache Semântico] IndexedDB não disponível, não foi possível salvar cache')
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
    console.log(`✅ [Cache Semântico] ${licitacoes.length} licitações salvas após filtro semântico no IndexedDB (usuário: ${userId})`)
  } catch (e) {
    console.warn('⚠️ [Cache Semântico] Erro ao salvar cache no IndexedDB:', e)
  }
}

/**
 * Carrega licitações após filtro semântico - específico por usuário.
 * Só retorna cache se setoresHashAtual bater com o salvo (evita usar lista de outro perfil/setores).
 */
export async function carregarCacheSemantico(userId = null, setoresHashAtual = '') {
  if (!userId) {
    console.log('⚠️ [Cache Semântico] userId não fornecido, não carregando cache')
    return null
  }
  
  if (!idb.isAvailable()) {
    console.warn('⚠️ [Cache Semântico] IndexedDB não disponível')
    return null
  }
  
  try {
    const data = await idb.getItem(getCacheSemanticoKey(userId))
    if (!data || !data.licitacoes) return null
    
    if (data.userId !== userId) {
      console.warn('⚠️ [Cache Semântico] Cache pertence a outro usuário, limpando...')
      await limparCacheLicitacoes(userId)
      return null
    }
    
    if ((data.setoresHash || '') !== (setoresHashAtual || '')) {
      console.log('⚠️ [Cache Semântico] Setores/atividades mudaram, ignorando cache antigo')
      return null
    }
    
    const cacheAge = Date.now() - (data.timestamp || 0)
    if (cacheAge > CACHE_DURATION_SEMANTICO) {
      console.log('⚠️ [Cache Semântico] Cache expirado (idade:', Math.round(cacheAge / 60000), 'min)')
      return null
    }

    console.log(`✅ [Cache Semântico] ${data.licitacoes?.length || 0} licitações do cache (usuário: ${userId})`)
    return {
      licitacoes: data.licitacoes,
      licitacoesTotalLength: data.licitacoesTotalLength ?? data.licitacoes?.length,
    }
  } catch (e) {
    console.warn('⚠️ [Cache Semântico] Erro ao carregar cache do IndexedDB:', e)
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
    console.log(`✅ [Cache] Cache semântico limpo para usuário: ${userId}`)
  } catch (e) {
    console.warn('⚠️ [Cache] Erro ao limpar cache semântico:', e)
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
  const o = {
    buscaObjeto: (filtros.buscaObjeto || '').trim(),
    excluirPalavras: (filtros.excluirPalavras || '').trim(),
    uf: (filtros.uf || '').trim(),
    modalidade: (filtros.modalidade || '').trim(),
    statusEdital: (filtros.statusEdital || '').trim(),
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
    console.log(`✅ [Cache Resultado Final] ${licitacoes?.length ?? 0} licitações salvas (usuário: ${userId})`)
  } catch (e) {
    console.warn('⚠️ [Cache Resultado Final] Erro ao salvar:', e)
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
    console.log(`✅ [Cache Resultado Final] ${data.licitacoes.length} licitações carregadas (sem refazer busca/filtro)`)
    return { licitacoes: data.licitacoes, filtrosHash: data.filtrosHash }
  } catch (e) {
    console.warn('⚠️ [Cache Resultado Final] Erro ao carregar:', e)
    return null
  }
}

/**
 * Limpa o cache de um usuário específico (ou todos se userId não fornecido)
 */
export async function limparCacheLicitacoes(userId = null) {
  if (!idb.isAvailable()) {
    console.warn('⚠️ [Cache] IndexedDB não disponível')
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
      console.log(`✅ [Cache] Cache limpo para usuário: ${userId}`)
    } else {
      // Limpar TODOS os caches (útil no logout) - limpar por prefixo
      const count1 = await idb.clearByPrefix('licitacoes_cache_session_')
      const count2 = await idb.clearByPrefix('licitacoes_cache_semantico_')
      const count3 = await idb.clearByPrefix('licitacoes_cache_timestamp_')
      const count4 = await idb.clearByPrefix('licitacoes_resultado_final_')
      const count5 = await idb.clearByPrefix('licitacoes_cache_parcial_')
      console.log(`✅ [Cache] Todos os caches de licitações limpos (${count1 + count2 + count3 + count4 + count5} itens removidos)`)
    }
  } catch (e) {
    console.warn('⚠️ [Cache] Erro ao limpar cache:', e)
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
    console.warn('⚠️ Supabase não configurado')
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
      console.log(`📡 [Banco] Retomando busca: ${todasLicitacoes.length} já em cache, buscando a partir de offset ${offset}...`)
    } else {
      console.log(`📡 [Banco] Buscando até ${maxRegistros.toLocaleString('pt-BR')} licitações mais recentes (paginado)...`)
    }

    while (continuar && todasLicitacoes.length < maxRegistros) {
      const { data, error } = await supabase
        .from('licitacoes')
        .select(`
          id,
          numero_controle_pncp,
          objeto_compra,
          data_publicacao_pncp,
          data_atualizacao,
          uf_sigla,
          modalidade_nome,
          orgao_razao_social,
          valor_total_estimado,
          dados_completos,
          anexos,
          itens
        `)
        .order('data_publicacao_pncp', { ascending: false })
        .range(offset, offset + TAMANHO_LOTE - 1)

      if (error) {
        console.error('❌ [Banco] Erro ao buscar licitações:', error)
        throw error
      }

      if (!data || data.length === 0) {
        continuar = false
      } else {
        const processados = processarLoteLicitacoes(data)
        todasLicitacoes.push(...processados)
        offset += data.length
        if (onProgress) onProgress(todasLicitacoes.length, maxRegistros)
        console.log(`📡 [Banco] ${todasLicitacoes.length} licitações carregadas...`)
        if (typeof onSavePartial === 'function') {
          await onSavePartial(todasLicitacoes)
        }
        if (data.length < TAMANHO_LOTE) continuar = false
      }
    }

    console.log(`✅ [Banco] ${todasLicitacoes.length} licitações carregadas do banco (total)`)
    return todasLicitacoes
  } catch (error) {
    console.error('❌ [Banco] Erro ao buscar licitações:', error)
    return todasLicitacoes.length > 0 ? todasLicitacoes : []
  }
}

