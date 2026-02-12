import { Link, useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { User, LogOut, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase' 

export function Header() {
  const [location, setLocation] = useLocation()
  const { user: userAuth, signOut } = useAuth()
  const isAuthenticated = !!userAuth
  const [dropdownOpen, setDropdownOpen] = useState(false)
  
  // Obter ID do usuário (pode estar em userAuth.id ou na sessão)
  const userId = userAuth?.id || (() => {
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        return user?.id
      }
    } catch {
      return null
    }
    return null
  })()
  
  // Também tentar buscar da sessão salva
  useEffect(() => {
    if (!userId && isAuthenticated) {
      try {
        const userStr = localStorage.getItem('user')
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user?.id) {
            console.log('✅ [Header] ID encontrado na sessão:', user.id)
          }
        }
      } catch (e) {
        console.warn('⚠️ [Header] Erro ao ler sessão:', e)
      }
    }
  }, [userId, isAuthenticated])

  // Buscar perfil completo para exibir nome da empresa
  const { data: perfilCompleto, isLoading: loadingPerfil } = useQuery({
    queryKey: ['perfil-header', userId],
    queryFn: async () => {
      if (!userId) {
        console.warn('⚠️ [Header] Sem userId')
        return null
      }
      
      try {
        console.log('🔍 [Header] Buscando perfil para id:', userId)
        const { data, error } = await supabase
          .from('profiles')
          .select('razao_social, nome_fantasia, email')
          .eq('id', userId)
          .maybeSingle()
        
        if (error) {
          console.warn('⚠️ Erro ao buscar perfil no header:', error)
          return null
        }
        
        if (!data) {
          console.warn('⚠️ [Header] Perfil não encontrado para id:', userId)
          return null
        }
        
        console.log('✅ [Header] Perfil completo carregado:', data)
        return data
      } catch (err) {
        console.error('❌ Erro ao buscar perfil no header:', err)
        return null
      }
    },
    enabled: !!userId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
    retry: 2,
    refetchOnWindowFocus: false,
  })

  // Usar perfil completo se disponível, senão usar userAuth
  const user = perfilCompleto ? { ...userAuth, ...perfilCompleto } : userAuth
  
  // Nome da empresa para exibir - prioridade: perfilCompleto > userAuth > 'Usuário'
  const nomeEmpresa = perfilCompleto?.razao_social || 
                      perfilCompleto?.nome_fantasia || 
                      userAuth?.razao_social || 
                      userAuth?.nome_fantasia || 
                      'Usuário'
  
  // Email para exibir
  const emailUsuario = perfilCompleto?.email || userAuth?.email || ''
  
  const handleSignOut = async () => {
    try {
      await signOut()
      setDropdownOpen(false)
      setLocation('/')
      const base = typeof window !== 'undefined' ? window.location.origin : ''
      if (base) window.location.href = `${base}/login`
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  // Pegar primeira letra do nome ou email
  const getInitials = () => {
    const nome = nomeEmpresa
    if (nome && nome !== 'Usuário') {
      return nome.substring(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/modulos">
              <a className="flex items-center">
              <img src="/logo/logo_licita.png" alt="Sistema Licitação" className="h-16 w-16 object-contain flex-shrink-0" />
                <span className="text-xl font-semibold text-foreground tracking-tight hidden sm:inline">
                  Sistema Licitação
                </span>
              </a>
            </Link>
          </div>

          <nav className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Dashboard apenas para admins */}
                {user?.is_adm && (
                  <Link href="/dashboard">
                    <a>
                      <Button variant="ghost" className="text-muted-foreground hover:text-primary">
                        Dashboard Admin
                      </Button>
                    </a>
                  </Link>
                )}
                
                {/* Avatar Dropdown */}
                <div className="relative">
                  <div className="flex items-center gap-2">
                    {/* Avatar e Nome - clicável para voltar aos módulos */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setLocation('/modulos')
                      }}
                      className="flex items-center gap-2 rounded-xl p-0.5 pr-2 hover:bg-gray-100 transition-colors"
                      title="Voltar para Módulos"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                        {getInitials()}
                      </div>
                      {nomeEmpresa && nomeEmpresa !== 'Usuário' && (
                        <span className="text-sm font-medium text-foreground hidden sm:block max-w-[140px] truncate">
                          {nomeEmpresa}
                        </span>
                      )}
                    </button>
                    
                    {/* Botão dropdown separado */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDropdownOpen(!dropdownOpen)
                      }}
                      className="hover:opacity-80 transition-opacity cursor-pointer"
                      title="Menu do usuário"
                    >
                      <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <>
                      {/* Overlay para fechar ao clicar fora */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setDropdownOpen(false)}
                      />
                      
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-border py-2 z-50">
                        {/* Informações do usuário */}
                        <div className="px-4 py-3 border-b border-border">
                          {loadingPerfil && !perfilCompleto ? (
                            <p className="text-sm font-semibold text-foreground">Carregando...</p>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setDropdownOpen(false)
                                  setLocation('/modulos')
                                }}
                                className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer w-full text-left"
                                title="Voltar para Módulos"
                              >
                                {nomeEmpresa}
                              </button>
                              {emailUsuario && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {emailUsuario}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Opções do menu */}
                        <div className="py-1">
                          <Link href="/perfil">
                            <a
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted cursor-pointer rounded-lg mx-1 transition-colors"
                              onClick={() => setDropdownOpen(false)}
                            >
                              <User className="w-4 h-4 text-muted-foreground" />
                              Minha Conta
                            </a>
                          </Link>

                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 cursor-pointer w-full text-left rounded-lg mx-1 transition-colors"
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
                    <Button variant="ghost" className="text-muted-foreground hover:text-primary font-medium">
                      Acessar
                    </Button>
                  </a>
                </Link>
                <Link href="/cadastro">
                  <a>
                    <Button className="font-semibold px-6">
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


