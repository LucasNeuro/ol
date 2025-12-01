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
import { EditalPage } from '@/pages/edital'
import { FiltroPage } from '@/pages/filtro'
import { AlertasPage } from '@/pages/alertas'
import { PreferidosPage } from '@/pages/preferidos'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/cadastro" component={CadastroPage} />
        
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/boletim" component={BoletimPage} />
        <Route path="/boletim/:date" component={BoletimDiaPage} />
        <Route path="/edital/:numeroControle" component={EditalPage} />
        <Route path="/filtro" component={FiltroPage} />
        <Route path="/alertas" component={AlertasPage} />
        <Route path="/preferidos" component={PreferidosPage} />
        
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </QueryClientProvider>
  )
}

export default App


