import { useEffect, lazy, Suspense } from 'react'
import { Route, Switch, Redirect } from 'wouter'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ToastProvider } from '@/components/ui/toast'
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog'
import { FiltroProvider } from '@/contexts/FiltroContext'
import { useAuth } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'

// Páginas públicas (carregamento imediato)
import { LandingPage } from '@/pages/landing'
import { LoginPage } from '@/pages/login'
import { CadastroPage } from '@/pages/cadastro'
import { RecuperarSenhaPage } from '@/pages/recuperar-senha'
import { RedefinirSenhaPage } from '@/pages/redefinir-senha'
import { OrcamentoPage } from '@/pages/orcamento'

// Páginas protegidas (lazy: melhor tempo de navegação e primeiro clique)
const ModulosPage = lazy(() => import('@/pages/modulos').then(m => ({ default: m.ModulosPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })))
const BoletimPage = lazy(() => import('@/pages/boletim').then(m => ({ default: m.BoletimPage })))
const BoletimDiaPage = lazy(() => import('@/pages/boletim-dia').then(m => ({ default: m.BoletimDiaPage })))
const FavoritosPage = lazy(() => import('@/pages/favoritos').then(m => ({ default: m.FavoritosPage })))
const EditalPage = lazy(() => import('@/pages/edital').then(m => ({ default: m.EditalPage })))
const PerfilPage = lazy(() => import('@/pages/perfil').then(m => ({ default: m.PerfilPage })))
const AdminUsuariosPage = lazy(() => import('@/pages/admin/usuarios').then(m => ({ default: m.AdminUsuariosPage })))
const AlertasPage = lazy(() => import('@/pages/alertas').then(m => ({ default: m.AlertasPage })))

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
      }
    }
  } catch (e) {
  }
}

// Wrappers estáveis (evitam "Maximum update depth" ao usar () => no Route)
function ProtectedModulos() { return <ProtectedRoute><ModulosPage /></ProtectedRoute> }
function ProtectedDashboard() { return <ProtectedRoute><DashboardPage /></ProtectedRoute> }
function ProtectedPerfil() { return <ProtectedRoute><PerfilPage /></ProtectedRoute> }
function ProtectedBoletim() { return <ProtectedRoute><BoletimPage /></ProtectedRoute> }
function ProtectedLicitacoes() { return <ProtectedRoute><BoletimDiaPage /></ProtectedRoute> }
function ProtectedFavoritos() { return <ProtectedRoute><FavoritosPage /></ProtectedRoute> }
function ProtectedEdital() { return <ProtectedRoute><EditalPage /></ProtectedRoute> }
function ProtectedAdminUsuarios() { return <ProtectedRoute><AdminUsuariosPage /></ProtectedRoute> }
function ProtectedAlertas() { return <ProtectedRoute><AlertasPage /></ProtectedRoute> }

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-pulse text-gray-500">Carregando...</div>
    </div>
  )
}

function AppContent() {
  useAuth()

  return (
    <Suspense fallback={<PageFallback />}>
    <Switch>
      {/* Rotas Públicas */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/cadastro" component={CadastroPage} />
      <Route path="/recuperar-senha" component={RecuperarSenhaPage} />
      <Route path="/redefinir-senha" component={RedefinirSenhaPage} />
      <Route path="/orcamento" component={OrcamentoPage} />
      
      {/* Rotas Protegidas - Exigem Autenticação */}
      <Route path="/modulos" component={ProtectedModulos} />
      <Route path="/dashboard" component={ProtectedDashboard} />
      <Route path="/perfil" component={ProtectedPerfil} />
      <Route path="/boletim" component={ProtectedBoletim} />
      <Route path="/licitacoes" component={ProtectedLicitacoes} />
      <Route path="/favoritos" component={ProtectedFavoritos} />
      <Route path="/alertas" component={ProtectedAlertas} />
      <Route path="/edital/:numeroControle" component={ProtectedEdital} />
      
      {/* Rotas Administrativas */}
      <Route path="/admin/usuarios" component={ProtectedAdminUsuarios} />
      
      {/* Rota não encontrada - redirecionar para landing page */}
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
    </Suspense>
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
            <AppContent />
          </ConfirmDialogProvider>
        </ToastProvider>
      </FiltroProvider>
    </QueryClientProvider>
  )
}

export default App


