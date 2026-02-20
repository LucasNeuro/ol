import { useRoute, useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, Calendar, DollarSign, MapPin, Building2, AlertTriangle } from 'lucide-react'
import { buscarContratacoesPorData } from '@/lib/pncp'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { useUserStore } from '@/store/userStore'
import { usePalavrasIncompatibilidade } from '@/hooks/usePalavrasIncompatibilidade'
import { termosIncompatibilidadeEncontrados } from '@/lib/filtroSemantico'

function EditalContent() {
  const [, params] = useRoute('/edital/:numeroControle')
  const [, setLocation] = useLocation()
  const { user } = useAuth()
  const { warning, showError, success } = useNotifications()
  const numeroControle = params?.numeroControle || ''

  const { data: palavrasIncompatibilidadePorSetor = {} } = usePalavrasIncompatibilidade()
  const { data: perfilUsuario } = useQuery({
    queryKey: ['perfil-usuario', user?.id],
    queryFn: async () => {
      if (!user?.id || !supabase) return null
      const { data, error } = await supabase.from('profiles').select('setores_atividades').eq('id', user.id).maybeSingle()
      if (error) return null
      return data
    },
    enabled: !!user?.id,
  })

  // Buscar a licitação específica
  // Como não temos endpoint direto, vamos buscar pela data de publicação
  // e filtrar pelo numeroControlePNCP
  const { data, isLoading, error } = useQuery({
    queryKey: ['edital', numeroControle],
    queryFn: async () => {
      if (!numeroControle) return null

      // Extrair data do numeroControle (formato: CNPJ-1-SEQUENCIAL/ANO)
      // Vamos tentar buscar nas últimas datas
      const hoje = new Date()
      const datasParaBuscar = []
      
      // Buscar últimos 30 dias
      for (let i = 0; i < 30; i++) {
        const data = new Date(hoje)
        data.setDate(hoje.getDate() - i)
        const dataStr = `${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, '0')}${String(data.getDate()).padStart(2, '0')}`
        datasParaBuscar.push(dataStr)
      }

      // Buscar em cada data até encontrar
      for (const dataStr of datasParaBuscar) {
        try {
          const resultado = await buscarContratacoesPorData({
            dataInicial: dataStr,
            dataFinal: dataStr,
            pagina: 1,
            tamanhoPagina: 50,
          })

          if (resultado.data) {
            const licitacao = resultado.data.find(
              (l) => l.numeroControlePNCP === numeroControle
            )

            if (licitacao) {
              return licitacao
            }
          }
        } catch (err) {
          continue
        }
      }

      return null
    },
    enabled: !!numeroControle,
  })

  const handleToggleFavorito = async (licitacao) => {
    if (!user || !supabase) {
      warning('Você precisa estar logado para adicionar favoritos.')
      return
    }

    try {
      // Verificar se o usuário existe na tabela profiles
      const { data: usuarioExiste, error: erroUsuario } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (erroUsuario || !usuarioExiste) {
        showError('Sua sessão expirou. Por favor, faça login novamente.')
        // Limpar sessão inválida
        const { clearUser } = useUserStore.getState()
        clearUser()
        localStorage.removeItem('user')
        localStorage.removeItem('session')
        return
      }

      let licitacaoId = licitacao._id
      
      if (!licitacaoId) {
        const { data: licitacaoExistente } = await supabase
          .from('licitacoes')
          .select('id')
          .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
          .maybeSingle()
        
        if (!licitacaoExistente) {
          showError('Licitação não encontrada no banco.')
          return
        }
        licitacaoId = licitacaoExistente.id
      }

      const { data: existing } = await supabase
        .from('licitacoes_favoritas')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('licitacao_id', licitacaoId)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('licitacoes_favoritas')
          .delete()
          .eq('id', existing.id)
        success('Removido dos favoritos')
      } else {
        const { error: insertError } = await supabase
          .from('licitacoes_favoritas')
          .insert({
            usuario_id: user.id,
            licitacao_id: licitacaoId,
          })
        
        if (insertError) {
          // Tratamento específico para erro de foreign key
          if (insertError.code === '23503') {
            showError('Erro ao favoritar: sua sessão pode ter expirado. Por favor, faça login novamente.')
            // Limpar sessão inválida
            const { clearUser } = useUserStore.getState()
            clearUser()
            localStorage.removeItem('user')
            localStorage.removeItem('session')
            return
          }
          throw insertError
        }
        success('Adicionado aos favoritos')
      }
    } catch (error) {
      showError('Erro ao atualizar favorito. Tente novamente.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent"></div>
                <p className="text-gray-600">Carregando detalhes do edital...</p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-4xl">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6">
                <p className="text-red-600">
                  {error ? `Erro ao carregar edital: ${error.message}` : 'Edital não encontrado.'}
                </p>
                <Button
                  onClick={() => setLocation('/licitacoes')}
                  className="mt-4"
                  variant="outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar às Licitações
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const licitacao = data
  const setoresAtividades = perfilUsuario?.setores_atividades || []
  const resumoIncompatibilidade = useMemo(() => {
    const objetoTexto = [licitacao.objetoCompra, licitacao.informacaoComplementar].filter(Boolean).join('\n')
    return termosIncompatibilidadeEncontrados(objetoTexto, setoresAtividades, palavrasIncompatibilidadePorSetor)
  }, [licitacao.objetoCompra, licitacao.informacaoComplementar, setoresAtividades, palavrasIncompatibilidadePorSetor])
  const temIncompatibilidade = resumoIncompatibilidade.encontrados.length > 0

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-4xl">
          <Button
            onClick={() => setLocation('/licitacoes')}
            variant="outline"
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar às Licitações
          </Button>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2 text-orange-600">
                    {licitacao.objetoCompra || 'Objeto não informado'}
                  </CardTitle>
                  <CardContent className="p-0 mt-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="w-4 h-4" />
                      <span>Nº Controle PNCP: {licitacao.numeroControlePNCP}</span>
                    </div>
                  </CardContent>
                </div>
                <button
                  onClick={() => handleToggleFavorito(licitacao)}
                  className="p-2 hover:bg-orange-50 rounded-lg transition-colors"
                  title="Adicionar aos favoritos"
                >
                  <Star className="w-6 h-6 text-gray-400 hover:text-orange-500" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Resumo de incompatibilidade (termos do edital x setores do perfil) */}
              {temIncompatibilidade && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900">Atenção: termos de incompatibilidade encontrados</p>
                      <p className="text-sm text-amber-800 mt-1">
                        O texto deste edital contém termos que costumam indicar escopo fora do seu perfil de setores. Revise antes de participar.
                      </p>
                      <ul className="mt-2 list-disc list-inside text-sm text-amber-800 space-y-0.5">
                        {resumoIncompatibilidade.encontrados.map((termo, i) => (
                          <li key={i}>{termo}</li>
                        ))}
                      </ul>
                      {resumoIncompatibilidade.porSetor.length > 0 && (
                        <p className="text-xs text-amber-700 mt-2">
                          Por setor: {resumoIncompatibilidade.porSetor.map(({ setor, termos }) => `${setor} (${termos.join(', ')})`).join(' • ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Informações Básicas */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Modalidade</p>
                    <p className="font-semibold">{licitacao.modalidadeNome || 'Não informado'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Data de Publicação</p>
                    <p className="font-semibold">
                      {licitacao.dataPublicacaoPncp 
                        ? formatarData(licitacao.dataPublicacaoPncp) 
                        : 'Não informado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Valor Estimado</p>
                    <p className="font-semibold">
                      {licitacao.valorTotalEstimado 
                        ? formatarMoeda(licitacao.valorTotalEstimado) 
                        : 'Não informado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Órgão</p>
                    <p className="font-semibold">
                      {licitacao.orgaoEntidade?.razaosocial || 'Não informado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Localização */}
              {licitacao.unidadeOrgao && (
                <div className="flex items-start gap-3 pt-4 border-t">
                  <MapPin className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Localização</p>
                    <p className="font-semibold">
                      {[
                        licitacao.unidadeOrgao.municipioNome,
                        licitacao.unidadeOrgao.ufSigla
                      ].filter(Boolean).join(' - ') || 'Não informado'}
                    </p>
                    {licitacao.unidadeOrgao.nomeUnidade && (
                      <p className="text-sm text-gray-600 mt-1">
                        {licitacao.unidadeOrgao.nomeUnidade}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Informações Complementares */}
              {licitacao.informacaoComplementar && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2">Informações Complementares</p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {licitacao.informacaoComplementar}
                  </p>
                </div>
              )}

              {/* Datas Importantes */}
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                {licitacao.dataAberturaProposta && (
                  <div>
                    <p className="text-sm text-gray-500">Abertura de Propostas</p>
                    <p className="font-semibold">
                      {formatarData(licitacao.dataAberturaProposta)}
                    </p>
                  </div>
                )}
                {licitacao.dataEncerramentoProposta && (
                  <div>
                    <p className="text-sm text-gray-500">Encerramento de Propostas</p>
                    <p className="font-semibold">
                      {formatarData(licitacao.dataEncerramentoProposta)}
                    </p>
                  </div>
                )}
              </div>

              {/* Processo e Número */}
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                {licitacao.processo && (
                  <div>
                    <p className="text-sm text-gray-500">Processo</p>
                    <p className="font-semibold">{licitacao.processo}</p>
                  </div>
                )}
                {licitacao.numeroCompra && (
                  <div>
                    <p className="text-sm text-gray-500">Número da Compra</p>
                    <p className="font-semibold">{licitacao.numeroCompra}</p>
                  </div>
                )}
              </div>

              {/* Situação */}
              {licitacao.situacaoCompraNome && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500">Situação</p>
                  <p className="font-semibold">{licitacao.situacaoCompraNome}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export function EditalPage() {
  return (
    <ProtectedRoute>
      <EditalContent />
    </ProtectedRoute>
  )
}

