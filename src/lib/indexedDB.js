/**
 * Abstração simples para IndexedDB
 * IndexedDB oferece muito mais espaço (GBs) comparado ao sessionStorage (MBs)
 * 
 * Esta implementação usa uma store chamada 'cache' dentro de um database 'licitacoes_cache'
 */

const DB_NAME = 'licitacoes_cache'
const DB_VERSION = 1
const STORE_NAME = 'cache'

let dbPromise = null

/**
 * Abre a conexão com o IndexedDB
 */
function openDB() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('❌ [IndexedDB] Erro ao abrir database:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      
      // Criar object store se não existir
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        console.log('✅ [IndexedDB] Object store criado')
      }
    }
  })

  return dbPromise
}

/**
 * Salva um valor no IndexedDB
 * @param {string} key - Chave do cache
 * @param {*} value - Valor a ser salvo
 * @returns {Promise<void>}
 */
export async function setItem(key, value) {
  try {
    const db = await openDB()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    await store.put({
      key,
      value,
      timestamp: Date.now()
    })
    
    return Promise.resolve()
  } catch (error) {
    console.error(`❌ [IndexedDB] Erro ao salvar ${key}:`, error)
    throw error
  }
}

/**
 * Carrega um valor do IndexedDB
 * @param {string} key - Chave do cache
 * @returns {Promise<*>}
 */
export async function getItem(key) {
  try {
    const db = await openDB()
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    const request = store.get(key)
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.value : null)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
  } catch (error) {
    console.error(`❌ [IndexedDB] Erro ao carregar ${key}:`, error)
    return null
  }
}

/**
 * Remove um valor do IndexedDB
 * @param {string} key - Chave do cache
 * @returns {Promise<void>}
 */
export async function removeItem(key) {
  try {
    const db = await openDB()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    await store.delete(key)
    return Promise.resolve()
  } catch (error) {
    console.error(`❌ [IndexedDB] Erro ao remover ${key}:`, error)
    throw error
  }
}

/**
 * Limpa todas as chaves que começam com um prefixo
 * @param {string} prefix - Prefixo das chaves a serem removidas
 * @returns {Promise<number>} - Número de itens removidos
 */
export async function clearByPrefix(prefix) {
  try {
    const db = await openDB()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const request = store.openCursor()
    let count = 0
    
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          if (cursor.value && cursor.value.key && cursor.value.key.startsWith(prefix)) {
            cursor.delete()
            count++
          }
          cursor.continue()
        } else {
          resolve(count)
        }
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
  } catch (error) {
    console.error(`❌ [IndexedDB] Erro ao limpar por prefixo ${prefix}:`, error)
    return 0
  }
}

/**
 * Limpa todo o database
 * @returns {Promise<void>}
 */
export async function clearAll() {
  try {
    const db = await openDB()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    await store.clear()
    console.log('✅ [IndexedDB] Database limpo')
    return Promise.resolve()
  } catch (error) {
    console.error('❌ [IndexedDB] Erro ao limpar database:', error)
    throw error
  }
}

/**
 * Verifica se o IndexedDB está disponível
 */
export function isAvailable() {
  return typeof indexedDB !== 'undefined'
}

