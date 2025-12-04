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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

function FavoritosContent() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()
  const [licitacaoSelecionada, setLicitacaoSelecionada] = useState(null)
  const [sideoverAberto, setSideoverAberto] = useState(false)

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

  const abrirDetalhes = (licitacao) => {
    setLicitacaoSelecionada(licitacao)
    setSideoverAberto(true)
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
                        onClick={(e) => {
                          e.stopPropagation()
                          abrirDetalhes(licitacao)
                        }}
                        className="hover:scale-110 transition-transform"
                        title="Ver detalhes"
                      >
                        <Eye className="w-5 h-5 text-blue-500 hover:text-blue-600" />
                      </button>
                      <button
                        onClick={(e) => handleRemoverFavorito(e, favorito.id)}
                        className="hover:scale-110 transition-transform"
                        title="Remover dos favoritos"
                      >
                        <Trash2 className="w-5 h-5 text-red-500 hover:text-red-600" />
                      </button>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                      Favorito
                    </Badge>
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

      {/* Sideover com Detalhes - REUTILIZADO */}
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

                {/* Informações Gerais */}
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

                {/* Documentos */}
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

export function FavoritosPage() {
  return (
    <ProtectedRoute>
      <FavoritosContent />
    </ProtectedRoute>
  )
}


