import { Link, useLocation } from 'wouter'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroContext } from '@/contexts/FiltroContext'
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
  Target,
  Users,
  ClipboardList
} from 'lucide-react'
import { SidebarLogsFiltro } from '@/components/SidebarLogsFiltro'

export function AppLayout({ children, onToggleFiltros, filtrosAbertos }) {
  const [location, setLocation] = useLocation()
  const { user, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarLogsAberto, setSidebarLogsAberto] = useState(false)
  const { logsFiltro } = useFiltroContext()

  const handleSignOut = async () => {
    try {
      await signOut()
      setDropdownOpen(false)
      // Redirecionar para login usando o roteador do wouter (funciona melhor no Render)
      setLocation('/login')
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
    // Menu administrativo - apenas para super admins
    ...(user?.is_adm ? [{ icon: Users, label: 'Controle de Usuários', path: '/admin/usuarios' }] : []),
  ]

  const isActive = (path) => location === path || location.startsWith(path + '/')

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Header único: logo + nav + usuário */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-border shadow-sm">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo */}
          <Link href="/licitacoes">
            <a className="flex items-center gap-2.5 shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-semibold text-gray-900 tracking-tight hidden sm:inline">
                Sistema Licitação
              </span>
            </a>
          </Link>

          {/* Nav central */}
          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-1">
            {menuItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <a
                  className={`
                    flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap
                    transition-colors duration-150
                    ${isActive(item.path)
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                  title={item.label}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </a>
              </Link>
            ))}
            <div className="h-6 w-px bg-gray-200 mx-1 shrink-0" aria-hidden />
            <button
              onClick={() => setSidebarLogsAberto(!sidebarLogsAberto)}
              className={`
                flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap
                transition-colors duration-150
                ${sidebarLogsAberto
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
              title="Ver andamento do filtro"
            >
              <ClipboardList className="h-4 w-4 shrink-0" />
              Andamento
              {logsFiltro.length > 0 && (
                <span className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-black/10 text-xs font-medium">
                  {logsFiltro.length}
                </span>
              )}
            </button>
            {onToggleFiltros && (
              <>
                <div className="h-6 w-px bg-gray-200 mx-1 shrink-0" aria-hidden />
                <button
                  onClick={onToggleFiltros}
                  className={`
                    flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap
                    transition-colors duration-150
                    ${filtrosAbertos
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                  title="Filtros"
                >
                  <Filter className="h-4 w-4 shrink-0" />
                  Filtros
                  {filtrosAbertos ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </>
            )}
          </nav>

          {/* Avatar + dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-gray-100 transition-colors"
              aria-expanded={dropdownOpen}
            >
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                {getInitials()}
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} aria-hidden />
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white border border-[hsl(var(--border))] shadow-lg py-2 z-50">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user?.razao_social || 'Usuário'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {user?.email}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left rounded-lg mx-1 transition-colors"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      Sair
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        <main className="flex-1 overflow-x-hidden min-w-0">
          {children}
        </main>
        <SidebarLogsFiltro
          aberto={sidebarLogsAberto}
          onFechar={() => setSidebarLogsAberto(false)}
        />
      </div>
    </div>
  )
}

