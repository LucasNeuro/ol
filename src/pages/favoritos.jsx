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
  Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function FavoritosContent() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()
  const [cardsExpandidos, setCardsExpandidos] = useState(new Set())

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
      console.log('✅ Removido dos favoritos')
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

  const toggleCardExpandido = (e, licitacaoId) => {
    e.stopPropagation()
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

  const handleRemoverFavorito = (e, favoritoId) => {
    e.stopPropagation()
    if (confirm('Deseja remover esta licitação dos favoritos?')) {
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
                        onClick={(e) => toggleCardExpandido(e, licitacao.id)}
                        className="hover:scale-110 transition-transform"
                        title={cardsExpandidos.has(licitacao.id) ? "Ocultar detalhes" : "Ver detalhes"}
                      >
                        <Eye className={`w-5 h-5 transition-colors ${
                          cardsExpandidos.has(licitacao.id)
                            ? 'text-blue-600 fill-blue-100'
                            : 'text-blue-500 hover:text-blue-600'
                        }`} />
                      </button>
                      <button
                        onClick={(e) => handleRemoverFavorito(e, favorito.id)}
                        className="hover:scale-110 transition-transform"
                        title="Remover dos favoritos"
                      >
                        <Trash2 className="w-5 h-5 text-red-500 hover:text-red-600" />
                      </button>
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

                  {/* Notas */}
                  {favorito.notas && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold">Notas:</span> {favorito.notas}
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>Favoritado em: {formatarData(favorito.data_adicao)}</span>
                    </div>
                  </div>

                  {/* Seção Expansível com Detalhes */}
                  {cardsExpandidos.has(licitacao.id) && (
                    <div className="mt-6 pt-6 border-t space-y-6 animate-in slide-in-from-top-2">
                      {/* Informações Gerais */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Informações Gerais</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-500">Órgão:</span>
                            <p className="text-gray-900">{licitacao.orgao_razao_social || 'Não informado'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Modalidade:</span>
                            <p className="text-gray-900">{licitacao.modalidade_nome || 'Não informada'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">UF:</span>
                            <p className="text-gray-900">{licitacao.uf_sigla || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Data Publicação:</span>
                            <p className="text-gray-900">{formatarData(licitacao.data_publicacao_pncp)}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-sm font-medium text-gray-500">Valor Estimado:</span>
                            <p className="text-green-600 font-bold text-lg">
                              {formatarValor(licitacao.valor_total_estimado)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Anexos/Documentos */}
                      {licitacao.anexos && licitacao.anexos.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Download className="w-5 h-5 text-blue-500" />
                            Documentos ({licitacao.anexos.length})
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {licitacao.anexos.map((anexo, index) => (
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


