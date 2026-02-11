/**
 * Validação de correspondência usando Edge Function com IA
 * Usa Mistral AI para validar se licitação corresponde às atividades da empresa
 */

/**
 * Valida correspondência usando Edge Function com IA (Mistral).
 * Atividades e estados vêm do cadastro (setores_atividades e estados_interesse).
 * @param {string} objetoLicitacao - Objeto completo da licitação
 * @param {Array} atividadesEmpresa - Array de atividades do perfil (setores_atividades: { setor, subsetores })
 * @param {string} userId - ID do usuário (opcional, para cache)
 * @param {string[]} estadosInteresse - Estados de interesse do cadastro (estados_interesse). Nacional ou vazio = não restringir
 * @returns {Promise<boolean|null>} - true se corresponde, false se não corresponde, null se erro/indisponível
 */
export async function validarCorrespondenciaIAEdgeFunction(
  objetoLicitacao,
  atividadesEmpresa,
  userId = null,
  estadosInteresse = null
) {
  if (!objetoLicitacao || !atividadesEmpresa || atividadesEmpresa.length === 0) {
    return null
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      console.warn('⚠️ [IA] VITE_SUPABASE_URL não configurado')
      return null
    }

    const { supabase } = await import('@/lib/supabase')
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

    const body = {
      objetoLicitacao,
      atividadesEmpresa,
      userId,
    }
    if (estadosInteresse && Array.isArray(estadosInteresse) && estadosInteresse.length > 0) {
      body.estadosInteresse = estadosInteresse
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/validar-correspondencia-ia`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
      console.warn('⚠️ [IA] Erro na Edge Function:', errorData.error || response.status)
      return null // Retornar null para usar filtro semântico como fallback
    }

    const result = await response.json()

    // Se IA não está disponível ou retornou null, usar filtro semântico
    if (result.resultado === null) {
      return null
    }

    return result.resultado === true
  } catch (error) {
    console.warn('⚠️ [IA] Erro ao validar com IA, usando filtro semântico:', error.message)
    return null // Retornar null para usar filtro semântico como fallback
  }
}

/**
 * Filtro híbrido: combina filtro semântico + IA para máxima precisão e cobertura
 * 
 * Estratégia:
 * 1. Filtro semântico rápido para casos claros (aceita/rejeita diretamente)
 * 2. IA apenas para casos duvidosos (pontuação média) para aumentar cobertura
 * 
 * @param {Object} licitacao - Objeto da licitação
 * @param {Object} palavrasChave - Palavras-chave extraídas dos setores
 * @param {Object} sinonimosPersonalizados - Sinônimos personalizados
 * @param {Object} sinonimosBanco - Sinônimos do banco
 * @param {Array} setoresAtividades - Atividades completas da empresa
 * @param {Function} correspondeAtividades - Função do filtro semântico
 * @param {boolean} usarIA - Se true, usa IA para casos duvidosos
 * @returns {Promise<boolean>} - true se deve mostrar, false se não deve
 */
export async function correspondeAtividadesHibrido(
  licitacao,
  palavrasChave,
  sinonimosPersonalizados,
  sinonimosBanco,
  setoresAtividades,
  correspondeAtividades,
  usarIA = false
) {
  // Se não tem palavras-chave, mostrar tudo
  if (!palavrasChave || palavrasChave.todas?.length === 0) {
    return true
  }

  const { obterObjetoCompleto } = await import('@/lib/filtroSemantico')
  const objetoCompleto = obterObjetoCompleto(licitacao)
  if (!objetoCompleto) {
    return false // Sem objeto, não mostrar
  }

  // PASSO 1: Aplicar filtro semântico primeiro (rápido)
  const resultadoSemantico = correspondeAtividades(
    licitacao,
    palavrasChave,
    sinonimosPersonalizados,
    sinonimosBanco,
    setoresAtividades
  )

  // Se resultado é claro (true), aceitar diretamente
  if (resultadoSemantico === true) {
    return true
  }

  // Se resultado é claro (false) e não queremos usar IA, rejeitar
  if (resultadoSemantico === false && !usarIA) {
    return false
  }

  // PASSO 2: Se resultado é duvidoso (false mas queremos validar com IA)
  // OU se queremos usar IA para aumentar cobertura
  if (usarIA && setoresAtividades && setoresAtividades.length > 0) {
    try {
      // Validar com IA apenas para casos que o filtro semântico rejeitou
      // mas que podem ser relevantes (aumentar cobertura)
      const validacaoIA = await validarCorrespondenciaIAEdgeFunction(
        objetoCompleto,
        setoresAtividades,
        null // userId opcional
      )

      // Se IA confirmou, aceitar mesmo que filtro semântico tenha rejeitado
      if (validacaoIA === true) {
        console.log('✅ [IA] Licitação aceita por IA (filtro semântico havia rejeitado):', {
          objeto: objetoCompleto.substring(0, 100)
        })
        return true
      }

      // Se IA rejeitou, manter rejeição
      if (validacaoIA === false) {
        return false
      }

      // Se IA retornou null (erro/indisponível), usar resultado do filtro semântico
      return resultadoSemantico
    } catch (error) {
      console.warn('⚠️ [IA] Erro ao validar com IA, usando filtro semântico:', error)
      return resultadoSemantico
    }
  }

  // Se não usar IA, retornar resultado do filtro semântico
  return resultadoSemantico
}

const TAMANHO_LOTE_IA = 50
const TIMEOUT_EDGE_FN_MS = 90 * 1000 // 90s por lote — evita travar se a Edge Function não responder

// ===== CACHE DE VALIDAÇÃO IA (IndexedDB) =====
const CACHE_DB_NAME = 'validacao-ia-cache'
const CACHE_STORE_NAME = 'resultados'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24 horas

let cacheDb = null

async function abrirCacheIA() {
  if (cacheDb) return cacheDb
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      cacheDb = request.result
      resolve(cacheDb)
    }
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'chave' })
      }
    }
  })
}

function gerarChaveCache(licitacaoId, setoresHash) {
  return `${licitacaoId}_${setoresHash}`
}

function hashSetores(setoresAtividades) {
  const str = JSON.stringify(setoresAtividades.map(s => ({ setor: s.setor, subsetores: s.subsetores || [] })))
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(36)
}

async function lerCacheIA(chaves) {
  try {
    const db = await abrirCacheIA()
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE_NAME, 'readonly')
      const store = tx.objectStore(CACHE_STORE_NAME)
      const resultados = {}
      const agora = Date.now()
      let pendentes = chaves.length
      if (pendentes === 0) return resolve(resultados)
      for (const chave of chaves) {
        const req = store.get(chave)
        req.onsuccess = () => {
          const item = req.result
          if (item && (agora - item.timestamp) < CACHE_TTL_MS) {
            resultados[chave] = item.resultado
          }
          if (--pendentes === 0) resolve(resultados)
        }
        req.onerror = () => { if (--pendentes === 0) resolve(resultados) }
      }
    })
  } catch {
    return {}
  }
}

async function salvarCacheIA(itens) {
  try {
    const db = await abrirCacheIA()
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite')
    const store = tx.objectStore(CACHE_STORE_NAME)
    const agora = Date.now()
    for (const { chave, resultado } of itens) {
      store.put({ chave, resultado, timestamp: agora })
    }
  } catch { /* ignora */ }
}

/**
 * Limpa todo o cache de validação IA (IndexedDB validacao-ia-cache).
 * Deve ser chamado no logout para não deixar dados do usuário e liberar espaço.
 */
export async function limparCacheValidacaoIA() {
  try {
    if (typeof indexedDB === 'undefined') return
    const db = await abrirCacheIA()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE_NAME, 'readwrite')
      const store = tx.objectStore(CACHE_STORE_NAME)
      const req = store.clear()
      req.onsuccess = () => {
        cacheDb = null
        console.log('✅ [IA] Cache de validação IA limpo')
        resolve()
      }
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.warn('⚠️ [IA] Erro ao limpar cache no logout:', e)
  }
}

/**
 * Valida em lote se as licitações correspondem semanticamente às atividades da empresa (IA).
 * Usa setores_atividades e estados_interesse do cadastro (perfil) no prompt.
 * CACHE: resultados são armazenados no IndexedDB por 24h para evitar revalidar a mesma licitação.
 * @param {Array} licitacoes - Lista de licitações (objetos com id e dados para obterObjetoCompleto)
 * @param {Array} setoresAtividades - Setores do perfil (setores_atividades: { setor, subsetores })
 * @param {Function} obterObjetoCompleto - Função para extrair texto do objeto da licitação
 * @param {Function} onProgress - (opcional) callback(validados, total) durante o processamento
 * @param {string[]} estadosInteresse - (opcional) estados_interesse do cadastro; Nacional ou vazio = não restringir no prompt
 * @returns {Promise<Set<string>>} Set de ids das licitações que a IA considerou relacionadas
 */
export async function validarCorrespondenciaIABatch(
  licitacoes,
  setoresAtividades,
  obterObjetoCompleto,
  onProgress = null,
  estadosInteresse = null
) {
  if (!licitacoes?.length || !setoresAtividades?.length) {
    return new Set(licitacoes?.map(l => l.id) || [])
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    console.warn('⚠️ [IA] VITE_SUPABASE_URL não configurado')
    return new Set()
  }

  const setoresHash = hashSetores(setoresAtividades)

  // 1) Verificar cache para todas as licitações
  const chavesCache = licitacoes.map(lic => gerarChaveCache(lic.id, setoresHash))
  const cacheExistente = await lerCacheIA(chavesCache)

  const idsAprovados = new Set()
  const licitacoesParaValidar = []

  for (let i = 0; i < licitacoes.length; i++) {
    const chave = chavesCache[i]
    if (chave in cacheExistente) {
      if (cacheExistente[chave] === true) idsAprovados.add(licitacoes[i].id)
    } else {
      licitacoesParaValidar.push(licitacoes[i])
    }
  }

  const totalOriginal = licitacoes.length
  const doCache = totalOriginal - licitacoesParaValidar.length
  if (doCache > 0) {
    console.log(`✅ [IA Cache] ${doCache} licitações já validadas (cache), ${licitacoesParaValidar.length} para validar`)
  }

  if (licitacoesParaValidar.length === 0) {
    if (onProgress) onProgress(totalOriginal, totalOriginal)
    return idsAprovados
  }

  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
    let validados = doCache

    for (let i = 0; i < licitacoesParaValidar.length; i += TAMANHO_LOTE_IA) {
      const lote = licitacoesParaValidar.slice(i, i + TAMANHO_LOTE_IA)
      const lotes = lote
        .map(lic => {
          const objeto = obterObjetoCompleto(lic)
          return objeto ? { id: lic.id, objeto } : null
        })
        .filter(Boolean)

      if (lotes.length === 0) {
        validados += lote.length
        if (onProgress) onProgress(validados, totalOriginal)
        continue
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_EDGE_FN_MS)
      let response
      try {
        response = await fetch(
          `${supabaseUrl}/functions/v1/validar-correspondencia-ia`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({
              lotes,
              atividadesEmpresa: setoresAtividades,
              ...(estadosInteresse && Array.isArray(estadosInteresse) && estadosInteresse.length > 0
                ? { estadosInteresse }
                : {}),
            }),
            signal: controller.signal,
          }
        )
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        if (fetchErr.name === 'AbortError') {
          console.warn('⚠️ [IA] Timeout na Edge Function (validar-correspondencia-ia). Mantendo resultado do filtro semântico (fail-open).')
        } else {
          console.warn('⚠️ [IA] Erro de rede na Edge Function:', fetchErr.message)
        }
        // Fail-open: aprovar as que ainda não foram validadas para não zerar a lista
        licitacoesParaValidar.slice(i).forEach(lic => idsAprovados.add(lic.id))
        break
      }
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        const isRateLimit = response.status === 429 || (errorBody && (errorBody.error === 'RATE_LIMIT' || String(errorBody.error || '').includes('RATE_LIMIT')))
        console.warn('⚠️ [IA] Edge Function retornou erro:', response.status, errorBody.error || response.statusText)
        // Fail-open: em RATE_LIMIT ou 500, aprovar as que ainda não foram validadas para não zerar a lista
        if (isRateLimit || response.status >= 500) {
          licitacoesParaValidar.slice(i).forEach(lic => idsAprovados.add(lic.id))
          console.warn('⚠️ [IA] RATE_LIMIT/erro no servidor: mantendo resultado do filtro semântico (fail-open)')
        }
        break
      }

      const result = await response.json()
      const itensParaSalvar = []
      if (result.resultados && Array.isArray(result.resultados)) {
        result.resultados.forEach(({ id, resultado }) => {
          const chave = gerarChaveCache(id, setoresHash)
          itensParaSalvar.push({ chave, resultado })
          if (resultado === true) idsAprovados.add(id)
        })
      }
      // Salvar no cache
      if (itensParaSalvar.length > 0) salvarCacheIA(itensParaSalvar)

      validados += lote.length
      if (onProgress) onProgress(validados, totalOriginal)
    }

    return idsAprovados
  } catch (error) {
    console.warn('⚠️ [IA] Erro ao validar lote:', error.message)
    return idsAprovados // Retorna o que já foi aprovado (inclui cache)
  }
}
