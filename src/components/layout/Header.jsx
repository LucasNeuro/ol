import { Link, useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { User, LogOut, ChevronDown, Target, ArrowLeft } from 'lucide-react'
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
  
  console.log('🔍 [Header] Debug:', { 
    userId,
    userAuthId: userAuth?.id,
    userAuthRazao: userAuth?.razao_social,
    perfilCompletoRazao: perfilCompleto?.razao_social,
    perfilCompletoNomeFantasia: perfilCompleto?.nome_fantasia,
    nomeEmpresaFinal: nomeEmpresa,
    loadingPerfil,
    isAuthenticated
  })

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
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-6 md:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Botão Voltar para Módulos */}
            <button
              onClick={() => setLocation('/modulos')}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors text-gray-600 hover:text-orange-500"
              title="Voltar para Módulos"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setLocation('/modulos')}
              className="cursor-pointer flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Voltar para Módulos"
            >
              <Target className="w-6 h-6 text-orange-500" />
              <h1 className="text-xl font-bold text-gray-900">
                <strong>Sistema Licitação</strong>
              </h1>
            </button>
          </div>

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
                  <div className="flex items-center gap-2">
                    {/* Avatar e Nome - clicável para voltar aos módulos */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setLocation('/modulos')
                      }}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                      title="Voltar para Módulos"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold shadow-lg">
                        {getInitials()}
                      </div>
                      {nomeEmpresa && nomeEmpresa !== 'Usuário' && (
                        <span className="text-sm font-medium text-gray-700 hidden sm:block">
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
                      
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 z-50">
                        {/* Informações do usuário */}
                        <div className="px-4 py-3 border-b border-gray-100">
                          {loadingPerfil && !perfilCompleto ? (
                            <p className="text-sm font-semibold text-gray-900">Carregando...</p>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setDropdownOpen(false)
                                  setLocation('/modulos')
                                }}
                                className="text-sm font-semibold text-gray-900 hover:text-orange-500 transition-colors cursor-pointer w-full text-left"
                                title="Voltar para Módulos"
                              >
                                {nomeEmpresa}
                              </button>
                              {emailUsuario && (
                                <p className="text-xs text-gray-500 truncate mt-1">
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


