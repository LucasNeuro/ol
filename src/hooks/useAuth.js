import { useState, useEffect } from 'react'
import { signUp as authSignUp, signIn as authSignIn, signOut as authSignOut, getSession, saveSession, isSessionValid } from '@/lib/auth'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    // Verificar sessão salva
    const session = getSession()
    
    if (session && session.user && isSessionValid()) {
      setUser(session.user)
      setProfile(session.user) // No nosso sistema, user e profile são a mesma coisa
    } else {
      // Sessão expirada ou inválida
      authSignOut()
    }
    
    setLoading(false)
  }, [])

  async function signUp(email, password, profileData) {
    try {
      const { data, error } = await authSignUp(email, password, profileData)
      
      if (error) throw error

      if (data) {
        // Remover password_hash antes de salvar
        const { password_hash, ...userData } = data
        saveSession(userData)
        setUser(userData)
        setProfile(userData)
      }

      return { data, error }
    } catch (error) {
      throw error
    }
  }

  async function signIn(email, password) {
    try {
      const { data, error } = await authSignIn(email, password)
      
      if (error) throw error

      if (data && data.user) {
        saveSession(data.user)
        setUser(data.user)
        setProfile(data.user)
      }

      return { data, error }
    } catch (error) {
      throw error
    }
  }

  async function signOut() {
    try {
      await authSignOut()
      setUser(null)
      setProfile(null)
    } catch (error) {
      throw error
    }
  }

  return {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
  }
}

