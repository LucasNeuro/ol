import { Link, useLocation } from 'wouter'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroContext } from '@/contexts/FiltroContext'
import { MiniCircularProgress } from '@/components/ui/mini-circular-progress'
import { 
  LayoutDashboard, 
  FileText, 
  Star, 
  Bell, 
  User, 
  LogOut, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  Target
} from 'lucide-react'

export function AppLayout({ children, onToggleFiltros, filtrosAbertos }) {
  const [location] = useLocation()
  const { user, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { processandoFiltro, mensagemProgresso, progressoPercentual } = useFiltroContext()

  const handleSignOut = async () => {
    try {
      await signOut()
      setDropdownOpen(false)
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  const getInitials = () => {
    if (user?.razao_social) {
      return user.razao_social.substring(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  const menuItems = [
    { icon: FileText, label: 'Licitações', path: '/licitacoes' },
    { icon: Calendar, label: 'Boletim Diário', path: '/boletim' },
    { icon: Star, label: 'Favoritos', path: '/favoritos' },
    { icon: Bell, label: 'Alertas', path: '/alertas' },
    { icon: User, label: 'Meu Perfil', path: '/perfil' },
  ]

  const isActive = (path) => location === path || location.startsWith(path + '/')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header com Navbar */}
      <header className="sticky top-0 z-50 w-full border-b shadow-sm bg-white">
        <div className="flex flex-col">
          {/* Top Bar - Logo e Avatar */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <Link href="/licitacoes">
                <a className="cursor-pointer flex items-center gap-2">
                  <Target className="w-6 h-6 text-orange-500" />
                  <h1 className="text-xl font-bold text-gray-900">
                    Focus
                  </h1>
                </a>
              </Link>
            </div>

            {/* Progresso do Filtro (canto direito) */}
            {processandoFiltro && (
              <div className="flex items-center gap-2">
                <MiniCircularProgress value={progressoPercentual} size={32} strokeWidth={3} />
                {mensagemProgresso && (
                  <span className="text-xs text-gray-600 max-w-[200px] truncate" title={mensagemProgresso}>
                    {mensagemProgresso}
                  </span>
                )}
              </div>
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
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)}
                  />
                  
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user?.razao_social || 'Usuário'}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {user?.email}
                      </p>
                    </div>

                    <div className="py-1">
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
          </div>

          {/* Navbar - Menu de Navegação */}
          <nav className="flex h-14 items-center px-6 gap-1 overflow-x-auto" style={{ backgroundColor: '#fff7ed' }}>
            {menuItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <a
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap
                    transition-all duration-200
                    ${isActive(item.path)
                      ? 'bg-orange-500 text-white font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-orange-50'
                    }
                  `}
                  title={item.label}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </a>
              </Link>
            ))}

            {/* Botão Filtros (só aparece quando tem a função) */}
            {onToggleFiltros && (
              <>
                <div className="h-6 w-px bg-gray-300 mx-2"></div>
                <button
                  onClick={onToggleFiltros}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap
                    transition-all duration-200
                    ${filtrosAbertos
                      ? 'bg-blue-500 text-white font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-blue-50'
                    }
                  `}
                  title="Filtros"
                >
                  <Filter className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">Filtros</span>
                  {filtrosAbertos && (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                  {!filtrosAbertos && (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Layout Principal */}
      <div className="flex flex-1 relative">
        {/* Conteúdo Principal */}
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}

