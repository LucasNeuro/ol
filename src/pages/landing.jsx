import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PublicRoute } from '@/components/PublicRoute'
import { Search, Bell, Star, TrendingUp, Clock, Shield, Zap, FileText, Filter, CheckCircle, ArrowRight, Building2, MapPin } from 'lucide-react'

export function LandingPage() {
  return (
    <PublicRoute>
      <PublicLayout>
      <div className="bg-gradient-to-b from-white to-gray-50">
        {/* Hero Section - Moderno e Impactante */}
        <section className="py-20 md:py-28 bg-gradient-to-br from-orange-50 via-white to-orange-50">
          <div className="container mx-auto px-6 md:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Conteúdo à esquerda */}
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium mb-6">
                  <Zap className="w-4 h-4" />
                  Acesso a +50.000 licitações
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                  Todas as licitações do Brasil
                  <span className="block text-orange-500 mt-2">em um só lugar</span>
                </h1>
                
                <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                  Encontre oportunidades, receba alertas automáticos e gerencie seus processos licitatórios com eficiência e praticidade.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 mb-12">
                  <Link href="/cadastro">
                    <a className="inline-block">
                      <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 bg-orange-500 hover:bg-orange-600 font-semibold shadow-lg">
                        <Zap className="w-5 h-5 mr-2" />
                        Cadastre-se
                      </Button>
                    </a>
                  </Link>
                  <Link href="/login">
                    <a className="inline-block">
                      <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 border-2 font-semibold">
                        <ArrowRight className="w-5 h-5 mr-2" />
                        Já tenho conta
                      </Button>
                    </a>
                  </Link>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <div className="text-3xl font-bold text-gray-900">10k+</div>
                    <div className="text-sm text-gray-600">Licitações ativas</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900">R$ 45M</div>
                    <div className="text-sm text-gray-600">Em contratos</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900">24/7</div>
                    <div className="text-sm text-gray-600">Atualização</div>
                  </div>
                </div>
              </div>

              {/* Exemplos de licitações à direita */}
              <div className="relative">
                <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Oportunidades Recentes</h3>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                      Novo!
                    </span>
                  </div>

                  {/* Exemplo 1 */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200">
                    <div className="text-xs text-blue-600 font-medium mb-1">Pregão Eletrônico #2929/2025</div>
                    <h4 className="font-semibold text-gray-900 mb-3">Aquisição de Material de Escritório</h4>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building2 className="w-4 h-4" />
                        <span className="text-xs">Prefeitura SP</span>
                        <MapPin className="w-4 h-4 ml-2" />
                        <span className="text-xs">São Paulo - SP</span>
                      </div>
                      <div className="font-bold text-green-600">R$ 50k</div>
                    </div>
                  </div>

                  {/* Exemplo 2 */}
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl border border-purple-200">
                    <div className="text-xs text-purple-600 font-medium mb-1">Concorrência #1234/2025</div>
                    <h4 className="font-semibold text-gray-900 mb-3">Serviços de TI</h4>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building2 className="w-4 h-4" />
                        <span className="text-xs">UFMG</span>
                        <MapPin className="w-4 h-4 ml-2" />
                        <span className="text-xs">Belo Horizonte - MG</span>
                      </div>
                      <div className="font-bold text-green-600">R$ 120k</div>
                    </div>
                  </div>

                  {/* Exemplo 3 */}
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl border border-green-200">
                    <div className="text-xs text-green-600 font-medium mb-1">Dispensa #789/2025</div>
                    <h4 className="font-semibold text-gray-900 mb-3">Reforma de Prédio Público</h4>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building2 className="w-4 h-4" />
                        <span className="text-xs">Gov. RJ</span>
                        <MapPin className="w-4 h-4 ml-2" />
                        <span className="text-xs">Rio de Janeiro - RJ</span>
                      </div>
                      <div className="font-bold text-green-600">R$ 230k</div>
                    </div>
                  </div>
                </div>

                {/* Elemento decorativo */}
                <div className="absolute -top-4 -right-4 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-4 -left-4 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 md:py-28 bg-white">
          <div className="container mx-auto px-6 md:px-8 lg:px-12">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Funcionalidades Poderosas
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Tudo que você precisa para ter sucesso em licitações públicas
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              <Card className="border-2 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                    <Search className="w-7 h-7 text-orange-500" />
                  </div>
                  <CardTitle className="text-xl">Busca Inteligente</CardTitle>
                  <CardDescription className="text-base">
                    Encontre exatamente o que procura com filtros avançados por modalidade, valor, órgão e região.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Bell className="w-7 h-7 text-blue-500" />
                  </div>
                  <CardTitle className="text-xl">Alertas Automáticos</CardTitle>
                  <CardDescription className="text-base">
                    Receba notificações em tempo real quando novas oportunidades corresponderem ao seu perfil.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="w-14 h-14 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                    <Star className="w-7 h-7 text-yellow-500" />
                  </div>
                  <CardTitle className="text-xl">Favoritos</CardTitle>
                  <CardDescription className="text-base">
                    Salve e organize suas licitações de interesse para acompanhamento contínuo.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <FileText className="w-7 h-7 text-green-500" />
                  </div>
                  <CardTitle className="text-xl">Documentação Completa</CardTitle>
                  <CardDescription className="text-base">
                    Acesse editais, termos de referência e anexos de forma organizada e rápida.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="w-14 h-14 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-7 h-7 text-purple-500" />
                  </div>
                  <CardTitle className="text-xl">Análises e Relatórios</CardTitle>
                  <CardDescription className="text-base">
                    Visualize estatísticas e tendências para tomar decisões mais informadas.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="w-14 h-14 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                    <Shield className="w-7 h-7 text-red-500" />
                  </div>
                  <CardTitle className="text-xl">Segurança e Privacidade</CardTitle>
                  <CardDescription className="text-base">
                    Seus dados protegidos com criptografia e conformidade total com a LGPD.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Como Funciona */}
        <section className="py-20 md:py-28 bg-gray-50">
          <div className="container mx-auto px-6 md:px-8 lg:px-12">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Como Funciona
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Simples, rápido e eficiente
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                    1
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Cadastre-se Grátis</h3>
                  <p className="text-gray-600">
                    Crie sua conta em menos de 2 minutos. Sem cartão de crédito necessário.
                  </p>
                </div>
                <div className="hidden md:block absolute top-8 -right-4 w-8 h-0.5 bg-orange-300"></div>
              </div>

              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                    2
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Configure Alertas</h3>
                  <p className="text-gray-600">
                    Defina seus critérios e receba notificações de novas oportunidades.
                  </p>
                </div>
                <div className="hidden md:block absolute top-8 -right-4 w-8 h-0.5 bg-orange-300"></div>
              </div>

              <div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                    3
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Participe e Vença</h3>
                  <p className="text-gray-600">
                    Acesse documentos, acompanhe prazos e gerencie suas participações.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefícios */}
        <section className="py-20 md:py-28 bg-white">
          <div className="container mx-auto px-6 md:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                  Por que escolher o Sistema Licitação?
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Economia de Tempo</h3>
                      <p className="text-gray-600">
                        Encontre oportunidades em minutos, não em horas. Tudo centralizado em uma única plataforma.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Não Perca Oportunidades</h3>
                      <p className="text-gray-600">
                        Alertas automáticos garantem que você seja notificado de novas licitações relevantes.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Gestão Simplificada</h3>
                      <p className="text-gray-600">
                        Organize favoritos, acompanhe prazos e gerencie documentos em um só lugar.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-orange-600" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Dados Confiáveis</h3>
                      <p className="text-gray-600">
                        Informações atualizadas diretamente do Portal Nacional de Contratações Públicas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-8 text-white shadow-2xl">
                  <h3 className="text-2xl font-bold mb-6">Comece Gratuitamente</h3>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                      <span>Acesso ilimitado a todas as licitações</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                      <span>Alertas personalizados por email</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                      <span>Gestão de favoritos ilimitada</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                      <span>Suporte técnico dedicado</span>
                    </li>
                  </ul>
                  <Link href="/cadastro">
                    <a className="block">
                      <Button size="lg" className="w-full bg-white text-orange-600 hover:bg-gray-100 text-lg py-6 font-semibold shadow-lg">
                        Criar Conta Grátis
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </a>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof / Stats */}
        <section className="py-16 bg-gray-900 text-white">
          <div className="container mx-auto px-6 md:px-8 lg:px-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl md:text-5xl font-bold text-orange-400 mb-2">50k+</div>
                <div className="text-gray-400">Licitações no sistema</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-orange-400 mb-2">500+</div>
                <div className="text-gray-400">Empresas cadastradas</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-orange-400 mb-2">R$ 100M+</div>
                <div className="text-gray-400">Em oportunidades</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-orange-400 mb-2">99.9%</div>
                <div className="text-gray-400">Uptime garantido</div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 md:py-28 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="container mx-auto px-6 md:px-8 lg:px-12 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Comece a encontrar oportunidades hoje
            </h2>
            <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Junte-se a centenas de empresas que já estão usando o Sistema Licitação para crescer seus negócios.
            </p>
            <p className="text-sm mt-6 opacity-75">
              Sem cartão de crédito • Sem compromisso • Cancele quando quiser
            </p>
          </div>
        </section>
      </div>
      </PublicLayout>
    </PublicRoute>
  )
}


