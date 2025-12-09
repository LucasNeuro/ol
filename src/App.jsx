import { Route, Switch, Redirect } from 'wouter'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ToastProvider } from '@/components/ui/toast'
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog'

// Páginas públicas
import { LandingPage } from '@/pages/landing'
import { LoginPage } from '@/pages/login'
import { CadastroPage } from '@/pages/cadastro'

// Páginas protegidas
import { DashboardPage } from '@/pages/dashboard'
import { BoletimPage } from '@/pages/boletim'
import { BoletimDiaPage } from '@/pages/boletim-dia'
import { FavoritosPage } from '@/pages/favoritos'
import { EditalPage } from '@/pages/edital'
import { PerfilPage } from '@/pages/perfil'
import { AlertasPage } from '@/pages/alertas'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmDialogProvider>
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/cadastro" component={CadastroPage} />
            
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/perfil" component={PerfilPage} />
            <Route path="/boletim" component={BoletimPage} />
            <Route path="/licitacoes" component={BoletimDiaPage} />
            <Route path="/favoritos" component={FavoritosPage} />
            <Route path="/alertas" component={AlertasPage} />
            <Route path="/edital/:numeroControle" component={EditalPage} />
            
            {/* Rotas não encontradas - redirecionar para dashboard se autenticado, senão para login */}
            <Route>
              <Redirect to="/dashboard" />
            </Route>
          </Switch>
        </ConfirmDialogProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App


