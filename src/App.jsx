import { useEffect } from 'react'
import { Route, Switch, Redirect } from 'wouter'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ToastProvider } from '@/components/ui/toast'
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog'
import { FiltroProvider } from '@/contexts/FiltroContext'
import { useVerificarAlertas } from '@/hooks/useVerificarAlertas'
import { useAuth } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'

// Páginas públicas
import { LandingPage } from '@/pages/landing'
import { LoginPage } from '@/pages/login'
import { CadastroPage } from '@/pages/cadastro'
import { RecuperarSenhaPage } from '@/pages/recuperar-senha'
import { RedefinirSenhaPage } from '@/pages/redefinir-senha'

// Páginas protegidas
import { ModulosPage } from '@/pages/modulos'
import { DashboardPage } from '@/pages/dashboard'
import { BoletimPage } from '@/pages/boletim'
import { BoletimDiaPage } from '@/pages/boletim-dia'
import { FavoritosPage } from '@/pages/favoritos'
import { EditalPage } from '@/pages/edital'
import { PerfilPage } from '@/pages/perfil'
import { AlertasPage } from '@/pages/alertas'
import { AdminUsuariosPage } from '@/pages/admin/usuarios'

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
  // Iniciar verificação automática de alertas apenas se usuário estiver autenticado
  useVerificarAlertas({ intervaloMinutos: 5, ativo: !!user })

  return (
    <Switch>
      {/* Rotas Públicas */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/cadastro" component={CadastroPage} />
      <Route path="/recuperar-senha" component={RecuperarSenhaPage} />
      <Route path="/redefinir-senha/:token" component={RedefinirSenhaPage} />
      
      {/* Rotas Protegidas - Exigem Autenticação */}
      <Route path="/modulos" component={() => <ProtectedRoute><ModulosPage /></ProtectedRoute>} />
      <Route path="/dashboard" component={() => <ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/perfil" component={() => <ProtectedRoute><PerfilPage /></ProtectedRoute>} />
      <Route path="/boletim" component={() => <ProtectedRoute><BoletimPage /></ProtectedRoute>} />
      <Route path="/licitacoes" component={() => <ProtectedRoute><BoletimDiaPage /></ProtectedRoute>} />
      <Route path="/favoritos" component={() => <ProtectedRoute><FavoritosPage /></ProtectedRoute>} />
      <Route path="/alertas" component={() => <ProtectedRoute><AlertasPage /></ProtectedRoute>} />
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
            <AppContent />
          </ConfirmDialogProvider>
        </ToastProvider>
      </FiltroProvider>
    </QueryClientProvider>
  )
}

export default App


