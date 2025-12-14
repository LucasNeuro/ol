import { Link, useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { User, LogOut, ChevronDown, Target } from 'lucide-react'

export function Header() {
  const [location] = useLocation()
  const { user, signOut } = useAuth()
  const isAuthenticated = !!user
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      setDropdownOpen(false)
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  // Pegar primeira letra do nome ou email
  const getInitials = () => {
    if (user?.razao_social) {
      return user.razao_social.substring(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-6 md:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between">
          <Link href="/">
            <a className="cursor-pointer flex items-center gap-2">
              <Target className="w-6 h-6 text-orange-500" />
              <h1 className="text-xl font-bold text-gray-900">
                <strong>Focus</strong>
              </h1>
            </a>
          </Link>

          <nav className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Dashboard apenas para admins */}
                {user?.is_adm && (
                  <Link href="/dashboard">
                    <a>
                      <Button variant="ghost" className="text-gray-600 hover:text-orange-500">
                        Dashboard Admin
                      </Button>
                    </a>
                  </Link>
                )}
                
                {/* Avatar Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold shadow-lg">
                      {getInitials()}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <>
                      {/* Overlay para fechar ao clicar fora */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setDropdownOpen(false)}
                      />
                      
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 z-50">
                        {/* Informações do usuário */}
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900">
                            {user?.razao_social || 'Usuário'}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-1">
                            {user?.email}
                          </p>
                        </div>

                        {/* Opções do menu */}
                        <div className="py-1">
                          <Link href="/perfil">
                            <a
                              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                              onClick={() => setDropdownOpen(false)}
                            >
                              <User className="w-4 h-4 text-gray-500" />
                              Minha Conta
                            </a>
                          </Link>

                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer w-full text-left"
                          >
                            <LogOut className="w-4 h-4" />
                            Sair
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <a>
                    <Button variant="ghost" className="text-gray-700 hover:text-orange-500 font-medium">
                      Acessar
                    </Button>
                  </a>
                </Link>
                <Link href="/cadastro">
                  <a>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6">
                      Cadastre-se
                    </Button>
                  </a>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}


