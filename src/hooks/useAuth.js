import { useEffect, useRef } from 'react'
import { useUserStore } from '@/store/userStore'
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signOut as authSignOut,
  getSession,
} from '@/lib/auth'

let sessionCheckInitialized = false
let sessionCheckPromise = null

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, clearUser, setLoading, logout } = useUserStore()
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) return
    if (sessionCheckInitialized) {
      hasRunRef.current = true
      return
    }
    if (sessionCheckPromise) return

    hasRunRef.current = true
    sessionCheckInitialized = true

    sessionCheckPromise = (async () => {
      setLoading(true)
      try {
        const session = await getSession()
        if (session?.user) {
          setUser(session.user)
        } else {
          clearUser()
        }
      } catch (e) {
        clearUser()
      } finally {
        setLoading(false)
        sessionCheckPromise = null
      }
    })()
  }, [setUser, clearUser, setLoading])

  async function signUp(email, password, profileData) {
    setLoading(true)
    try {
      const { data, error } = await authSignUp(email, password, profileData)
      if (error) throw error
      if (data) setUser(data)
      return { data, error }
    } catch (e) {
      setLoading(false)
      throw e
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    setLoading(true)
    try {
      const { data, error } = await authSignIn(email, password)
      if (error) throw error
      if (data?.user) setUser(data.user)
      return { data, error }
    } catch (e) {
      setLoading(false)
      throw e
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    try {
      sessionCheckInitialized = false
      sessionCheckPromise = null
      await authSignOut()
      await logout()
    } catch (e) {
      throw e
    }
  }

  return {
    user,
    profile: user,
    loading: isLoading,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
  }
}
