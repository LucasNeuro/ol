import { Route, Switch, Redirect } from 'wouter'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/cadastro" component={CadastroPage} />
        
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/perfil" component={PerfilPage} />
        <Route path="/boletim" component={BoletimPage} />
        <Route path="/licitacoes" component={BoletimDiaPage} />
        <Route path="/favoritos" component={FavoritosPage} />
        <Route path="/edital/:numeroControle" component={EditalPage} />
        
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </QueryClientProvider>
  )
}

export default App


