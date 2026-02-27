import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  MapPin, 
  Building2, 
  DollarSign, 
  FileText, 
  Download,
  ExternalLink,
  X,
  Eye,
  Star,
  AlertCircle,
  Trash2,
  Loader2,
  Brain,
  StickyNote,
  Plus,
  Save,
  Quote
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChatDocumento } from '@/components/ChatDocumento'
import { VisualizadorDocumento } from '@/components/VisualizadorDocumento'
import { useNotifications } from '@/hooks/useNotifications'
import { useNotasEdital } from '@/hooks/useNotasEdital'

// ── Componente inline de notas por licitação ──────────────────────────────
function NotasCardInline({ licitacaoId, formatarData }) {
  const { notas, isLoading, adicionarNota, adicionando, deletarNota, habilitado } =
    useNotasEdital(licitacaoId)
  const [textNota, setTextNota] = useState('')

  if (!habilitado) return null

  const handleSalvar = async (e) => {
    e?.preventDefault()
    if (!textNota.trim()) return
    try {
      await adicionarNota({ nota: textNota })
      setTextNota('')
    } catch (_) {}
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSalvar()
  }

  return (
    <div className="mt-4 border-t pt-4">
      {/* Cabeçalho */}
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
        <StickyNote className="w-4 h-4 text-yellow-500" />
        Anotações
        {notas.length > 0 && (
          <span className="bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
            {notas.length}
          </span>
        )}
      </h4>

      {/* Input de anotação */}
      <form onSubmit={handleSalvar} className="mb-3 space-y-2">
        <Textarea
          value={textNota}
          onChange={e => setTextNota(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar anotação... (Ctrl+Enter para salvar)"
          rows={2}
          className="w-full text-sm resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={adicionando || !textNota.trim()}
            className="gap-1.5"
          >
            {adicionando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
        </div>
      </form>

      {/* Lista de notas */}
      {isLoading && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
        </p>
      )}
      {!isLoading && notas.length === 0 && (
        <p className="text-xs text-gray-400 italic">Nenhuma anotação ainda.</p>
      )}
      <div className="space-y-2">
        {notas.map(n => (
          <div
            key={n.id}
            className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 group"
          >
            <p className="flex-1 text-sm text-gray-700 leading-relaxed">{n.nota}</p>
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <span className="text-xs text-gray-400 whitespace-nowrap">{formatarData(n.criado_em)}</span>
              <button
                onClick={() => deletarNota(n.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                title="Excluir"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FavoritosContent() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()
  const { confirm, success, error: showError, warning } = useNotifications()
  const [cardsExpandidos, setCardsExpandidos] = useState(new Set())
  const [chatAberto, setChatAberto] = useState(false)
  const [documentoSelecionado, setDocumentoSelecionado] = useState(null)
  const [visualizadorAberto, setVisualizadorAberto] = useState(false)
  const [documentoVisualizacao, setDocumentoVisualizacao] = useState(null)

  // Buscar contagem de notas por licitação (para badge nos cards)
  const { data: notasContagemMap = {} } = useQuery({
    queryKey: ['notas-edital-contagem', user?.id],
    queryFn: async () => {
      if (!user?.id) return {}
      const { data, error } = await supabase
        .from('notas_edital')
        .select('licitacao_id')
        .eq('usuario_id', user.id)
      if (error) return {}
      return (data || []).reduce((acc, n) => {
        acc[n.licitacao_id] = (acc[n.licitacao_id] || 0) + 1
        return acc
      }, {})
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  })

  // Buscar favoritos do usuário
  const { data: favoritos = [], isLoading, error } = useQuery({
    queryKey: ['favoritos', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('licitacoes_favoritas')
        .select(`
          id,
          data_adicao,
          notas,
          licitacao_id,
          licitacoes (*)
        `)
        .eq('usuario_id', user.id)
        .order('data_adicao', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!user?.id
  })

  // Remover dos favoritos
  const removerFavorito = useMutation({
    mutationFn: async (favoritoId) => {
      const { error } = await supabase
        .from('licitacoes_favoritas')
        .delete()
        .eq('id', favoritoId)
        .eq('usuario_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['favoritos'])
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

  const toggleCardExpandido = async (e, licitacaoId, licitacao) => {
    e.stopPropagation()
    
    const estaExpandido = cardsExpandidos.has(licitacaoId)
    
    setCardsExpandidos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(licitacaoId)) {
        newSet.delete(licitacaoId)
      } else {
        newSet.add(licitacaoId)
      }
      return newSet
    })
    
  }

  const handleRemoverFavorito = async (e, favoritoId) => {
    e.stopPropagation()
    const confirmed = await confirm('Deseja remover esta licitação dos favoritos?', {
      title: 'Remover favorito',
      variant: 'destructive',
    })
    if (confirmed) {
      removerFavorito.mutate(favoritoId)
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Licitações Favoritas
          </h1>
          <p className="text-gray-600">
            Suas licitações salvas para acompanhamento
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <p className="mt-4 text-gray-600">Carregando favoritos...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900">Erro ao carregar favoritos</h3>
                  <p className="text-sm text-red-700 mt-1">{error.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resultados */}
        {!isLoading && !error && (
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              {favoritos.length} {favoritos.length === 1 ? 'licitação favorita' : 'licitações favoritas'}
            </p>
          </div>
        )}

        {/* Cards de Licitações Favoritas */}
        <div className="space-y-4">
          {favoritos.map((favorito) => {
            const licitacao = favorito.licitacoes
            if (!licitacao) return null

            return (
              <Card 
                key={favorito.id} 
                className="hover:shadow-lg transition-shadow border-l-4 border-l-green-500"
              >
                <CardContent className="p-6">
                  {/* Header do Card */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center">
                        <FileText className="w-4 h-4 text-gray-600" />
                      </div>
                      <Star className="w-5 h-5 text-green-500 fill-green-500" />
                      <button
                        onClick={(e) => toggleCardExpandido(e, licitacao.id, licitacao)}
                        className="hover:scale-110 transition-transform relative"
                        title={cardsExpandidos.has(licitacao.id) ? "Ocultar detalhes" : "Ver detalhes"}
                      >
                        <Eye className={`w-5 h-5 transition-colors ${
                          cardsExpandidos.has(licitacao.id)
                            ? 'text-blue-600 fill-blue-100'
                            : 'text-blue-500 hover:text-blue-600'
                        }`} />
                        {/* Indicador de conteúdo disponível */}
                        {((licitacao.anexos && licitacao.anexos.length > 0) || 
                          (licitacao.itens && licitacao.itens.length > 0)) && 
                          !cardsExpandidos.has(licitacao.id) && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white"></span>
                        )}
                      </button>
                      <button
                        onClick={(e) => handleRemoverFavorito(e, favorito.id)}
                        className="hover:scale-110 transition-transform"
                        title="Remover dos favoritos"
                      >
                        <Trash2 className="w-5 h-5 text-red-500 hover:text-red-600" />
                      </button>
                      
                      {/* Badges de indicadores (quando não expandido) */}
                      {!cardsExpandidos.has(licitacao.id) && (
                        <>
                          {licitacao.anexos && licitacao.anexos.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Download className="w-3 h-3 mr-1" />
                              {licitacao.anexos.length} doc{licitacao.anexos.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {licitacao.itens && licitacao.itens.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <FileText className="w-3 h-3 mr-1" />
                              {licitacao.itens.length} {licitacao.itens.length > 1 ? 'itens' : 'item'}
                            </Badge>
                          )}
                          {notasContagemMap[licitacao.id] > 0 && (
                            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs border">
                              <StickyNote className="w-3 h-3 mr-1" />
                              {notasContagemMap[licitacao.id]} {notasContagemMap[licitacao.id] === 1 ? 'nota' : 'notas'}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* Badges de Status e Datas */}
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      {/* Badge Favorito */}
                      <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                        Favorito
                      </Badge>
                      
                      {/* Badges de Data de Abertura e Encerramento */}
                      {licitacao.dados_completos?.dataAberturaProposta && (
                        <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                          Abertura: {formatarData(licitacao.dados_completos.dataAberturaProposta)}
                        </Badge>
                      )}
                      {licitacao.dados_completos?.dataEncerramentoProposta && (
                        <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                          Encerramento: {formatarData(licitacao.dados_completos.dataEncerramentoProposta)}
                        </Badge>
                      )}
                      
                      {/* Badge de Status (Em Andamento / Encerrando / Encerrado) */}
                      {(() => {
                        const dataAbertura = licitacao.dados_completos?.dataAberturaProposta
                        const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta
                        
                        if (dataEncerramento) {
                          const hoje = new Date()
                          const encerramento = new Date(dataEncerramento)
                          const diasRestantes = Math.ceil((encerramento - hoje) / (1000 * 60 * 60 * 24))
                          
                          // Encerrado
                          if (diasRestantes < 0) {
                            return (
                              <Badge className="bg-red-500 text-white text-xs">
                                Encerrado
                              </Badge>
                            )
                          }
                          
                          // Encerrando em breve (menos de 3 dias)
                          if (diasRestantes <= 3 && diasRestantes > 0) {
                            return (
                              <Badge className="bg-yellow-500 text-white text-xs animate-pulse">
                                Encerrando em {diasRestantes}d
                              </Badge>
                            )
                          }
                          
                          // Em andamento
                          if (dataAbertura) {
                            const abertura = new Date(dataAbertura)
                            if (hoje >= abertura && hoje <= encerramento) {
                              return (
                                <Badge className="bg-blue-500 text-white text-xs">
                                  Em Andamento
                                </Badge>
                              )
                            }
                          }
                        }
                        return null
                      })()}
                    </div>
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
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Publicação:</p>
                        <p className="text-sm text-gray-600">
                          {formatarData(licitacao.data_publicacao_pncp)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">UF:</p>
                        <p className="text-sm text-gray-600">{licitacao.uf_sigla || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-orange-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Modalidade:</p>
                        <Badge variant="outline" className="mt-1">{licitacao.modalidade_nome || 'N/A'}</Badge>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 md:col-span-2">
                      <Building2 className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Órgão:</p>
                        <p className="text-sm text-gray-600">
                          {licitacao.orgao_razao_social || 'Não informado'}
                        </p>
                      </div>
                    </div>

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

                  {/* Notas e Anotações */}
                  <NotasCardInline licitacaoId={licitacao.id} formatarData={formatarData} />

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>Favoritado em: {formatarData(favorito.data_adicao)}</span>
                    </div>
                  </div>

                  {/* Seção Expansível com Detalhes */}
                  {cardsExpandidos.has(licitacao.id) && (
                    <div className="mt-6 pt-6 border-t space-y-6 animate-in slide-in-from-top-2">

                      {/* Anexos/Documentos */}
                      {licitacao.anexos && licitacao.anexos.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Download className="w-5 h-5 text-blue-500" />
                            Documentos ({licitacao.anexos.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {licitacao.anexos.map((anexo, index) => (
                              <div 
                                key={index} 
                                className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all group"
                              >
                                {/* Nome do Documento */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || anexo.tipoDocumentoNome || `Documento ${index + 1}`}
                                  </p>
                                  {anexo.tipo && (
                                    <p className="text-xs text-gray-500 truncate">{anexo.tipo}</p>
                                  )}
                                </div>
                                
                                {/* Badges Circulares de Ação */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {/* Badge Download */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (anexo.url) {
                                        const link = document.createElement('a')
                                        link.href = anexo.url
                                        link.download = anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || `documento-${index + 1}.pdf`
                                        link.target = '_blank'
                                        link.click()
                                      }
                                    }}
                                    className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                                    title="Baixar documento"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  {/* Badge Visualizar Documento */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (anexo.url) {
                                        setDocumentoVisualizacao({
                                          url: anexo.url,
                                          nome: anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || `Documento ${index + 1}`,
                                          licitacaoId: licitacao.id
                                        })
                                        setVisualizadorAberto(true)
                                      }
                                    }}
                                    className="w-6 h-6 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors"
                                    title="Visualizar documento"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  {/* Badge Chat IA */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDocumentoSelecionado({
                                        url: anexo.url,
                                        nome: anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || `Documento ${index + 1}`,
                                        licitacaoId: licitacao.id
                                      })
                                      setChatAberto(true)
                                    }}
                                    className="w-6 h-6 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 flex items-center justify-center transition-colors"
                                    title="Conversar com IA sobre este documento"
                                  >
                                    <Brain className="w-3.5 h-3.5" />
                                  </button>
                      </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Itens */}
                      {licitacao.itens && licitacao.itens.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-green-500" />
                            Itens da Licitação ({licitacao.itens.length})
                          </h4>
                          <div className="space-y-4">
                            {licitacao.itens.map((item, index) => (
                              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                                {/* Header do Item */}
                                <div className="mb-3">
                                  {/* Badges no topo */}
                                  <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <Badge className="bg-green-600 text-white font-bold">
                                      Item #{item.numeroItem || item.numero || index + 1}
                                    </Badge>
                                    {item.materialOuServicoNome && (
                                      <Badge variant={item.materialOuServicoNome === 'Serviço' ? 'default' : 'secondary'}>
                                        {item.materialOuServicoNome}
                                      </Badge>
                                    )}
                                    {item.situacaoCompraItemNome && (
                                      <Badge variant="outline">
                                        {item.situacaoCompraItemNome}
                                      </Badge>
                                    )}
                                  </div>
                                  {/* Descrição */}
                                  <p className="text-sm font-medium text-gray-900 leading-relaxed">
                                    {item.descricao || item.descricaoDetalhada || item.descricao_item || 'Sem descrição'}
                                  </p>
                                </div>

                                {/* Informações Detalhadas */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-gray-50 p-3 rounded">
                                  {item.quantidade && (
                                    <div>
                                      <span className="text-gray-500 block">Quantidade:</span>
                                      <span className="font-semibold text-gray-900">
                                        {item.quantidade} {item.unidadeMedida || item.unidade || ''}
                                      </span>
                                    </div>
                                  )}
                                  {(item.valorUnitarioEstimado || item.valorUnitario) && (
                                    <div>
                                      <span className="text-gray-500 block">Valor Unitário:</span>
                                      <span className="font-semibold text-green-600">
                                        {formatarValor(item.valorUnitarioEstimado || item.valorUnitario)}
                                      </span>
                                    </div>
                                  )}
                                  {item.valorTotal && (
                                    <div>
                                      <span className="text-gray-500 block">Valor Total:</span>
                                      <span className="font-semibold text-green-700 text-sm">
                                        {formatarValor(item.valorTotal)}
                                      </span>
                                    </div>
                                  )}
                                  {item.criterioJulgamentoNome && (
                                    <div>
                                      <span className="text-gray-500 block">Critério:</span>
                                      <span className="font-medium text-gray-900">{item.criterioJulgamentoNome}</span>
                                    </div>
                                  )}
                                  {item.itemCategoriaNome && (
                                    <div>
                                      <span className="text-gray-500 block">Categoria:</span>
                                      <span className="font-medium text-gray-900">{item.itemCategoriaNome}</span>
                                    </div>
                                  )}
                                  {item.tipoBeneficioNome && (
                                    <div>
                                      <span className="text-gray-500 block">Benefício:</span>
                                      <span className="font-medium text-gray-900">{item.tipoBeneficioNome}</span>
                                    </div>
                                  )}
                                  {item.ncmNbsDescricao && (
                                    <div className="col-span-2">
                                      <span className="text-gray-500 block">NCM/NBS:</span>
                                      <span className="font-medium text-gray-900">
                                        {item.ncmNbsCodigo ? `${item.ncmNbsCodigo} - ` : ''}{item.ncmNbsDescricao}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Informação Complementar */}
                                {item.informacaoComplementar && (
                                  <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                                    <span className="text-xs font-medium text-blue-700 block mb-1">Informação Complementar:</span>
                                    <p className="text-xs text-blue-900">{item.informacaoComplementar}</p>
                                  </div>
                                )}

                                {/* Indicadores de Benefícios/Margens */}
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {item.incentivoProdutivoBasico && (
                                    <Badge variant="secondary" className="text-xs">
                                      Incentivo Produtivo Básico
                                    </Badge>
                                  )}
                                  {item.aplicabilidadeMargemPreferenciaNormal && (
                                    <Badge variant="secondary" className="text-xs">
                                      Margem Preferência Normal {item.percentualMargemPreferenciaNormal ? `(${item.percentualMargemPreferenciaNormal}%)` : ''}
                                    </Badge>
                                  )}
                                  {item.aplicabilidadeMargemPreferenciaAdicional && (
                                    <Badge variant="secondary" className="text-xs">
                                      Margem Preferência Adicional {item.percentualMargemPreferenciaAdicional ? `(${item.percentualMargemPreferenciaAdicional}%)` : ''}
                                    </Badge>
                                  )}
                                  {item.exigenciaConteudoNacional && (
                                    <Badge variant="secondary" className="text-xs">
                                      Exigência Conteúdo Nacional
                                    </Badge>
                                  )}
                                  {item.orcamentoSigiloso && (
                                    <Badge variant="destructive" className="text-xs">
                                      Orçamento Sigiloso
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Empty State */}
        {!isLoading && !error && favoritos.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nenhuma licitação favorita
              </h3>
              <p className="text-gray-600 mb-4">
                Comece a favoritar licitações para acompanhá-las aqui
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chat com Documento IA */}
      <ChatDocumento
        aberto={chatAberto}
        onFechar={() => {
          setChatAberto(false)
          setDocumentoSelecionado(null)
        }}
        documento={documentoSelecionado}
        licitacaoId={documentoSelecionado?.licitacaoId}
      />

      {/* Visualizador de Documento */}
      <VisualizadorDocumento
        open={visualizadorAberto}
        onOpenChange={setVisualizadorAberto}
        urlDocumento={documentoVisualizacao?.url}
        nomeArquivo={documentoVisualizacao?.nome}
        licitacaoId={documentoVisualizacao?.licitacaoId}
      />

    </AppLayout>
  )
}

export function FavoritosPage() {
  return (
    <ProtectedRoute>
      <FavoritosContent />
    </ProtectedRoute>
  )
}


