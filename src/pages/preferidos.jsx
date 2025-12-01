import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { Star, Trash2 } from 'lucide-react'
import { EditalSidepanel } from '@/components/EditalSidepanel'

function PreferidosContent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editalAberto, setEditalAberto] = useState(false)
  const [numeroControleSelecionado, setNumeroControleSelecionado] = useState(null)

  const { data: favoritas, isLoading } = useQuery({
    queryKey: ['favoritas', user?.id],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase não configurado')
      
      const { data, error } = await supabase
        .from('licitacoes_favoritas')
        .select(`
          *,
          licitacoes (
            id,
            numero_controle_pncp,
            objeto_compra,
            modalidade_nome,
            orgao_razao_social,
            valor_total_estimado,
            data_encerramento_proposta,
            link_sistema_origem
          )
        `)
        .eq('usuario_id', user.id)
        .order('data_adicao', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!user && !!supabase,
  })

  const { mutate: removerFavorito } = useMutation({
    mutationFn: async (favoritaId) => {
      if (!supabase) throw new Error('Supabase não configurado')
      
      const { error } = await supabase
        .from('licitacoes_favoritas')
        .delete()
        .eq('id', favoritaId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['favoritas', user?.id])
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-12 px-6">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando favoritos...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 py-12 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
              Licitações Preferidas
            </h1>
            <p className="text-gray-600">
              Suas licitações favoritas salvas
            </p>
          </div>

          {favoritas && favoritas.length > 0 ? (
            <div className="space-y-4">
              {favoritas.map((favorita) => {
                const licitacao = favorita.licitacoes
                if (!licitacao) return null

                return (
                  <Card key={favorita.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
                            <CardTitle>
                              {licitacao.objeto_compra || 'Sem objeto informado'}
                            </CardTitle>
                          </div>
                          <CardDescription>
                            <div className="space-y-1 mt-2">
                              <p><strong>Modalidade:</strong> {licitacao.modalidade_nome}</p>
                              <p><strong>Órgão:</strong> {licitacao.orgao_razao_social}</p>
                              <p><strong>Valor Estimado:</strong> {formatarMoeda(licitacao.valor_total_estimado)}</p>
                              {licitacao.data_encerramento_proposta && (
                                <p><strong>Encerramento:</strong> {formatarData(licitacao.data_encerramento_proposta)}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-2">
                                Adicionado em {formatarData(favorita.data_adicao)}
                              </p>
                            </div>
                          </CardDescription>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removerFavorito(favorita.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => {
                          setNumeroControleSelecionado(licitacao.numero_controle_pncp)
                          setEditalAberto(true)
                        }}
                        variant="outline"
                        className="mt-4"
                      >
                        Ver Detalhes do Edital →
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">Nenhuma licitação favorita ainda</p>
                <p className="text-sm text-gray-500">
                  Adicione licitações aos favoritos clicando no ícone de estrela nas páginas de busca.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />

      <EditalSidepanel
        numeroControle={numeroControleSelecionado}
        open={editalAberto}
        onOpenChange={setEditalAberto}
      />
    </div>
  )
}

export function PreferidosPage() {
  return (
    <ProtectedRoute>
      <PreferidosContent />
    </ProtectedRoute>
  )
}

