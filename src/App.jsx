import { useEffect, lazy, Suspense } from 'react'
import { Route, Switch, Redirect } from 'wouter'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ToastProvider } from '@/components/ui/toast'
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog'
import { FiltroProvider } from '@/contexts/FiltroContext'
import { useSessionTimeout } from '@/hooks/useSessionTimeout'
import { useAuth } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LicitacaoCardSkeletonList } from '@/components/LicitacaoCardSkeleton'

// Páginas públicas – lazy load para carregamento inicial mais rápido
const LandingPage = lazy(() => import('@/pages/landing').then(m => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('@/pages/login').then(m => ({ default: m.LoginPage })))
const CadastroPage = lazy(() => import('@/pages/cadastro').then(m => ({ default: m.CadastroPage })))
const RecuperarSenhaPage = lazy(() => import('@/pages/recuperar-senha').then(m => ({ default: m.RecuperarSenhaPage })))
const RedefinirSenhaPage = lazy(() => import('@/pages/redefinir-senha').then(m => ({ default: m.RedefinirSenhaPage })))

// Páginas protegidas – lazy load
const ModulosPage = lazy(() => import('@/pages/modulos').then(m => ({ default: m.ModulosPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })))
const BoletimDiaPage = lazy(() => import('@/pages/boletim-dia').then(m => ({ default: m.BoletimDiaPage })))
const FavoritosPage = lazy(() => import('@/pages/favoritos').then(m => ({ default: m.FavoritosPage })))
const EditalPage = lazy(() => import('@/pages/edital').then(m => ({ default: m.EditalPage })))
const PerfilPage = lazy(() => import('@/pages/perfil').then(m => ({ default: m.PerfilPage })))
const AdminUsuariosPage = lazy(() => import('@/pages/admin/usuarios').then(m => ({ default: m.AdminUsuariosPage })))

/**
 * Função para limpar cache antigo do localStorage ao iniciar a aplicação
 */
function limparCacheInicial() {
  try {
    // Calcular tamanho total do localStorage
    let tamanhoTotal = 0
    const itens = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key) || ''
        const tamanho = new Blob([value]).size
        tamanhoTotal += tamanho
        itens.push({ key, tamanho })
      }
    }
    
    // Se o tamanho total for maior que 3MB, limpar cache de filtros
    if (tamanhoTotal > 3 * 1024 * 1024) {
      console.warn(`⚠️ localStorage muito grande (${(tamanhoTotal / 1024 / 1024).toFixed(2)}MB), limpando cache...`)
      
      // Limpar cache de filtros semânticos (manter apenas os 3 mais recentes)
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('filtro_semantico_'))
      if (cacheKeys.length > 3) {
        const caches = cacheKeys.map(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key))
            return { key, timestamp: data.timestamp || 0 }
          } catch {
            return { key, timestamp: 0 }
          }
        }).sort((a, b) => b.timestamp - a.timestamp)
        
        // Remover todos exceto os 3 mais recentes
        caches.slice(3).forEach(({ key }) => {
          localStorage.removeItem(key)
        })
        console.log(`✅ [Inicialização] ${caches.length - 3} caches antigos removidos`)
      }
    }
  } catch (e) {
    console.warn('⚠️ Erro ao limpar cache inicial:', e)
  }
}

function AppContent() {
  const { user } = useAuth()
  // Timeout automático de sessão após 30 min de inatividade
  useSessionTimeout(30)

  return (
    <Switch>
      {/* Rotas Públicas */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/cadastro" component={CadastroPage} />
      <Route path="/recuperar-senha" component={RecuperarSenhaPage} />
      <Route path="/redefinir-senha" component={RedefinirSenhaPage} />
      
      {/* Rotas Protegidas - Exigem Autenticação */}
      <Route path="/modulos" component={() => <ProtectedRoute><ModulosPage /></ProtectedRoute>} />
      <Route path="/dashboard" component={() => <ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/perfil" component={() => <ProtectedRoute><PerfilPage /></ProtectedRoute>} />
      <Route path="/licitacoes" component={() => <ProtectedRoute><BoletimDiaPage /></ProtectedRoute>} />
      <Route path="/favoritos" component={() => <ProtectedRoute><FavoritosPage /></ProtectedRoute>} />
      <Route path="/edital/:numeroControle" component={() => <ProtectedRoute><EditalPage /></ProtectedRoute>} />
      
      {/* Rotas Administrativas - Exigem Autenticação */}
      <Route path="/admin/usuarios" component={() => <ProtectedRoute><AdminUsuariosPage /></ProtectedRoute>} />
      
      {/* Rota não encontrada - redirecionar para landing page */}
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  )
}

function App() {
  // Limpar cache ao iniciar a aplicação
  useEffect(() => {
    limparCacheInicial()
  }, [])
  
  return (
    <QueryClientProvider client={queryClient}>
      <FiltroProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="w-full max-w-2xl px-4">
                  <LicitacaoCardSkeletonList count={6} />
                </div>
              </div>
            }>
              <AppContent />
            </Suspense>
          </ConfirmDialogProvider>
        </ToastProvider>
      </FiltroProvider>
    </QueryClientProvider>
  )
}

export default App


