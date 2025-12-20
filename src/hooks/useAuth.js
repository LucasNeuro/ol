import { useEffect, useRef } from 'react'
import { useUserStore } from '@/store/userStore'
import { signUp as authSignUp, signIn as authSignIn, getSession, saveSession, isSessionValid } from '@/lib/auth'

// Flag global para garantir verificação única da sessão (reset no logout)
let sessionCheckInitialized = false
let sessionCheckPromise = null

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, clearUser, setLoading, logout } = useUserStore()
  const hasRunRef = useRef(false)

  useEffect(() => {
    // Se já executou nesta instância do hook, não fazer nada
    if (hasRunRef.current) {
      return
    }
    
    // Se já foi verificado globalmente, marcar como executado e retornar
    if (sessionCheckInitialized) {
      hasRunRef.current = true
      return
    }
    
    // Se já está verificando (promise pendente), aguardar
    if (sessionCheckPromise) {
      return
    }
    
    // Marcar esta instância como executada
    hasRunRef.current = true
    sessionCheckInitialized = true
    
    // Criar promise única para verificação
    sessionCheckPromise = (async () => {
      setLoading(true)
      
      try {
        const session = getSession()
        
        if (session && session.user && isSessionValid()) {
          setUser(session.user)
        } else {
          clearUser()
        }
      } catch (error) {
        console.error('❌ [useAuth] Erro ao verificar sessão:', error)
        clearUser()
      } finally {
        setLoading(false)
        sessionCheckPromise = null
      }
    })()
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Array vazio - executar apenas uma vez. Funções do Zustand são estáveis

  async function signUp(email, password, profileData) {
    setLoading(true)
    try {
      const { data, error } = await authSignUp(email, password, profileData)
      
      if (error) throw error

      if (data) {
        // Remover password_hash antes de salvar
        const { password_hash, ...userData } = data
        saveSession(userData)
        setUser(userData)
      }

      return { data, error }
    } catch (error) {
      setLoading(false)
      throw error
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    setLoading(true)
    try {
      console.log('🔐 Tentando fazer login...')
      const { data, error } = await authSignIn(email, password)
      
      if (error) throw error

      if (data && data.user) {
        console.log('✅ Login bem-sucedido, salvando sessão')
        saveSession(data.user)
        setUser(data.user)
        console.log('✅ Usuário salvo no store:', data.user)
      }

      return { data, error }
    } catch (error) {
      console.error('❌ Erro no login:', error)
      setLoading(false)
      throw error
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    try {
      // Resetar flag global para permitir nova verificação no próximo login
      sessionCheckInitialized = false
      sessionCheckPromise = null
      
      // Usar a função logout do store que já faz tudo (agora é async)
      await logout()
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      throw error
    }
  }

  return {
    user,
    profile: user, // Manter compatibilidade
    loading: isLoading,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
  }
}

