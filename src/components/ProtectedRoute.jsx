import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const [, setLocation] = useLocation()

  console.log('🔒 ProtectedRoute - User:', user, 'Loading:', loading)

  useEffect(() => {
    if (!loading && !user) {
      console.log('⚠️ Usuário não autenticado, redirecionando para login')
      setLocation('/login')
    }
  }, [user, loading, setLocation])

  if (loading) {
    console.log('⏳ Carregando autenticação...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('❌ Sem usuário, não renderizando')
    return null
  }

  console.log('✅ Usuário autenticado, renderizando conteúdo')
  return <>{children}</>
}


