import { useRoute } from 'wouter'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { buscarContratacoesPorData } from '@/lib/pncp'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { EditalSidepanel } from '@/components/EditalSidepanel'
import { buscarLicitacoesDoBanco } from '@/lib/sync'

// Função para salvar licitações básicas no banco (sem itens/documentos ainda)
async function salvarLicitacoesBasicas(licitacoes) {
  if (!supabase || !licitacoes || licitacoes.length === 0) return

  try {
    console.log(`💾 [Boletim Dia] Salvando ${licitacoes.length} licitações no banco...`)
    
    for (const licitacao of licitacoes) {
      try {
        // Verificar se já existe
        const { data: existente } = await supabase
          .from('licitacoes')
          .select('id')
          .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
          .maybeSingle()

        const dadosLicitacao = {
          numero_controle_pncp: licitacao.numeroControlePNCP,
          numero_compra: licitacao.numeroCompra,
          ano_compra: licitacao.anoCompra,
          processo: licitacao.processo,
          objeto_compra: licitacao.objetoCompra,
          informacao_complementar: licitacao.informacaoComplementar,
          modalidade_id: licitacao.codigoModalidadeContratacao,
          modalidade_nome: licitacao.modalidadeNome,
          valor_total_estimado: licitacao.valorTotalEstimado,
          data_abertura_proposta: licitacao.dataAberturaProposta || licitacao.dataAberturaPropostaData,
          data_encerramento_proposta: licitacao.dataEncerramentoProposta || licitacao.dataEncerramentoPropostaData,
          data_publicacao_pncp: licitacao.dataPublicacaoPNCP || licitacao.dataPublicacao,
          orgao_cnpj: licitacao.orgaoEntidade?.cnpj,
          orgao_razao_social: licitacao.orgaoEntidade?.razaosocial,
          municipio_codigo_ibge: licitacao.municipio?.codigoIBGE || licitacao.unidadeOrgao?.codigoIbge,
          municipio_nome: licitacao.municipio?.nomeIBGE || licitacao.unidadeOrgao?.municipioNome,
          uf_sigla: licitacao.municipio?.uf || licitacao.unidadeOrgao?.ufSigla,
          sincronizado_em: new Date().toISOString(),
        }

        if (existente) {
          // Atualizar existente
          await supabase
            .from('licitacoes')
            .update({
              ...dadosLicitacao,
              data_atualizacao: new Date().toISOString(),
            })
            .eq('id', existente.id)
        } else {
          // Inserir nova
          await supabase
            .from('licitacoes')
            .insert(dadosLicitacao)
        }
      } catch (err) {
        console.warn(`⚠️ [Boletim Dia] Erro ao salvar licitação ${licitacao.numeroControlePNCP}:`, err.message)
        // Continuar com as próximas mesmo se uma falhar
      }
    }
    
    console.log(`✅ [Boletim Dia] Licitações salvas no banco`)
  } catch (error) {
    console.error('❌ [Boletim Dia] Erro ao salvar licitações:', error)
  }
}

const MODALIDADES = [
  { id: 1, nome: 'Leilão - Eletrônico' },
  { id: 2, nome: 'Diálogo Competitivo' },
  { id: 3, nome: 'Concurso' },
  { id: 4, nome: 'Concorrência - Eletrônica' },
  { id: 5, nome: 'Concorrência - Presencial' },
  { id: 6, nome: 'Pregão - Eletrônico' },
  { id: 7, nome: 'Pregão - Presencial' },
  { id: 8, nome: 'Dispensa de Licitação' },
  { id: 9, nome: 'Inexigibilidade' },
  { id: 10, nome: 'Manifestação de Interesse' },
  { id: 11, nome: 'Pré-qualificação' },
  { id: 12, nome: 'Credenciamento' },
  { id: 13, nome: 'Leilão - Presencial' },
]

function BoletimDiaContent() {
  const [, params] = useRoute('/boletim/:date')
  const { user } = useAuth()
  const date = params?.date || ''
  const [editalAberto, setEditalAberto] = useState(false)
  const [numeroControleSelecionado, setNumeroControleSelecionado] = useState(null)

  // Converter AAAAMMDD para Date
  const dateObj = date ? new Date(
    parseInt(date.substring(0, 4)),
    parseInt(date.substring(4, 6)) - 1,
    parseInt(date.substring(6, 8))
  ) : new Date()

  const [filtroNumeroControle, setFiltroNumeroControle] = useState('')
  const [filtroModalidade, setFiltroModalidade] = useState('')
  const [licitacoes, setLicitacoes] = useState([])
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [totalEncontrado, setTotalEncontrado] = useState(0)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const observerTarget = useRef(null)

  // PRIMEIRO: Tentar buscar do banco (rápido)
  // SEGUNDO: Se não tiver no banco, buscar da API
  const { data: dataInicial, isLoading, error } = useQuery({
    queryKey: ['licitacoes-inicial', date, filtroNumeroControle, filtroModalidade],
    queryFn: async () => {
      console.log('📅 [Boletim Dia] Iniciando busca para data:', date)
      
      // 1. PRIMEIRO: Tentar buscar do banco (rápido) - apenas se não tiver filtro específico
      if (supabase && !filtroNumeroControle) {
        console.log('📦 [Boletim Dia] Buscando do banco de dados...')
        const licitacoesDoBanco = await buscarLicitacoesDoBanco(date)
        
        if (licitacoesDoBanco && licitacoesDoBanco.length > 0) {
          console.log(`✅ [Boletim Dia] ${licitacoesDoBanco.length} licitações encontradas no banco!`)
          
          // Aplicar filtro de modalidade se houver
          let licitacoesFiltradas = licitacoesDoBanco
          if (filtroModalidade && filtroModalidade !== '0') {
            const modalidadeNum = parseInt(filtroModalidade)
            licitacoesFiltradas = licitacoesDoBanco.filter(
              lic => lic.codigoModalidadeContratacao === modalidadeNum
            )
            console.log(`🔍 [Boletim Dia] Filtrado por modalidade ${modalidadeNum}: ${licitacoesFiltradas.length} licitações`)
          }
          
          return {
            data: licitacoesFiltradas,
            totalRegistros: licitacoesFiltradas.length,
            totalPaginas: 1,
            empty: licitacoesFiltradas.length === 0,
            fromCache: true, // Indica que veio do banco
          }
        }
        console.log('⚠️ [Boletim Dia] Nenhuma licitação no banco, buscando da API...')
      }
      
      // 2. SEGUNDO: Buscar da API (se não tiver no banco ou tiver filtro específico)
      try {
        const params = {
          dataInicial: date,
          dataFinal: date,
          pagina: 1,
          tamanhoPagina: 50,
          limiteInicial: 500, // Buscar apenas 500 primeiro para mostrar rápido
        }
        
        // Aplicar filtros opcionais
        if (filtroNumeroControle && filtroNumeroControle.trim()) {
          params.numeroControlePNCP = filtroNumeroControle.trim()
        }
        if (filtroModalidade && filtroModalidade !== '') {
          const modalidadeNum = parseInt(filtroModalidade)
          if (modalidadeNum >= 1 && modalidadeNum <= 13) {
            params.codigoModalidadeContratacao = modalidadeNum
          }
        }
        
        const resultado = await buscarContratacoesPorData(params)
        console.log('✅ [Boletim Dia] Busca da API concluída:', {
          total: resultado.totalRegistros || resultado.data?.length || 0,
          empty: resultado.empty,
          dataLength: resultado.data?.length || 0
        })
        return resultado
      } catch (err) {
        console.error('❌ [Boletim Dia] Erro na busca:', err)
        throw err
      }
    },
    enabled: !!date
  })

  // Buscar próximos lotes em background - SEMPRE chamar o hook, mas controlar via enabled
  const { data: dataCompleto } = useQuery({
    queryKey: ['licitacoes-completo', date, filtroNumeroControle, filtroModalidade],
    queryFn: async () => {
      console.log('📅 [Boletim Dia] Iniciando busca COMPLETA em background para data:', date)
      try {
        const params = {
          dataInicial: date,
          dataFinal: date,
          pagina: 1,
          tamanhoPagina: 50,
          // Sem limite - buscar tudo
        }
        
        // Aplicar filtros opcionais
        if (filtroNumeroControle && filtroNumeroControle.trim()) {
          params.numeroControlePNCP = filtroNumeroControle.trim()
        }
        if (filtroModalidade && filtroModalidade !== '') {
          const modalidadeNum = parseInt(filtroModalidade)
          if (modalidadeNum >= 1 && modalidadeNum <= 13) {
            params.codigoModalidadeContratacao = modalidadeNum
          }
        }
        
        const resultado = await buscarContratacoesPorData(params)
        console.log('✅ [Boletim Dia] Busca COMPLETA concluída:', {
          total: resultado.totalRegistros || resultado.data?.length || 0,
          empty: resultado.empty,
          dataLength: resultado.data?.length || 0
        })
        return resultado
      } catch (err) {
        console.error('❌ [Boletim Dia] Erro na busca completa:', err)
        throw err
      }
    },
    enabled: !!date && !!dataInicial && dataInicial.data && dataInicial.data.length > 0 // Só buscar completo depois do inicial
  })

  // Atualizar quando dados iniciais mudarem - SEMPRE chamar ANTES dos returns
  useEffect(() => {
    if (dataInicial?.data) {
      setLicitacoes(dataInicial.data)
      setTotalEncontrado(dataInicial.data.length)
      setPaginaAtual(1)
      // Iniciar busca do próximo lote em background
      setCarregandoMais(true)
      
      // Salvar licitações básicas no banco automaticamente
      if (user?.id && supabase) {
        salvarLicitacoesBasicas(dataInicial.data)
      }
    }
  }, [dataInicial, user?.id])

  // Atualizar quando dados completos chegarem - SEMPRE chamar ANTES dos returns
  useEffect(() => {
    if (dataCompleto?.data && dataCompleto.data.length > 0) {
      // Remover duplicatas e atualizar lista
      setLicitacoes(prev => {
        const todas = [...prev, ...dataCompleto.data]
        const unicas = Array.from(
          new Map(todas.map(item => [item.numeroControlePNCP, item])).values()
        )
        setTotalEncontrado(unicas.length)
        setCarregandoMais(false)
        
        // Salvar novas licitações no banco (apenas as que não estavam na lista anterior)
        if (user?.id && supabase) {
          const novas = dataCompleto.data.filter(
            nova => !prev.some(antiga => antiga.numeroControlePNCP === nova.numeroControlePNCP)
          )
          if (novas.length > 0) {
            salvarLicitacoesBasicas(novas)
          }
        }
        
        return unicas
      })
    }
  }, [dataCompleto, user?.id])

  // Scroll infinito - observar quando o usuário chegar no final
  const handleObserver = useCallback((entries) => {
    const target = entries[0]
    if (target.isIntersecting && !carregandoMais && dataCompleto?.data) {
      // Os dados completos já estão sendo carregados em background
      // Quando chegarem, serão automaticamente adicionados à lista
    }
  }, [carregandoMais, dataCompleto])

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '200px',
      threshold: 0.1,
    })

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [handleObserver])

  const handleToggleFavorito = async (licitacao) => {
    if (!user || !supabase) {
      alert('Supabase não configurado. Configure as variáveis de ambiente para usar favoritos.')
      return
    }

    try {
      // Usar o ID do banco se disponível (vem do servidor)
      let licitacaoId = licitacao._id
      
      // Se não tiver ID, buscar pelo numero_controle_pncp
      if (!licitacaoId) {
        const { data: licitacaoExistente } = await supabase
          .from('licitacoes')
          .select('id')
          .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
          .maybeSingle()
        
        if (!licitacaoExistente) {
          alert('Licitação não encontrada no banco. Aguarde a sincronização.')
          return
        }
        licitacaoId = licitacaoExistente.id
      }

      // Verificar se já está favorito
      const { data: existing } = await supabase
        .from('licitacoes_favoritas')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('licitacao_id', licitacaoId)
        .maybeSingle()

      if (existing) {
        // Remover favorito
        await supabase
          .from('licitacoes_favoritas')
          .delete()
          .eq('id', existing.id)
      } else {
        // Adicionar favorito
        await supabase
          .from('licitacoes_favoritas')
          .insert({
            usuario_id: user.id,
            licitacao_id: licitacaoId,
          })
      }
    } catch (error) {
      console.error('Erro ao atualizar favorito:', error)
      alert('Erro ao atualizar favorito. Tente novamente.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-12 px-6">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-6 text-lg font-medium text-gray-900">Buscando todas as licitações disponíveis...</p>
              <p className="mt-2 text-sm text-gray-600">
                Isso pode levar alguns minutos. Estamos buscando todas as páginas disponíveis no portal.
              </p>
              <div className="mt-4 max-w-md mx-auto">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-left">
                  <p className="text-sm text-orange-800">
                    <strong>Por que demora?</strong>
                  </p>
                  <ul className="mt-2 text-xs text-orange-700 space-y-1 list-disc list-inside">
                    <li>Buscando todas as páginas disponíveis</li>
                    <li>Múltiplas modalidades de licitação</li>
                    <li>Delays entre requisições para evitar bloqueios</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-12 px-6">
          <div className="container mx-auto max-w-7xl">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">Erro ao carregar licitações: {error.message}</p>
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
              Licitações de {formatarData(dateObj)}
            </h1>
            <p className="text-gray-600 mb-4">
              {totalEncontrado > 0 ? totalEncontrado : licitacoes.length} licitação(ões) encontrada(s)
              {carregandoMais && (
                <span className="ml-2 text-orange-600 text-sm">
                  (carregando mais em background...)
                </span>
              )}
            </p>
            
            {/* Filtros para conferência */}
            <div className="mb-6 bg-white border border-gray-200 rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Filtre os resultados exibidos. A busca sempre retorna todas as licitações disponíveis.
                  </p>
                </div>
                {(filtroNumeroControle || filtroModalidade) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFiltroNumeroControle('')
                      setFiltroModalidade('')
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="filtroNumeroControle" className="text-xs font-medium text-slate-700">
                    Número de Controle PNCP
                  </Label>
                  <Input
                    id="filtroNumeroControle"
                    type="text"
                    placeholder="Ex: 91987669000174-1-000604/2025"
                    value={filtroNumeroControle}
                    onChange={(e) => setFiltroNumeroControle(e.target.value)}
                    className="mt-1 text-sm border-gray-200 focus:border-orange-400 focus:ring-orange-400"
                  />
                </div>
                
                <div>
                  <Label htmlFor="filtroModalidade" className="text-xs font-medium text-slate-700">
                    Modalidade
                  </Label>
                  <Select
                    value={filtroModalidade}
                    onValueChange={setFiltroModalidade}
                  >
                    <SelectTrigger className="mt-1 text-sm border-gray-200 focus:border-orange-400">
                      <SelectValue placeholder="Todas as modalidades" />
                    </SelectTrigger>
                      <SelectContent>
                        {MODALIDADES.map((mod) => (
                          <SelectItem key={mod.id} value={mod.id.toString()}>
                            {mod.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="filtroOrgao" className="text-xs font-medium text-slate-700">
                    Órgão (buscar por texto)
                  </Label>
                  <Input
                    id="filtroOrgao"
                    type="text"
                    placeholder="Nome do órgão..."
                    className="mt-1 text-sm border-gray-200 focus:border-orange-400 focus:ring-orange-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {licitacoes.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border-2 border-orange-100 p-8 text-center">
              <p className="text-gray-600">Nenhuma licitação encontrada para esta data.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {licitacoes.map((licitacao) => (
                  <Card key={licitacao.numeroControlePNCP}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="mb-2">
                            {licitacao.objetoCompra || 'Sem objeto informado'}
                          </CardTitle>
                          <CardDescription>
                            <div className="space-y-2 mt-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-700">Modalidade:</span>
                                <span className="text-sm text-slate-600">{licitacao.modalidadeNome}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-slate-700">Órgão:</span>
                                <span className="text-sm text-slate-600 flex-1">{licitacao.orgaoEntidade?.razaosocial || 'Não informado'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-700">Valor Estimado:</span>
                                <span className="text-sm font-semibold text-orange-600">{formatarMoeda(licitacao.valorTotalEstimado)}</span>
                              </div>
                              {licitacao.dataEncerramentoProposta && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-700">Encerramento:</span>
                                  <span className="text-sm text-slate-600">{formatarData(licitacao.dataEncerramentoProposta)}</span>
                                </div>
                              )}
                            </div>
                          </CardDescription>
                        </div>
                        {user && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleFavorito(licitacao)}
                          >
                            <Star className="w-5 h-5" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="text-xs text-slate-500">
                          Nº Controle: <span className="font-mono text-slate-700">{licitacao.numeroControlePNCP}</span>
                        </div>
                        <Button
                          onClick={() => {
                            setNumeroControleSelecionado(licitacao.numeroControlePNCP)
                            setEditalAberto(true)
                          }}
                          variant="outline"
                          className="text-sm border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300"
                        >
                          Ver Detalhes →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Target para scroll infinito */}
              <div ref={observerTarget} className="h-10" />
              
              {carregandoMais && (
                <div className="mt-6 text-center">
                  <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded px-4 py-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                    <p className="text-sm text-orange-800">
                      Carregando mais licitações em background...
                    </p>
                  </div>
                </div>
              )}
            </>
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

export function BoletimDiaPage() {
  return (
    <ProtectedRoute>
      <BoletimDiaContent />
    </ProtectedRoute>
  )
}

