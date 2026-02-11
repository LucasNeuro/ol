import { Link, useLocation } from 'wouter'
import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Calendar, Filter, Star, Loader2, FileText, Plus, TrendingUp, MapPin, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useUserStore } from '@/store/userStore'
import { usePalavrasFortes } from '@/hooks/usePalavrasFortes'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { 
  extrairPalavrasChaveDosSetores, 
  correspondeAtividades
} from '@/lib/filtroSemantico'

function DashboardContent() {
  // Usar useUserStore para garantir consistência com outras páginas (mesmo padrão de favoritos.jsx)
  const { user } = useUserStore()
  const [, setLocation] = useLocation()
  
  // Redirecionar usuários não-admin para licitações (dashboard é apenas para admins)
  useEffect(() => {
    if (user && !user?.is_adm) {
      setLocation('/licitacoes')
    }
  }, [user, setLocation])
  
  // Debug: verificar user
  console.log('🔍 Dashboard - User:', user)
  console.log('🔍 Dashboard - User ID:', user?.id)

  // Calcular início e fim da semana atual
  const inicioSemana = startOfWeek(new Date(), { locale: ptBR })
  const fimSemana = endOfWeek(new Date(), { locale: ptBR })

  // Buscar perfil do usuário
  const { data: perfilUsuario } = useQuery({
    queryKey: ['perfil-usuario', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      
      let { data, error } = await supabase
        .from('profiles')
        .select('setores_atividades, estados_interesse, sinonimos_personalizados')
        .eq('id', user.id)
        .maybeSingle()
      
      if (error && error.code === '42703') {
        const { data: dataSemSinonimos, error: errorSemSinonimos } = await supabase
          .from('profiles')
          .select('setores_atividades, estados_interesse')
          .eq('id', user.id)
          .maybeSingle()
        
        if (errorSemSinonimos) return null
        return { ...dataSemSinonimos, sinonimos_personalizados: {} }
      }
      
      if (error) return null
      return { ...data, sinonimos_personalizados: data?.sinonimos_personalizados || {} }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60,
  })

  // Palavras fortes por setor (dinâmico, do banco) para filtro de preferência
  const { data: palavrasFortesPorSetor = {} } = usePalavrasFortes()

  // Buscar licitações usando a mesma lógica da página de licitações
  // Buscar mais licitações quando tem perfil configurado (igual à página de licitações)
  const temPerfilConfigurado = perfilUsuario && (
    (perfilUsuario.estados_interesse && perfilUsuario.estados_interesse.length > 0) ||
    (perfilUsuario.setores_atividades && perfilUsuario.setores_atividades.length > 0)
  )

  const { data: todasLicitacoes = [], isLoading: loadingTodasLicitacoes } = useQuery({
    queryKey: ['dashboard', 'todas-licitacoes', temPerfilConfigurado],
    queryFn: async () => {
      let query = supabase
        .from('licitacoes')
        .select(`
          id,
          numero_controle_pncp,
          objeto_compra,
          data_publicacao_pncp,
          data_atualizacao,
          uf_sigla,
          modalidade_nome,
          orgao_razao_social,
          valor_total_estimado,
          dados_completos,
          anexos,
          itens
        `)
        .order('data_publicacao_pncp', { ascending: false })

      // Buscar mais licitações para garantir que encontramos todas as relevantes
      // A página de licitações busca 2000, mas vamos buscar mais no dashboard para ter certeza
      if (temPerfilConfigurado) {
        query = query.limit(5000) // Mais licitações para garantir que encontramos todas as relevantes
      } else {
        query = query.limit(10000) // Mais licitações quando não tem perfil (para mostrar todas)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos (igual à página de licitações)
  })

  // Aplicar filtro semântico em um useMemo (mais rápido, não trava)
  const licitacoesFiltradas = useMemo(() => {
    if (!todasLicitacoes || todasLicitacoes.length === 0) return []
    if (!perfilUsuario || !perfilUsuario.setores_atividades || perfilUsuario.setores_atividades.length === 0) {
      return todasLicitacoes
    }

    const estadosInteresse = perfilUsuario.estados_interesse || []
    const setoresAtividades = perfilUsuario.setores_atividades || []

    let resultado = todasLicitacoes

    // Filtrar por estados (síncrono, rápido)
    if (estadosInteresse.length > 0) {
      const temNacional = estadosInteresse.some(e => 
        typeof e === 'string' ? e === 'Nacional' : e === 'Nacional'
      )
      
      if (!temNacional) {
        resultado = resultado.filter(licitacao => {
          const uf = licitacao.uf_sigla?.toUpperCase()
          return estadosInteresse.some(estado => {
            const estadoUpper = typeof estado === 'string' ? estado.toUpperCase() : estado
            return estadoUpper === uf
          })
        })
      }
    }

    // Usar a mesma função correspondeAtividades da página de licitações (sem IA para não travar)
    // Isso garante que o dashboard mostre os mesmos números que a página de licitações
    if (setoresAtividades.length > 0) {
      const sinonimosPersonalizados = perfilUsuario.sinonimos_personalizados || {}
      const palavrasChave = extrairPalavrasChaveDosSetores(setoresAtividades, sinonimosPersonalizados)
      
      console.log('🔍 [Dashboard] Filtro semântico:', {
        antesFiltro: resultado.length,
        palavrasPrincipais: palavrasChave.principais?.length || 0,
        palavrasSecundarias: palavrasChave.secundarias?.length || 0,
        palavrasTodas: palavrasChave.todas?.length || 0
      })
      
      if (palavrasChave.todas && palavrasChave.todas.length > 0) {
        // Usar a mesma função de correspondência (sem IA) para garantir consistência
        const antesFiltroSemantico = resultado.length
        resultado = resultado.filter(licitacao => {
          return correspondeAtividades(
            licitacao,
            palavrasChave,
            sinonimosPersonalizados,
            {}, // sem sinonimosBanco
            setoresAtividades,
            palavrasFortesPorSetor // Palavras fortes dinâmicas (banco)
          )
        })
        
        console.log('✅ [Dashboard] Após filtro semântico:', {
          antes: antesFiltroSemantico,
          depois: resultado.length,
          removidas: antesFiltroSemantico - resultado.length
        })
      } else {
        console.warn('⚠️ [Dashboard] Sem palavras-chave válidas, não aplicando filtro semântico')
      }
    }

    return resultado
  }, [todasLicitacoes, perfilUsuario, palavrasFortesPorSetor])

  const loadingLicitacoes = loadingTodasLicitacoes

  // Total de Licitações (filtradas) - usar o mesmo cálculo da página de licitações
  // O dashboard mostra o total SEM filtros permanentes (que são específicos da página de licitações)
  const totalLicitacoes = licitacoesFiltradas.length
  
  // Log para debug
  useEffect(() => {
    if (todasLicitacoes.length > 0) {
      console.log('📊 [Dashboard] Debug:', {
        todasLicitacoes: todasLicitacoes.length,
        licitacoesFiltradas: totalLicitacoes,
        temPerfil: !!perfilUsuario,
        temSetores: perfilUsuario?.setores_atividades?.length > 0,
        temEstados: perfilUsuario?.estados_interesse?.length > 0,
        setores: perfilUsuario?.setores_atividades?.map(s => s.setor).join(', ') || 'nenhum',
        estados: perfilUsuario?.estados_interesse?.join(', ') || 'nenhum'
      })
    }
  }, [todasLicitacoes.length, totalLicitacoes, perfilUsuario])
  
  // Log para debug
  console.log('📊 [Dashboard] Total de licitações filtradas:', totalLicitacoes)

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

  // Licitações desta semana (filtradas)
  const licitacoesSemana = useMemo(() => {
    if (!licitacoesFiltradas || licitacoesFiltradas.length === 0) return 0
    
    const inicioSemanaStr = format(inicioSemana, 'yyyy-MM-dd')
    const fimSemanaStr = format(fimSemana, 'yyyy-MM-dd')
    
    return licitacoesFiltradas.filter(lic => {
      const dataPub = lic.data_publicacao_pncp
      return dataPub && dataPub >= inicioSemanaStr && dataPub <= fimSemanaStr
    }).length
  }, [licitacoesFiltradas, inicioSemana, fimSemana])

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

      if (errorFavoritos) throw errorFavoritos

      const atividades = (favoritos || []).map(f => ({
        tipo: 'favorito',
        data: f.data_adicao,
        titulo: f.licitacoes?.objeto_compra || 'Licitação favoritada',
        descricao: f.licitacoes?.numero_controle_pncp || '',
        id: f.id,
      })).sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5)

      return atividades
    },
    enabled: !!user?.id,
  })

  // Dados para gráficos
  const coresGraficos = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  // Gráfico Donut: Distribuição por Modalidade (filtradas)
  const dadosModalidade = useMemo(() => {
    if (!licitacoesFiltradas || licitacoesFiltradas.length === 0) return []

    const agrupado = licitacoesFiltradas.reduce((acc, item) => {
      const modalidade = item.modalidade_nome || 'Não informado'
      acc[modalidade] = (acc[modalidade] || 0) + 1
      return acc
    }, {})

    return Object.entries(agrupado)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [licitacoesFiltradas])

  // Gráfico Donut: Distribuição por UF (Top 5) - filtradas
  const dadosUF = useMemo(() => {
    if (!licitacoesFiltradas || licitacoesFiltradas.length === 0) return []

    const agrupado = licitacoesFiltradas.reduce((acc, item) => {
      const uf = item.uf_sigla || 'Não informado'
      acc[uf] = (acc[uf] || 0) + 1
      return acc
    }, {})

    return Object.entries(agrupado)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [licitacoesFiltradas])

  // Gráfico Barras: Licitações por dia da semana atual (filtradas)
  const dadosSemana = useMemo(() => {
    const dias = eachDayOfInterval({ start: inicioSemana, end: fimSemana })
    const diasFormatados = dias.map(dia => ({
      dia: format(dia, 'EEE', { locale: ptBR }),
      data: format(dia, 'yyyy-MM-dd'),
      valor: 0,
    }))

    if (!licitacoesFiltradas || licitacoesFiltradas.length === 0) {
      return diasFormatados
    }

    // Filtrar licitações da semana
    const inicioSemanaStr = format(inicioSemana, 'yyyy-MM-dd')
    const fimSemanaStr = format(fimSemana, 'yyyy-MM-dd')
    
    const licitacoesDaSemana = licitacoesFiltradas.filter(lic => {
      const dataPub = lic.data_publicacao_pncp
      return dataPub && dataPub >= inicioSemanaStr && dataPub <= fimSemanaStr
    })

    // Contar por dia
    const contagemPorDia = licitacoesDaSemana.reduce((acc, item) => {
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
  }, [licitacoesFiltradas, inicioSemana, fimSemana])

  // Gráfico Barras: Valores estimados por modalidade (Top 5) - filtradas
  const dadosValoresModalidade = useMemo(() => {
    if (!licitacoesFiltradas || licitacoesFiltradas.length === 0) return []

    // Agrupar e somar valores por modalidade
    const agrupado = licitacoesFiltradas
      .filter(item => item.modalidade_nome && item.valor_total_estimado)
      .reduce((acc, item) => {
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
  }, [licitacoesFiltradas])

  const isLoading = loadingLicitacoes || loadingFavoritos
  const isLoadingGraficos = loadingLicitacoes

  return (
    <AppLayout>
      <div className="py-8 px-4 md:px-6 lg:px-8 xl:px-12">
        <div className="w-full max-w-[95%] xl:max-w-[1400px] mx-auto">
          {/* Header do Dashboard Admin */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Dashboard Administrativo
            </h1>
            <p className="text-gray-600">
              Visão geral de todas as licitações do sistema
            </p>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {perfilUsuario?.setores_atividades?.length > 0 
                        ? 'Licitações Relevantes' 
                        : 'Total de Licitações'}
                    </p>
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {totalLicitacoes.toLocaleString('pt-BR')}
                      </p>
                    )}
                    {perfilUsuario?.setores_atividades?.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Filtradas por seu perfil
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
                    <p className="text-sm font-medium text-gray-600">Esta Semana</p>
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {licitacoesSemana.toLocaleString('pt-BR')}
                      </p>
                    )}
                    {perfilUsuario?.setores_atividades?.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Relevantes para sua empresa
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-8">
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
                <CardDescription>
                  {perfilUsuario?.setores_atividades?.length > 0 
                    ? 'Estados das licitações relevantes para sua empresa'
                    : 'Licitações por estado brasileiro'}
                </CardDescription>
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
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {atividadeRecente.map((atividade) => (
                    <div
                      key={`${atividade.tipo}-${atividade.id}`}
                      className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-yellow-100">
                        <Star className="w-5 h-5 text-yellow-600" />
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


