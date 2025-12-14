// ============================================
// COMPONENTE: PublicRoute
// ============================================
// Protege rotas públicas - redireciona usuários autenticados para o dashboard

import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '@/hooks/useAuth'

export function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  const [, setLocation] = useLocation()

  useEffect(() => {
    // Se usuário estiver autenticado, redirecionar para licitações (ou admin se for admin)
    if (!loading && user) {
      if (user.is_adm) {
        console.log('✅ Admin autenticado, redirecionando para admin')
        setLocation('/admin/usuarios')
      } else {
        console.log('✅ Usuário autenticado, redirecionando para licitações')
        setLocation('/licitacoes')
      }
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

  // Se usuário estiver autenticado, não renderizar (já redirecionou)
  if (user) {
    return null
  }

  // Usuário não autenticado - mostrar conteúdo público
  return <>{children}</>
}




