import { useEffect } from 'react'
import { useUserStore } from '@/store/userStore'
import { signUp as authSignUp, signIn as authSignIn, getSession, saveSession, isSessionValid } from '@/lib/auth'

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, clearUser, setLoading, logout } = useUserStore()

  useEffect(() => {
    // Verificar sessão salva apenas uma vez no mount
    const checkSession = () => {
      setLoading(true)
      
      try {
        const session = getSession()
        console.log('🔍 [useAuth] Verificando sessão:', session ? 'Sessão encontrada' : 'Nenhuma sessão')
        
        if (session && session.user && isSessionValid()) {
          console.log('✅ [useAuth] Sessão válida encontrada, restaurando usuário')
          setUser(session.user)
        } else {
          console.log('❌ [useAuth] Sessão inválida ou não encontrada, limpando estado')
          // Sessão expirada ou inválida - limpar
          clearUser()
        }
      } catch (error) {
        console.error('❌ [useAuth] Erro ao verificar sessão:', error)
        clearUser()
      } finally {
        setLoading(false)
      }
    }
    
    checkSession()
  }, [setUser, clearUser, setLoading]) // Dependências corretas

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

