import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Store do usuário usando Zustand
 * Persiste no localStorage automaticamente
 */
export const useUserStore = create(
  persist(
    (set) => ({
      // Estado
      user: null,
      isAuthenticated: false,
      isLoading: false,

      // Ações
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        isLoading: false 
      }),

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
        localStorage.removeItem('user')
        localStorage.removeItem('session')
        
        // Redirecionar para login
        window.location.href = '/login'
      },
    }),
    {
      name: 'user-storage', // Nome no localStorage
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)


