import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const [, setLocation] = useLocation()

  useEffect(() => {
    // Se não estiver carregando e não tiver usuário, redirecionar para landing page
    if (!loading && !user) {
      console.log('⚠️ [ProtectedRoute] Usuário não autenticado, redirecionando para landing page')
      setLocation('/')
    }
  }, [user, loading, setLocation])

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  // Se não tem usuário, não renderizar (já redirecionou)
  if (!user) {
    return null
  }

  // Usuário autenticado - renderizar conteúdo
  return <>{children}</>
}


