import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Função para limpar cache antigo do localStorage quando necessário
 */
function limparCacheAntigo() {
  try {
    // Limpar cache de filtros semânticos (mantém apenas os 5 mais recentes)
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('filtro_semantico_'))
    if (cacheKeys.length > 5) {
      const caches = cacheKeys.map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key))
          return { key, timestamp: data.timestamp || 0 }
        } catch {
          return { key, timestamp: 0 }
        }
      }).sort((a, b) => b.timestamp - a.timestamp)
      
      // Remover os mais antigos, mantendo apenas os 5 mais recentes
      caches.slice(5).forEach(({ key }) => {
        localStorage.removeItem(key)
      })
    }
    
    // Limpar outros caches grandes se necessário
    const tamanhoTotal = Object.keys(localStorage).reduce((acc, key) => {
      try {
        return acc + (localStorage.getItem(key)?.length || 0)
      } catch {
        return acc
      }
    }, 0)
    
    // Se ainda estiver muito grande (> 4MB), limpar mais caches
    if (tamanhoTotal > 4 * 1024 * 1024) {
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('filtro_semantico_') && key !== 'user-storage'
      )
      cacheKeys.forEach(key => localStorage.removeItem(key))
    }
  } catch (e) {
    console.warn('⚠️ Erro ao limpar cache:', e)
  }
}

/**
 * Storage customizado com tratamento de erro para QuotaExceededError
 */
const customStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch (e) {
      console.warn('⚠️ Erro ao ler do localStorage:', e)
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
        console.warn('⚠️ localStorage cheio, limpando cache antigo...')
        limparCacheAntigo()
        
        // Tentar novamente após limpar
        try {
          localStorage.setItem(name, value)
        } catch (e2) {
          console.error('❌ Erro ao salvar após limpar cache:', e2)
          // Se ainda falhar, tentar salvar apenas dados essenciais do usuário
          if (name === 'user-storage') {
            try {
              const data = JSON.parse(value)
              // Salvar apenas id e email, removendo dados grandes
              const minimalData = {
                state: {
                  user: data.state?.user ? {
                    id: data.state.user.id,
                    email: data.state.user.email,
                    nome: data.state.user.nome,
                    is_adm: data.state.user.is_adm
                  } : null,
                  isAuthenticated: data.state?.isAuthenticated || false
                },
                version: data.version || 0
              }
              localStorage.setItem(name, JSON.stringify(minimalData))
            } catch (e3) {
              console.error('❌ Erro ao salvar dados mínimos:', e3)
            }
          }
        }
      } else {
        console.error('❌ Erro ao salvar no localStorage:', e)
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch (e) {
      console.warn('⚠️ Erro ao remover do localStorage:', e)
    }
  }
}

/**
 * Store do usuário usando Zustand
 * Persiste no localStorage automaticamente com tratamento de erro
 */
export const useUserStore = create(
  persist(
    (set) => ({
      // Estado
      user: null,
      isAuthenticated: false,
      isLoading: false,

      // Ações
      setUser: (user) => {
        // Remover dados grandes do usuário antes de salvar
        const userMinimal = user ? {
          id: user.id,
          email: user.email,
          nome: user.nome,
          razao_social: user.razao_social,
          nome_fantasia: user.nome_fantasia,
          is_adm: user.is_adm, // Campo correto do banco de dados
          // Manter apenas campos essenciais
        } : null
        
        set({ 
          user: userMinimal, 
          isAuthenticated: !!userMinimal,
          isLoading: false 
        })
      },

      clearUser: () => set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false 
      }),

      setLoading: (isLoading) => set({ isLoading }),

      // Logout completo
      logout: () => {
        // Limpar estado
        set({ 
          user: null, 
          isAuthenticated: false,
          isLoading: false 
        })
        
        // Limpar localStorage
        try {
          localStorage.removeItem('user')
          localStorage.removeItem('session')
          localStorage.removeItem('user-storage')
        } catch (e) {
          console.warn('⚠️ Erro ao limpar localStorage no logout:', e)
        }
        
        // Redirecionar para login
        window.location.href = '/login'
      },
    }),
    {
      name: 'user-storage', // Nome no localStorage
      storage: customStorage, // Usar storage customizado com tratamento de erro
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)








