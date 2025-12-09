import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Calendar, Filter, Bell, Star, Loader2, FileText, Plus, TrendingUp, MapPin, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useUserStore } from '@/store/userStore'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function DashboardContent() {
  // Usar useUserStore para garantir consistência com outras páginas (mesmo padrão de favoritos.jsx)
  const { user } = useUserStore()
  
  // Debug: verificar user
  console.log('🔍 Dashboard - User:', user)
  console.log('🔍 Dashboard - User ID:', user?.id)

  // Calcular início e fim da semana atual
  const inicioSemana = startOfWeek(new Date(), { locale: ptBR })
  const fimSemana = endOfWeek(new Date(), { locale: ptBR })

  // Total de Licitações
  const { data: totalLicitacoes = 0, isLoading: loadingLicitacoes } = useQuery({
    queryKey: ['dashboard', 'total-licitacoes'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('licitacoes')
        .select('*', { count: 'exact', head: true })

      if (error) throw error
      return count || 0
    },
  })

  // Total de Favoritos do usuário
  const { data: totalFavoritos = 0, isLoading: loadingFavoritos } = useQuery({
    queryKey: ['dashboard', 'favoritos', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('⚠️ Dashboard - Sem user.id, retornando 0')
        return 0
      }

      console.log('🔍 Dashboard - Buscando favoritos para usuário:', user.id)
      
      const { count, error } = await supabase
        .from('licitacoes_favoritas')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', user.id)

      if (error) {
        console.error('❌ Dashboard - Erro ao buscar favoritos:', error)
        throw error
      }
      
      console.log('✅ Dashboard - Total de favoritos encontrados:', count)
      return count || 0
    },
    enabled: !!user?.id,
  })

  // Total de Alertas Ativos do usuário
  const { data: totalAlertas = 0, isLoading: loadingAlertas } = useQuery({
    queryKey: ['dashboard', 'alertas', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0

      const { count, error } = await supabase
        .from('alertas_usuario')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .eq('ativo', true)

      if (error) throw error
      return count || 0
    },
    enabled: !!user?.id,
  })

  // Licitações desta semana
  const { data: licitacoesSemana = 0, isLoading: loadingSemana } = useQuery({
    queryKey: ['dashboard', 'licitacoes-semana'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('licitacoes')
        .select('*', { count: 'exact', head: true })
        .gte('data_publicacao_pncp', format(inicioSemana, 'yyyy-MM-dd'))
        .lte('data_publicacao_pncp', format(fimSemana, 'yyyy-MM-dd'))

      if (error) throw error
      return count || 0
    },
  })

  // Atividade Recente
  const { data: atividadeRecente = [], isLoading: loadingAtividade } = useQuery({
    queryKey: ['dashboard', 'atividade', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      // Buscar últimas 5 favoritos adicionados
      const { data: favoritos, error: errorFavoritos } = await supabase
        .from('licitacoes_favoritas')
        .select(`
          id,
          data_adicao,
          licitacoes (
            id,
            objeto_compra,
            numero_controle_pncp
          )
        `)
        .eq('usuario_id', user.id)
        .order('data_adicao', { ascending: false })
        .limit(3)

      // Buscar últimos 2 alertas criados
      const { data: alertas, error: errorAlertas } = await supabase
        .from('alertas_usuario')
        .select('id, nome_alerta, created_at')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2)

      if (errorFavoritos || errorAlertas) {
        throw errorFavoritos || errorAlertas
      }

      // Combinar e ordenar por data
      const atividades = [
        ...(favoritos || []).map(f => ({
          tipo: 'favorito',
          data: f.data_adicao,
          titulo: f.licitacoes?.objeto_compra || 'Licitação favoritada',
          descricao: f.licitacoes?.numero_controle_pncp || '',
          id: f.id,
        })),
        ...(alertas || []).map(a => ({
          tipo: 'alerta',
          data: a.created_at,
          titulo: `Alerta: ${a.nome_alerta}`,
          descricao: 'Alerta configurado',
          id: a.id,
        })),
      ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5)

      return atividades
    },
    enabled: !!user?.id,
  })

  // Dados para gráficos
  const coresGraficos = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  // Gráfico Donut: Distribuição por Modalidade
  const { data: dadosModalidade = [], isLoading: loadingModalidade } = useQuery({
    queryKey: ['dashboard', 'modalidade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licitacoes')
        .select('modalidade_nome')
        .not('modalidade_nome', 'is', null)

      if (error) throw error

      // Agrupar por modalidade
      const agrupado = (data || []).reduce((acc, item) => {
        const modalidade = item.modalidade_nome || 'Não informado'
        acc[modalidade] = (acc[modalidade] || 0) + 1
        return acc
      }, {})

      // Converter para array e ordenar
      return Object.entries(agrupado)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    },
  })

  // Gráfico Donut: Distribuição por UF (Top 5)
  const { data: dadosUF = [], isLoading: loadingUF } = useQuery({
    queryKey: ['dashboard', 'uf'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licitacoes')
        .select('uf_sigla')
        .not('uf_sigla', 'is', null)

      if (error) throw error

      // Agrupar por UF
      const agrupado = (data || []).reduce((acc, item) => {
        const uf = item.uf_sigla || 'Não informado'
        acc[uf] = (acc[uf] || 0) + 1
        return acc
      }, {})

      // Converter para array e ordenar
      return Object.entries(agrupado)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    },
  })

  // Gráfico Barras: Licitações por dia da semana atual
  const { data: dadosSemana = [], isLoading: loadingDadosSemana } = useQuery({
    queryKey: ['dashboard', 'semana-dias'],
    queryFn: async () => {
      const dias = eachDayOfInterval({ start: inicioSemana, end: fimSemana })
      const diasFormatados = dias.map(dia => ({
        dia: format(dia, 'EEE', { locale: ptBR }),
        data: format(dia, 'yyyy-MM-dd'),
        valor: 0,
      }))

      // Buscar licitações da semana
      const { data, error } = await supabase
        .from('licitacoes')
        .select('data_publicacao_pncp')
        .gte('data_publicacao_pncp', format(inicioSemana, 'yyyy-MM-dd'))
        .lte('data_publicacao_pncp', format(fimSemana, 'yyyy-MM-dd'))

      if (error) throw error

      // Contar por dia
      const contagemPorDia = (data || []).reduce((acc, item) => {
        const dataPub = item.data_publicacao_pncp
        if (dataPub) {
          acc[dataPub] = (acc[dataPub] || 0) + 1
        }
        return acc
      }, {})

      // Preencher dados
      return diasFormatados.map(item => ({
        ...item,
        valor: contagemPorDia[item.data] || 0,
      }))
    },
  })

  // Gráfico Barras: Valores estimados por modalidade (Top 5)
  const { data: dadosValoresModalidade = [], isLoading: loadingValoresModalidade } = useQuery({
    queryKey: ['dashboard', 'valores-modalidade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licitacoes')
        .select('modalidade_nome, valor_total_estimado')
        .not('modalidade_nome', 'is', null)
        .not('valor_total_estimado', 'is', null)

      if (error) throw error

      // Agrupar e somar valores por modalidade
      const agrupado = (data || []).reduce((acc, item) => {
        const modalidade = item.modalidade_nome || 'Não informado'
        const valor = parseFloat(item.valor_total_estimado) || 0
        if (!acc[modalidade]) {
          acc[modalidade] = { name: modalidade, valor: 0, count: 0 }
        }
        acc[modalidade].valor += valor
        acc[modalidade].count += 1
        return acc
      }, {})

      // Converter para array, calcular média e ordenar
      return Object.values(agrupado)
        .map(item => ({
          name: item.name,
          valor: item.valor / 1000000, // Converter para milhões
          count: item.count,
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5)
    },
  })

  const isLoading = loadingLicitacoes || loadingFavoritos || loadingAlertas || loadingSemana
  const isLoadingGraficos = loadingModalidade || loadingUF || loadingDadosSemana || loadingValoresModalidade

  return (
    <AppLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header do Dashboard */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bem-vindo ao Dashboard
            </h1>
            <p className="text-gray-600">
              Gerencie suas licitações e oportunidades
            </p>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total de Licitações</p>
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {totalLicitacoes.toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Filter className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Favoritos</p>
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {totalFavoritos.toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Star className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Alertas Ativos</p>
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {totalAlertas.toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bell className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Esta Semana</p>
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {licitacoesSemana.toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Gráfico Donut: Distribuição por Modalidade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  Distribuição por Modalidade
                </CardTitle>
                <CardDescription>Licitações agrupadas por tipo de modalidade</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingGraficos ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : dadosModalidade.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Nenhum dado disponível</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dadosModalidade}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        innerRadius={50}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {dadosModalidade.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={coresGraficos[index % coresGraficos.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Gráfico Donut: Distribuição por UF */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Distribuição por Estado (Top 5)
                </CardTitle>
                <CardDescription>Licitações por estado brasileiro</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingGraficos ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : dadosUF.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Nenhum dado disponível</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dadosUF}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        innerRadius={50}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {dadosUF.map((entry, index) => (
                          <Cell key={`cell-uf-${index}`} fill={coresGraficos[index % coresGraficos.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Gráfico Barras: Licitações por dia da semana */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-600" />
                  Licitações desta Semana
                </CardTitle>
                <CardDescription>Publicações por dia da semana atual</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingGraficos ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : dadosSemana.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Nenhum dado disponível</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dadosSemana}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dia" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="valor" fill="#f97316" name="Licitações" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Gráfico Barras: Valores por Modalidade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                  Valores por Modalidade (Top 5)
                </CardTitle>
                <CardDescription>Valor total estimado em milhões de reais</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingGraficos ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : dadosValoresModalidade.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Nenhum dado disponível</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dadosValoresModalidade}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => [`R$ ${value.toFixed(2)}M`, 'Valor Total']}
                      />
                      <Legend />
                      <Bar dataKey="valor" fill="#8b5cf6" name="Valor (R$ milhões)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Atividade Recente */}
          <Card>
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>Suas últimas ações no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAtividade ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Carregando atividades...</p>
                </div>
              ) : atividadeRecente.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Nenhuma atividade recente</p>
                  <p className="text-sm mt-2">Comece explorando as licitações disponíveis</p>
                  <div className="mt-6 flex gap-3 justify-center">
                    <Link href="/licitacoes">
                      <Button>
                        <FileText className="w-4 h-4 mr-2" />
                        Ver Licitações
                      </Button>
                    </Link>
                    <Link href="/alertas">
                      <Button variant="outline">
                        <Bell className="w-4 h-4 mr-2" />
                        Criar Alerta
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {atividadeRecente.map((atividade) => (
                    <div
                      key={`${atividade.tipo}-${atividade.id}`}
                      className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        atividade.tipo === 'favorito' 
                          ? 'bg-yellow-100' 
                          : 'bg-blue-100'
                      }`}>
                        {atividade.tipo === 'favorito' ? (
                          <Star className="w-5 h-5 text-yellow-600" />
                        ) : (
                          <Bell className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {atividade.titulo}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {atividade.descricao}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(atividade.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t">
                    <Link href="/favoritos">
                      <Button variant="outline" className="w-full">
                        Ver todas as atividades
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

export function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}


