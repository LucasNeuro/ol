import { Link, useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

export function Header() {
  const [location] = useLocation()
  const { user, signOut } = useAuth()
  const isAuthenticated = !!user

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-6 md:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between">
          <Link href="/">
            <h1 className="text-xl font-bold text-gray-900 cursor-pointer">
              Sistema Licitação
            </h1>
          </Link>

          <nav className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" className="text-gray-600 hover:text-orange-500">
                    Dashboard
                  </Button>
                </Link>
                <Button variant="ghost" onClick={handleSignOut}>
                  Sair
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="text-gray-600 hover:text-orange-500">
                    Já tenho conta
                  </Button>
                </Link>
                <Link href="/login">
                  <Button>Acessar</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}


