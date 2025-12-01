// Cliente API para comunicação com o mini-backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Executa sincronização manual via API
 */
export async function executarSyncManual() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sync/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('❌ Erro ao executar sync manual:', error)
    throw error
  }
}

/**
 * Busca status da última sincronização
 */
export async function buscarStatusSync() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sync/status`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('❌ Erro ao buscar status:', error)
    return { success: false, data: null }
  }
}

/**
 * Busca histórico de sincronizações
 */
export async function buscarHistoricoSync(limit = 10) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sync/history?limit=${limit}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error)
    return { success: false, data: [] }
  }
}

