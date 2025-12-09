import { Link, useLocation } from 'wouter'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { 
  LayoutDashboard, 
  FileText, 
  Star, 
  Bell, 
  User, 
  LogOut, 
  ChevronDown,
  Menu,
  X,
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: FileText, label: 'Licitações', path: '/licitacoes' },
    { icon: Calendar, label: 'Boletim Diário', path: '/boletim' },
    { icon: Star, label: 'Favoritos', path: '/favoritos' },
    { icon: Bell, label: 'Alertas', path: '/alertas' },
    { icon: User, label: 'Meu Perfil', path: '/perfil' },
  ]

  const isActive = (path) => location === path || location.startsWith(path + '/')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b shadow-sm" style={{ backgroundColor: '#fff7ed' }}>
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {/* Toggle Sidebar Mobile */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/dashboard">
              <a className="cursor-pointer flex items-center gap-2">
                <Target className="w-6 h-6 text-orange-500" />
                <h1 className="text-xl font-bold text-gray-900">
                  Focus
                </h1>
              </a>
            </Link>
          </div>

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
      </header>

      {/* Layout Principal */}
      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <aside 
          className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
            fixed lg:sticky top-16 left-0
            ${sidebarCollapsed ? 'w-20' : 'w-64'}
            h-[calc(100vh-4rem)]
            border-r border-gray-200
            transition-all duration-300 ease-in-out
            z-40
            overflow-y-auto
          `}
          style={{ backgroundColor: '#fff7ed' }}
        >

          <nav className="p-3 space-y-1">
            {/* Botão Hambúrguer Laranja - Toggle Sidebar de Navegação */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`
                flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} 
                px-3 py-3 rounded-lg w-full mb-2
                transition-all duration-200
                bg-orange-500 text-white font-semibold shadow-md hover:bg-orange-600
              `}
              title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              <Menu className={`w-5 h-5 ${sidebarCollapsed ? '' : 'flex-shrink-0'}`} />
              {!sidebarCollapsed && <span>Menu</span>}
            </button>
            {menuItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <a
                  className={`
                    flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} 
                    px-3 py-3 rounded-lg
                    transition-all duration-200
                    ${isActive(item.path)
                      ? 'bg-orange-50 text-orange-600 font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <item.icon className={`w-5 h-5 ${sidebarCollapsed ? '' : 'flex-shrink-0'}`} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </a>
              </Link>
            ))}

            {/* Botão Filtros (só aparece quando tem a função) */}
            {onToggleFiltros && (
              <>
                <div className="px-3 py-2">
                  <div className="border-t border-gray-200"></div>
                </div>
                <button
                  onClick={onToggleFiltros}
                  className={`
                    flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} 
                    px-3 py-3 rounded-lg w-full
                    transition-all duration-200
                    ${filtrosAbertos
                      ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  title={sidebarCollapsed ? 'Filtros' : ''}
                >
                  <Filter className={`w-5 h-5 ${sidebarCollapsed ? '' : 'flex-shrink-0'}`} />
                  {!sidebarCollapsed && <span>Filtros</span>}
                  {!sidebarCollapsed && filtrosAbertos && (
                    <ChevronLeft className="w-4 h-4 ml-auto" />
                  )}
                  {!sidebarCollapsed && !filtrosAbertos && (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </button>
              </>
            )}
          </nav>

        </aside>

        {/* Conteúdo Principal */}
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}

