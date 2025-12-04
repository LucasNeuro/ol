import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useUserStore } from '@/store/userStore'
import { useLocation } from 'wouter'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Calendar, 
  MapPin, 
  Building2, 
  DollarSign, 
  FileText, 
  Download,
  ExternalLink,
  Filter,
  X,
  Clock,
  Eye,
  Star,
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

function LicitacoesContent() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()
  const [location] = useLocation()
  const [licitacaoSelecionada, setLicitacaoSelecionada] = useState(null)
  const [sideoverAberto, setSideoverAberto] = useState(false)
  const [favoritos, setFavoritos] = useState(new Set())
  const [filtrosSidebarAberta, setFiltrosSidebarAberta] = useState(true)

  // Estados dos Filtros
  const [filtros, setFiltros] = useState({
    // Essenciais
    buscaObjeto: '',
    uf: '',
    modalidade: '',
    dataPublicacaoInicio: '',
    dataPublicacaoFim: '',
    valorMin: '',
    valorMax: '',
    
    // Úteis
    orgao: '',
    numeroEdital: '',
    comDocumentos: false,
    comItens: false,
    comValor: false,
    
    // Avançados
    situacao: '',
    esfera: '',
    modoDisputa: '',
    amparoLegal: ''
  })

  const [dataFiltro, setDataFiltro] = useState('')

  // Verificar se veio com data do calendário (query string)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const data = params.get('data')
    if (data) {
      // Converter de YYYYMMDD para YYYY-MM-DD
      const ano = data.substring(0, 4)
      const mes = data.substring(4, 6)
      const dia = data.substring(6, 8)
      const dataFormatada = `${ano}-${mes}-${dia}`
      setDataFiltro(dataFormatada)
      setDataInicio(dataFormatada)
      setDataFim(dataFormatada)
      console.log(`📅 Filtrando licitações do dia: ${dataFormatada}`)
        } else {
      setDataFiltro('')
      console.log('📋 Mostrando todas as licitações')
    }
  }, [location])

  // Buscar favoritos do usuário
  useQuery({
    queryKey: ['meus-favoritos', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await supabase
        .from('licitacoes_favoritas')
        .select('licitacao_id')
        .eq('usuario_id', user.id)
      
      const ids = new Set(data?.map(f => f.licitacao_id) || [])
      setFavoritos(ids)
      return data
    },
    enabled: !!user?.id
  })

  // Buscar licitações do banco com TODOS os filtros
  const { data: licitacoes = [], isLoading, error } = useQuery({
    queryKey: ['licitacoes', filtros, dataFiltro],
    queryFn: async () => {
      let query = supabase
        .from('licitacoes')
        .select('*')
        .order('data_publicacao_pncp', { ascending: false })

      // FILTROS ESSENCIAIS
      
      // Busca por Objeto
      if (filtros.buscaObjeto) {
        query = query.ilike('objeto_compra', `%${filtros.buscaObjeto}%`)
      }

      // UF
      if (filtros.uf) {
        query = query.eq('uf_sigla', filtros.uf.toUpperCase())
      }

      // Modalidade
      if (filtros.modalidade) {
        query = query.ilike('modalidade_nome', `%${filtros.modalidade}%`)
      }

      // Data Publicação
      if (filtros.dataPublicacaoInicio) {
        query = query.gte('data_publicacao_pncp', filtros.dataPublicacaoInicio)
      }
      if (filtros.dataPublicacaoFim) {
        query = query.lte('data_publicacao_pncp', filtros.dataPublicacaoFim)
      }

      // Valor Estimado
      if (filtros.valorMin) {
        query = query.gte('valor_total_estimado', parseFloat(filtros.valorMin))
      }
      if (filtros.valorMax) {
        query = query.lte('valor_total_estimado', parseFloat(filtros.valorMax))
      }

      // FILTROS ÚTEIS

      // Órgão
      if (filtros.orgao) {
        query = query.ilike('orgao_razao_social', `%${filtros.orgao}%`)
      }

      // Número Edital
      if (filtros.numeroEdital) {
        query = query.ilike('numero_controle_pncp', `%${filtros.numeroEdital}%`)
      }

      // Com Documentos
      if (filtros.comDocumentos) {
        query = query.neq('anexos', '[]')
      }

      // Com Itens
      if (filtros.comItens) {
        query = query.neq('itens', '[]')
      }

      // Com Valor
      if (filtros.comValor) {
        query = query.not('valor_total_estimado', 'is', null)
      }

      // Filtro de data do calendário (prioritário)
      if (dataFiltro) {
        query = query.eq('data_publicacao_pncp', dataFiltro)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    }
  })

  const formatarValor = (valor) => {
    if (!valor) return 'Não informado'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarData = (data) => {
    if (!data) return 'Não informada'
    return format(new Date(data), "dd/MM/yyyy", { locale: ptBR })
  }

  // Verificar se licitação é urgente (menos de 7 dias para abertura)
  const isUrgente = (licitacao) => {
    if (!licitacao.dados_completos?.dataAberturaProposta && !licitacao.dados_completos?.dataEncerramentoProposta) {
      return false
    }

    const dataAbertura = licitacao.dados_completos?.dataAberturaProposta
    const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta
    const dataReferencia = dataAbertura || dataEncerramento

    if (!dataReferencia) return false

    const hoje = new Date()
    const dataLimite = new Date(dataReferencia)
    const diasRestantes = Math.ceil((dataLimite - hoje) / (1000 * 60 * 60 * 24))

    // Urgente se falta menos de 7 dias
    return diasRestantes > 0 && diasRestantes <= 7
  }

  // Toggle favorito
  const toggleFavorito = useMutation({
    mutationFn: async (licitacao) => {
      if (!user?.id) {
        alert('Faça login para favoritar licitações')
          return
      }

      const isFavorito = favoritos.has(licitacao.id)

      if (isFavorito) {
        // Remover
        console.log('🗑️ Removendo dos favoritos...')
        const { error } = await supabase
          .from('licitacoes_favoritas')
          .delete()
          .eq('usuario_id', user.id)
          .eq('licitacao_id', licitacao.id)

        if (error) {
          console.error('❌ Erro ao remover:', error)
          throw error
        }
        console.log('✅ Removido dos favoritos')
      } else {
        // Verificar se já existe (evitar 409)
        console.log('🔍 Verificando se já existe...')
        const { data: existente } = await supabase
          .from('licitacoes_favoritas')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('licitacao_id', licitacao.id)
          .maybeSingle()

        if (existente) {
          console.log('⚠️ Já existe nos favoritos')
          return { licitacaoId: licitacao.id, isFavorito: false }
        }

        // Adicionar
        console.log('⭐ Adicionando aos favoritos...')
        const { error } = await supabase
          .from('licitacoes_favoritas')
          .insert({
            usuario_id: user.id,
            licitacao_id: licitacao.id,
            data_adicao: new Date().toISOString()
          })

        if (error) {
          console.error('❌ Erro ao adicionar:', error)
          throw error
        }
        console.log('✅ Adicionado aos favoritos')
      }

      return { licitacaoId: licitacao.id, isFavorito }
    },
    onSuccess: ({ licitacaoId, isFavorito }) => {
      // Atualizar estado local
      setFavoritos(prev => {
        const newSet = new Set(prev)
        if (isFavorito) {
          newSet.delete(licitacaoId)
        } else {
          newSet.add(licitacaoId)
        }
        return newSet
      })
      queryClient.invalidateQueries(['meus-favoritos'])
    }
  })

  const handleFavoritar = (e, licitacao) => {
    e.stopPropagation()
    toggleFavorito.mutate(licitacao)
  }

  const abrirDetalhes = (licitacao) => {
    setLicitacaoSelecionada(licitacao)
    setSideoverAberto(true)
  }

  const limparFiltros = () => {
    setFiltros({
      buscaObjeto: '',
      uf: '',
      modalidade: '',
      dataPublicacaoInicio: '',
      dataPublicacaoFim: '',
      valorMin: '',
      valorMax: '',
      orgao: '',
      numeroEdital: '',
      comDocumentos: false,
      comItens: false,
      comValor: false,
      situacao: '',
      esfera: '',
      modoDisputa: '',
      amparoLegal: ''
    })
    setDataFiltro('')
    window.history.pushState({}, '', '/licitacoes')
  }

  const aplicarFiltros = () => {
    queryClient.invalidateQueries(['licitacoes'])
    console.log('🔍 Filtros aplicados:', filtros)
  }

  const contarFiltrosAtivos = () => {
    let count = 0
    if (filtros.buscaObjeto) count++
    if (filtros.uf) count++
    if (filtros.modalidade) count++
    if (filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim) count++
    if (filtros.valorMin || filtros.valorMax) count++
    if (filtros.orgao) count++
    if (filtros.numeroEdital) count++
    if (filtros.comDocumentos) count++
    if (filtros.comItens) count++
    if (filtros.comValor) count++
    if (dataFiltro) count++
    return count
  }

  const atalhoHoje = () => {
    const hoje = new Date().toISOString().split('T')[0]
    setFiltros({ ...filtros, dataPublicacaoInicio: hoje, dataPublicacaoFim: hoje })
  }

  const atalhoOntem = () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    setFiltros({ ...filtros, dataPublicacaoInicio: ontem, dataPublicacaoFim: ontem })
  }

  const atalhoUltimaSemana = () => {
    const hoje = new Date().toISOString().split('T')[0]
    const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    setFiltros({ ...filtros, dataPublicacaoInicio: semanaAtras, dataPublicacaoFim: hoje })
  }

    return (
    <AppLayout 
      onToggleFiltros={() => setFiltrosSidebarAberta(!filtrosSidebarAberta)}
      filtrosAbertos={filtrosSidebarAberta}
    >
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar de Filtros (Fixed, à esquerda do conteúdo) */}
        <aside 
          className={`
            ${filtrosSidebarAberta ? 'w-[420px]' : 'w-0'}
            flex-shrink-0 bg-white border-r border-gray-200
            transition-all duration-300 ease-in-out
            overflow-hidden h-full
          `}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#e5e7eb transparent'
          }}
        >
          <div className="w-[420px] h-full overflow-y-auto p-6 space-y-6 filtros-sidebar">
            {/* Header Filtros */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Filter className="w-6 h-6 text-orange-500" />
                {contarFiltrosAtivos() > 0 && (
                  <Badge className="bg-orange-500">{contarFiltrosAtivos()}</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltrosSidebarAberta(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
                
            {/* Botões Ação */}
            <div className="flex gap-2 mb-6">
              <Button
                variant="outline"
                onClick={limparFiltros}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
              <Button
                onClick={aplicarFiltros}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                <Filter className="w-4 h-4 mr-2" />
                Aplicar
              </Button>
            </div>

            {/* Busca Rápida */}
            <div className="mb-4">
              <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Filter className="w-4 h-4 text-orange-500" />
                Busca Rápida
              </Label>
              <Input
                placeholder="Buscar por objeto..."
                value={filtros.buscaObjeto}
                onChange={(e) => setFiltros({ ...filtros, buscaObjeto: e.target.value })}
                className="h-10"
              />
      </div>
                
            {/* Accordion com Filtros */}
            <Accordion type="multiple" defaultValue={['essenciais', 'uteis']}>
              
              {/* ESSENCIAIS */}
              <AccordionItem value="essenciais">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-orange-500" />
                    Filtros Essenciais
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-3">
                
                  {/* Data Publicação */}
                <div>
                    <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      Data Publicação
                    </Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      type="date"
                      value={filtros.dataPublicacaoInicio}
                      onChange={(e) => setFiltros({ ...filtros, dataPublicacaoInicio: e.target.value })}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="date"
                      value={filtros.dataPublicacaoFim}
                      onChange={(e) => setFiltros({ ...filtros, dataPublicacaoFim: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={atalhoHoje} className="text-xs h-7 px-2 flex-1">Hoje</Button>
                    <Button variant="ghost" size="sm" onClick={atalhoOntem} className="text-xs h-7 px-2 flex-1">Ontem</Button>
                    <Button variant="ghost" size="sm" onClick={atalhoUltimaSemana} className="text-xs h-7 px-2 flex-1">7 dias</Button>
                  </div>
                </div>

                {/* UF */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    Estado (UF)
                  </Label>
                  <Select value={filtros.uf || "TODOS"} onValueChange={(value) => setFiltros({ ...filtros, uf: value === "TODOS" ? "" : value })}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="TODOS">Todos os Estados</SelectItem>
                      <SelectItem value="AC">AC - Acre</SelectItem>
                      <SelectItem value="AL">AL - Alagoas</SelectItem>
                      <SelectItem value="AP">AP - Amapá</SelectItem>
                      <SelectItem value="AM">AM - Amazonas</SelectItem>
                      <SelectItem value="BA">BA - Bahia</SelectItem>
                      <SelectItem value="CE">CE - Ceará</SelectItem>
                      <SelectItem value="DF">DF - Distrito Federal</SelectItem>
                      <SelectItem value="ES">ES - Espírito Santo</SelectItem>
                      <SelectItem value="GO">GO - Goiás</SelectItem>
                      <SelectItem value="MA">MA - Maranhão</SelectItem>
                      <SelectItem value="MT">MT - Mato Grosso</SelectItem>
                      <SelectItem value="MS">MS - Mato Grosso do Sul</SelectItem>
                      <SelectItem value="MG">MG - Minas Gerais</SelectItem>
                      <SelectItem value="PA">PA - Pará</SelectItem>
                      <SelectItem value="PB">PB - Paraíba</SelectItem>
                      <SelectItem value="PR">PR - Paraná</SelectItem>
                      <SelectItem value="PE">PE - Pernambuco</SelectItem>
                      <SelectItem value="PI">PI - Piauí</SelectItem>
                      <SelectItem value="RJ">RJ - Rio de Janeiro</SelectItem>
                      <SelectItem value="RN">RN - Rio Grande do Norte</SelectItem>
                      <SelectItem value="RS">RS - Rio Grande do Sul</SelectItem>
                      <SelectItem value="RO">RO - Rondônia</SelectItem>
                      <SelectItem value="RR">RR - Roraima</SelectItem>
                      <SelectItem value="SC">SC - Santa Catarina</SelectItem>
                      <SelectItem value="SP">SP - São Paulo</SelectItem>
                      <SelectItem value="SE">SE - Sergipe</SelectItem>
                      <SelectItem value="TO">TO - Tocantins</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
                
                {/* Modalidade */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Modalidade
                  </Label>
                  <Input
                    placeholder="Ex: Pregão"
                    value={filtros.modalidade}
                    onChange={(e) => setFiltros({ ...filtros, modalidade: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Valor */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    Valor Estimado
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Mínimo"
                      value={filtros.valorMin}
                      onChange={(e) => setFiltros({ ...filtros, valorMin: e.target.value })}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Máximo"
                      value={filtros.valorMax}
                      onChange={(e) => setFiltros({ ...filtros, valorMax: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ÚTEIS */}
            <AccordionItem value="uteis">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-500" />
                  Filtros Úteis
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-3">
                
                {/* Órgão */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    Órgão
                  </Label>
                  <Input
                    placeholder="Nome do órgão"
                    value={filtros.orgao}
                    onChange={(e) => setFiltros({ ...filtros, orgao: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                {/* N° Edital */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    N° Edital
                  </Label>
                  <Input
                    placeholder="Número do edital"
                    value={filtros.numeroEdital}
                    onChange={(e) => setFiltros({ ...filtros, numeroEdital: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="comDocumentos"
                      checked={filtros.comDocumentos}
                      onCheckedChange={(checked) => setFiltros({ ...filtros, comDocumentos: checked })}
                    />
                    <Label htmlFor="comDocumentos" className="text-sm cursor-pointer flex items-center gap-2">
                      <Download className="w-4 h-4 text-gray-500" />
                      Com Documentos
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="comItens"
                      checked={filtros.comItens}
                      onCheckedChange={(checked) => setFiltros({ ...filtros, comItens: checked })}
                    />
                    <Label htmlFor="comItens" className="text-sm cursor-pointer flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      Com Itens
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="comValor"
                      checked={filtros.comValor}
                      onCheckedChange={(checked) => setFiltros({ ...filtros, comValor: checked })}
                    />
                    <Label htmlFor="comValor" className="text-sm cursor-pointer flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      Com Valor Estimado
                    </Label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* AVANÇADOS (desabilitados por enquanto) */}
            <AccordionItem value="avancados" disabled>
              <AccordionTrigger className="text-sm font-semibold text-gray-400">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                  Filtros Avançados
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <p className="text-xs text-gray-500 italic">
                  Filtros baseados em dados JSONB - Em desenvolvimento
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

              </div>
        </aside>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {dataFiltro ? `Licitações de ${format(new Date(dataFiltro), "dd/MM/yyyy", { locale: ptBR })}` : 'Todas as Licitações'}
              </h1>
              <p className="text-gray-600">
                {dataFiltro 
                  ? 'Licitações publicadas nesta data' 
                  : 'Visualize todas as licitações públicas do Brasil'
                }
              </p>
            </div>
          </div>

          {/* Badges de Filtros Ativos */}
          {contarFiltrosAtivos() > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {filtros.buscaObjeto && (
                  <Badge variant="secondary" className="gap-1">
                    Objeto: {filtros.buscaObjeto}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, buscaObjeto: '' })} />
                  </Badge>
                )}
                {filtros.uf && (
                  <Badge variant="secondary" className="gap-1">
                    UF: {filtros.uf}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, uf: '' })} />
                  </Badge>
                )}
                {filtros.modalidade && (
                  <Badge variant="secondary" className="gap-1">
                    Modalidade: {filtros.modalidade}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, modalidade: '' })} />
                  </Badge>
                )}
                {(filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim) && (
                  <Badge variant="secondary" className="gap-1">
                    Data: {filtros.dataPublicacaoInicio || '...'} - {filtros.dataPublicacaoFim || '...'}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, dataPublicacaoInicio: '', dataPublicacaoFim: '' })} />
                  </Badge>
                )}
                {(filtros.valorMin || filtros.valorMax) && (
                  <Badge variant="secondary" className="gap-1">
                    Valor: R$ {filtros.valorMin || '0'} - {filtros.valorMax || '∞'}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, valorMin: '', valorMax: '' })} />
                  </Badge>
                )}
                {filtros.orgao && (
                  <Badge variant="secondary" className="gap-1">
                    Órgão: {filtros.orgao}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, orgao: '' })} />
                  </Badge>
                )}
                {dataFiltro && (
                  <Badge variant="secondary" className="gap-1 bg-orange-100">
                    Data: {format(new Date(dataFiltro), "dd/MM/yyyy", { locale: ptBR })}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => {
                      setDataFiltro('')
                      window.history.pushState({}, '', '/licitacoes')
                    }} />
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <p className="mt-4 text-gray-600">Carregando licitações...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-900">Erro ao carregar licitações</h3>
                    <p className="text-sm text-red-700 mt-1">{error.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resultados */}
          {!isLoading && !error && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {licitacoes.length} {licitacoes.length === 1 ? 'licitação encontrada' : 'licitações encontradas'}
              </p>
            </div>
          )}

          {/* Cards de Licitações */}
              <div className="space-y-4">
                {licitacoes.map((licitacao) => (
            <Card 
              key={licitacao.id} 
              className="hover:shadow-lg transition-shadow border-l-4 border-l-orange-500"
            >
              <CardContent className="p-6">
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center">
                      <FileText className="w-4 h-4 text-gray-600" />
                              </div>
                    <button
                      onClick={(e) => handleFavoritar(e, licitacao)}
                      className="hover:scale-110 transition-transform"
                      title={favoritos.has(licitacao.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <Star 
                        className={`w-5 h-5 transition-colors ${
                          favoritos.has(licitacao.id) 
                            ? 'text-green-500 fill-green-500' 
                            : 'text-gray-400 hover:text-yellow-500 hover:fill-yellow-500'
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        abrirDetalhes(licitacao)
                      }}
                      className="hover:scale-110 transition-transform"
                      title="Ver detalhes"
                    >
                      <Eye className="w-5 h-5 text-blue-500 hover:text-blue-600" />
                    </button>
                              </div>
                  {isUrgente(licitacao) && (
                    <Badge variant="destructive" className="bg-red-500 animate-pulse">
                      URGENTE
                    </Badge>
                  )}
                              </div>

                {/* Objeto */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Objeto:</h3>
                  <p className="text-gray-900 leading-relaxed">
                    {licitacao.objeto_compra || 'Objeto não informado'}
                  </p>
                                </div>

                <hr className="my-4" />

                {/* Detalhes em 3 colunas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Campo 1: Data de Publicação */}
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Publicação:</p>
                      <p className="text-sm text-gray-600">
                        {formatarData(licitacao.data_publicacao_pncp)}
                      </p>
                    </div>
                  </div>

                  {/* Campo 2: UF/Cidade */}
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">UF:</p>
                      <p className="text-sm text-gray-600">{licitacao.uf_sigla || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Campo 3: Modalidade */}
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-orange-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Modalidade:</p>
                      <Badge variant="outline" className="mt-1">{licitacao.modalidade_nome || 'N/A'}</Badge>
                    </div>
                  </div>

                  {/* Campo 4: Órgão */}
                  <div className="flex items-start gap-2 md:col-span-2">
                    <Building2 className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Órgão:</p>
                      <p className="text-sm text-gray-600">
                        {licitacao.orgao_razao_social || 'Não informado'}
                      </p>
                    </div>
                  </div>

                  {/* Campo 5: Edital */}
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Edital:</p>
                      <p className="text-sm text-gray-600 font-mono text-xs">
                        {licitacao.numero_controle_pncp}
                      </p>
                    </div>
                  </div>
                </div>

                <hr className="my-4" />

                {/* Valor */}
                {licitacao.valor_total_estimado && (
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Valor Estimado:</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatarValor(licitacao.valor_total_estimado)}
                      </p>
                            </div>
                        </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Nº Licitação: {licitacao.numero_controle_pncp}</span>
                      </div>
                  <div className="text-sm text-gray-500">
                    Atualizada em: {formatarData(licitacao.data_atualizacao)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
          {/* Empty State */}
          {!isLoading && !error && licitacoes.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhuma licitação encontrada
                </h3>
                <p className="text-gray-600">
                  Tente ajustar os filtros para ver mais resultados
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sideover com Detalhes */}
      <Sheet open={sideoverAberto} onOpenChange={setSideoverAberto}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
          {licitacaoSelecionada && (
            <>
              <SheetHeader>
                <SheetTitle className="text-2xl">Detalhes da Licitação</SheetTitle>
                <SheetDescription className="text-base">
                  {licitacaoSelecionada.numero_controle_pncp}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Objeto */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Objeto</h4>
                  <p className="text-gray-700 leading-relaxed">
                    {licitacaoSelecionada.objeto_compra}
                  </p>
                </div>

                {/* Informações Básicas em Grid */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Informações Gerais</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Órgão:</span>
                      <p className="text-gray-900">{licitacaoSelecionada.orgao_razao_social || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Modalidade:</span>
                      <p className="text-gray-900">{licitacaoSelecionada.modalidade_nome || 'Não informada'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">UF:</span>
                      <p className="text-gray-900">{licitacaoSelecionada.uf_sigla || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Data Publicação:</span>
                      <p className="text-gray-900">{formatarData(licitacaoSelecionada.data_publicacao_pncp)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-gray-500">Valor Estimado:</span>
                      <p className="text-green-600 font-bold text-lg">
                        {formatarValor(licitacaoSelecionada.valor_total_estimado)}
                    </p>
                  </div>
                </div>
                </div>

                {/* Anexos/Documentos */}
                {licitacaoSelecionada.anexos && licitacaoSelecionada.anexos.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Download className="w-5 h-5 text-blue-500" />
                      Documentos ({licitacaoSelecionada.anexos.length})
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {licitacaoSelecionada.anexos.map((anexo, index) => (
                        <button
                          key={index}
                          onClick={() => anexo.url && window.open(anexo.url, '_blank')}
                          className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors text-left"
                        >
                          <Download className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {anexo.nome || anexo.nomeArquivo || `Documento ${index + 1}`}
                            </p>
                            {anexo.tipo && (
                              <p className="text-xs text-gray-500">{anexo.tipo}</p>
                            )}
                          </div>
                          <ExternalLink className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Itens */}
                {licitacaoSelecionada.itens && licitacaoSelecionada.itens.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-green-500" />
                      Itens da Licitação ({licitacaoSelecionada.itens.length})
                    </h4>
                    <div className="space-y-3">
                      {licitacaoSelecionada.itens.map((item, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-semibold text-green-700">
                                {item.numero || index + 1}
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 mb-2">
                                {item.descricao || item.descricaoDetalhada || item.descricao_item || 'Sem descrição'}
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {item.quantidade && (
                                  <div>
                                    <span className="text-gray-500">Quantidade:</span>
                                    <span className="ml-1 font-medium text-gray-900">{item.quantidade}</span>
                                  </div>
                                )}
                                {item.unidade && (
                                  <div>
                                    <span className="text-gray-500">Unidade:</span>
                                    <span className="ml-1 font-medium text-gray-900">{item.unidade}</span>
                                  </div>
                                )}
                                {item.valorUnitario && (
                                  <div>
                                    <span className="text-gray-500">Valor Unit.:</span>
                                    <span className="ml-1 font-medium text-green-600">
                                      {formatarValor(item.valorUnitario)}
                                    </span>
                                  </div>
                                )}
                                {item.valorTotal && (
                                  <div>
                                    <span className="text-gray-500">Valor Total:</span>
                                    <span className="ml-1 font-medium text-green-600">
                                      {formatarValor(item.valorTotal)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  )
}

export function BoletimDiaPage() {
  return (
    <ProtectedRoute>
      <LicitacoesContent />
    </ProtectedRoute>
  )
}
