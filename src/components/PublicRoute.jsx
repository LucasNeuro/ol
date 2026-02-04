// ============================================
// COMPONENTE: PublicRoute
// ============================================
// Protege rotas públicas - redireciona usuários autenticados para o dashboard

import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '@/hooks/useAuth'

export function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  const [location, setLocation] = useLocation()

  useEffect(() => {
    // Não redirecionar em /redefinir-senha: usuário pode ter sessão de recuperação (veio do link do e-mail)
    if (location === '/redefinir-senha') return
    // Se usuário estiver autenticado, redirecionar para licitações (ou admin se for admin)
    if (!loading && user) {
      if (user.is_adm) {
        setLocation('/admin/usuarios')
      } else {
        setLocation('/licitacoes')
      }
    }
  }, [user, loading, setLocation, location])

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

  // Em /redefinir-senha sempre mostrar o conteúdo (sessão de recuperação = "user" setado)
  if (location === '/redefinir-senha') {
    return <>{children}</>
  }
  // Se usuário estiver autenticado em outras rotas públicas, não renderizar (já redirecionou)
  if (user) {
    return null
  }

  return <>{children}</>
}




