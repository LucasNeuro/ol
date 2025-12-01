import { Link } from 'wouter'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Calendar, Filter, Bell, Star } from 'lucide-react'

function DashboardContent() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 py-12 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
              Dashboard
            </h1>
            <p className="text-gray-600">
              Gerencie suas licitações e oportunidades
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Link href="/boletim">
              <Card className="hover:scale-105 transition-transform duration-200 hover:shadow-lg cursor-pointer h-full">
                <CardHeader>
                  <Calendar className="w-12 h-12 text-orange-500 mb-4" />
                  <CardTitle>Boletim Diário</CardTitle>
                  <CardDescription>
                    Visualize todas as licitações publicadas por data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/filtro">
              <Card className="hover:scale-105 transition-transform duration-200 hover:shadow-lg cursor-pointer h-full">
                <CardHeader>
                  <Filter className="w-12 h-12 text-orange-500 mb-4" />
                  <CardTitle>Filtro de Licitações</CardTitle>
                  <CardDescription>
                    Busque licitações com filtros avançados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/alertas">
              <Card className="hover:scale-105 transition-transform duration-200 hover:shadow-lg cursor-pointer h-full">
                <CardHeader>
                  <Bell className="w-12 h-12 text-orange-500 mb-4" />
                  <CardTitle>Alertas</CardTitle>
                  <CardDescription>
                    Configure alertas por email para novas licitações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/preferidos">
              <Card className="hover:scale-105 transition-transform duration-200 hover:shadow-lg cursor-pointer h-full">
                <CardHeader>
                  <Star className="w-12 h-12 text-orange-500 mb-4" />
                  <CardTitle>Preferidos</CardTitle>
                  <CardDescription>
                    Visualize suas licitações favoritas salvas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}


