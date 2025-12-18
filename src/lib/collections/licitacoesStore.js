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
const CACHE_DURATION = 1000 * 60 * 60 // 1 hora

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
 * Salva licitações após filtro semântico (cache otimizado) - específico por usuário
 */
export async function salvarCacheSemantico(licitacoes, userId = null) {
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
      userId, // Incluir userId no cache
    }
    
    await idb.setItem(getCacheSemanticoKey(userId), dataToSave)
    console.log(`✅ [Cache Semântico] ${licitacoes.length} licitações salvas após filtro semântico no IndexedDB (usuário: ${userId})`)
  } catch (e) {
    console.warn('⚠️ [Cache Semântico] Erro ao salvar cache no IndexedDB:', e)
  }
}

/**
 * Carrega licitações após filtro semântico - específico por usuário
 */
export async function carregarCacheSemantico(userId = null) {
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
    if (!data) return null
    
    // Validar se o cache pertence ao usuário atual
    if (data.userId !== userId) {
      console.warn('⚠️ [Cache Semântico] Cache pertence a outro usuário, limpando...')
      await limparCacheLicitacoes(userId)
      return null
    }
    
    // Verificar se cache ainda é válido (mesma duração)
    const cacheAge = Date.now() - (data.timestamp || 0)
    if (cacheAge > CACHE_DURATION) {
      console.log('⚠️ [Cache Semântico] Cache expirado')
      return null
    }

    console.log(`✅ [Cache Semântico] ${data.licitacoes?.length || 0} licitações carregadas do cache semântico no IndexedDB (usuário: ${userId})`)
    return data.licitacoes
  } catch (e) {
    console.warn('⚠️ [Cache Semântico] Erro ao carregar cache do IndexedDB:', e)
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
      // Limpar cache específico do usuário
      await idb.removeItem(getCacheKey(userId))
      await idb.removeItem(getCacheSemanticoKey(userId))
      await idb.removeItem(getCacheTimestampKey(userId))
      console.log(`✅ [Cache] Cache limpo para usuário: ${userId}`)
    } else {
      // Limpar TODOS os caches (útil no logout) - limpar por prefixo
      const count1 = await idb.clearByPrefix('licitacoes_cache_session_')
      const count2 = await idb.clearByPrefix('licitacoes_cache_semantico_')
      const count3 = await idb.clearByPrefix('licitacoes_cache_timestamp_')
      console.log(`✅ [Cache] Todos os caches de licitações limpos (${count1 + count2 + count3} itens removidos)`)
    }
  } catch (e) {
    console.warn('⚠️ [Cache] Erro ao limpar cache:', e)
  }
}

/**
 * Busca licitações do banco de dados
 * Esta função será chamada apenas UMA VEZ na primeira carga
 */
export async function buscarLicitacoesDoBanco() {
  if (!supabase) {
    console.warn('⚠️ Supabase não configurado')
    return []
  }

  try {
    console.log('📡 [Banco] Buscando licitações do banco...')
    
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
      .limit(50000) // Limite máximo

    if (error) {
      console.error('❌ [Banco] Erro ao buscar licitações:', error)
      throw error
    }

    console.log(`✅ [Banco] ${data?.length || 0} licitações carregadas do banco`)

    // Processar dados: garantir que anexos/itens sejam arrays
    const dadosProcessados = (data || []).map(licitacao => {
      // Parsear dados_completos se for string
      let dadosCompletos = licitacao.dados_completos
      if (typeof dadosCompletos === 'string') {
        try {
          dadosCompletos = JSON.parse(dadosCompletos)
        } catch (e) {
          dadosCompletos = {}
        }
      }
      
      // Garantir que anexos e itens sejam arrays válidos
      let anexos = licitacao.anexos
      if (typeof anexos === 'string') {
        try {
          anexos = JSON.parse(anexos)
        } catch (e) {
          anexos = []
        }
      }
      if (!Array.isArray(anexos)) {
        if (dadosCompletos?.anexos && Array.isArray(dadosCompletos.anexos)) {
          anexos = dadosCompletos.anexos
        } else {
          anexos = []
        }
      }
      
      let itens = licitacao.itens
      if (typeof itens === 'string') {
        try {
          itens = JSON.parse(itens)
        } catch (e) {
          itens = []
        }
      }
      if (!Array.isArray(itens)) {
        if (dadosCompletos?.itens && Array.isArray(dadosCompletos.itens)) {
          itens = dadosCompletos.itens
        } else {
          itens = []
        }
      }
      
      return {
        ...licitacao,
        dados_completos: dadosCompletos || {},
        anexos: anexos || [],
        itens: itens || []
      }
    })

    // NÃO salvar aqui - será salvo com userId quando chamado
    // salvarCacheLicitacoes precisa de userId, então será chamado de fora

    return dadosProcessados
  } catch (error) {
    console.error('❌ [Banco] Erro ao buscar licitações:', error)
    return []
  }
}

