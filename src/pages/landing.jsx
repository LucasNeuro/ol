import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FileText, Filter, Bell, Star } from 'lucide-react'

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="min-h-[600px] flex items-center justify-center bg-white">
          <div className="container mx-auto px-6 md:px-8 lg:px-12 text-center">
            <h1 className="text-5xl md:text-6xl font-bold leading-tight text-gray-900 mb-6">
              Encontre Licitações Públicas
              <span className="text-orange-500"> em Todo o Brasil</span>
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Centralize oportunidades de licitações, receba alertas personalizados 
              e gerencie suas participações em um só lugar.
            </p>
            <Link href="/cadastro">
              <Button size="lg" className="text-lg px-8 py-4">
                Começar Agora
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-6 md:px-8 lg:px-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">
              Funcionalidades Principais
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
              <Card className="hover:scale-105 transition-transform duration-200 hover:shadow-lg">
                <CardHeader>
                  <FileText className="w-12 h-12 text-orange-500 mb-4" />
                  <CardTitle>Boletim Diário</CardTitle>
                  <CardDescription>
                    Acompanhe todas as licitações publicadas diariamente em um calendário interativo.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:scale-105 transition-transform duration-200 hover:shadow-lg">
                <CardHeader>
                  <Filter className="w-12 h-12 text-orange-500 mb-4" />
                  <CardTitle>Filtros Avançados</CardTitle>
                  <CardDescription>
                    Busque licitações por modalidade, localização, valor e muito mais.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:scale-105 transition-transform duration-200 hover:shadow-lg">
                <CardHeader>
                  <Bell className="w-12 h-12 text-orange-500 mb-4" />
                  <CardTitle>Alertas Personalizados</CardTitle>
                  <CardDescription>
                    Receba notificações por email quando novas licitações corresponderem aos seus critérios.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16 md:py-24 bg-orange-50">
          <div className="container mx-auto px-6 md:px-8 lg:px-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">
              O que nossos clientes dizem
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
              <div className="bg-orange-50 rounded-lg p-6">
                <p className="text-gray-700 italic mb-4">
                  "O sistema nos ajudou a encontrar oportunidades que antes passavam despercebidas. 
                  Aumentamos nossa participação em licitações em 40%."
                </p>
                <p className="font-semibold text-gray-900">João Silva</p>
                <p className="text-sm text-gray-500">Construção Civil</p>
              </div>

              <div className="bg-orange-50 rounded-lg p-6">
                <p className="text-gray-700 italic mb-4">
                  "Os alertas personalizados são perfeitos. Não perdemos mais nenhuma oportunidade 
                  relevante para nosso negócio."
                </p>
                <p className="font-semibold text-gray-900">Maria Santos</p>
                <p className="text-sm text-gray-500">Serviços de TI</p>
              </div>

              <div className="bg-orange-50 rounded-lg p-6">
                <p className="text-gray-700 italic mb-4">
                  "Interface simples e intuitiva. Conseguimos gerenciar todas as nossas 
                  participações em licitações de forma muito mais eficiente."
                </p>
                <p className="font-semibold text-gray-900">Carlos Oliveira</p>
                <p className="text-sm text-gray-500">Equipamentos Médicos</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-6 md:px-8 lg:px-12 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold mb-6">
              Pronto para começar?
            </h2>
            <p className="text-base md:text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Cadastre-se gratuitamente e comece a encontrar oportunidades de licitações hoje mesmo.
            </p>
            <Link href="/cadastro">
              <Button size="lg" className="text-lg px-8 py-4">
                Criar Conta Grátis
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}


