import { useLocation } from 'wouter'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardContent } from '@/components/ui/card'
import { useUserStore } from '@/store/userStore'
import { 
  FileText, 
  Star, 
  Bell, 
  BarChart3, 
  User, 
  Search,
  Target,
  Users
} from 'lucide-react'

function ModulosContent() {
  const { user } = useUserStore()
  const [, setLocation] = useLocation()

  const modulos = [
    {
      id: 'licitacoes',
      titulo: 'Licitações',
      descricao: 'Explore e filtre licitações públicas',
      icone: FileText,
      rota: '/licitacoes',
      disponivel: true
    },
    {
      id: 'favoritos',
      titulo: 'Favoritos',
      descricao: 'Suas licitações favoritadas',
      icone: Star,
      rota: '/favoritos',
      disponivel: true
    },
    {
      id: 'alertas',
      titulo: 'Alertas',
      descricao: 'Configure alertas personalizados',
      icone: Bell,
      rota: '/alertas',
      disponivel: true
    },
    {
      id: 'dashboard',
      titulo: 'Dashboard',
      descricao: 'Estatísticas e análises',
      icone: BarChart3,
      rota: '/dashboard',
      disponivel: user?.is_adm || false
    },
    {
      id: 'perfil',
      titulo: 'Perfil',
      descricao: 'Configure seu perfil e preferências',
      icone: User,
      rota: '/perfil',
      disponivel: true
    },
    {
      id: 'busca',
      titulo: 'Busca Avançada',
      descricao: 'Filtros e busca semântica',
      icone: Search,
      rota: '/licitacoes?aba=filtros',
      disponivel: true
    },
    {
      id: 'admin-usuarios',
      titulo: 'Controle de Usuários',
      descricao: 'Gerenciar usuários da plataforma',
      icone: Users,
      rota: '/admin/usuarios',
      disponivel: user?.is_adm || false
    }
  ]

  const modulosDisponiveis = modulos.filter(m => m.disponivel)

  const handleCardClick = (rota) => {
    setLocation(rota)
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Target className="w-10 h-10 text-orange-500" />
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              <strong>Sistema Licitação</strong>
            </h1>
          </div>
          <p className="text-xl text-gray-600 mt-2">
            Selecione o módulo que deseja acessar
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Escolha uma das opções abaixo para começar
          </p>
        </div>

        {/* Grid de Cards - 4 por linha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {modulosDisponiveis.map((modulo) => {
            const Icone = modulo.icone

            return (
              <Card
                key={modulo.id}
                className="
                  bg-white border border-gray-200
                  cursor-pointer transition-all duration-300
                  hover:border-orange-500 hover:shadow-md
                  h-full
                "
                onClick={() => handleCardClick(modulo.rota)}
              >
                <CardContent className="p-6 flex flex-col items-center text-center h-full">
                  <div className="
                    w-16 h-16 rounded-lg 
                    flex items-center justify-center 
                    mb-4
                    bg-orange-50
                  ">
                    <Icone className="w-8 h-8 text-orange-500" />
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {modulo.titulo}
                  </h3>
                  
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {modulo.descricao}
                  </p>

                  <div className="mt-auto pt-4 border-t border-gray-200 w-full">
                    <span className="text-xs font-medium text-orange-500 uppercase tracking-wide">
                      Acessar →
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Bem-vindo, <strong>{user?.razao_social || user?.email || 'Usuário'}</strong>
          </p>
        </div>
      </div>
    </div>
  )
}

export function ModulosPage() {
  return (
    <ProtectedRoute>
      <ModulosContent />
    </ProtectedRoute>
  )
}

