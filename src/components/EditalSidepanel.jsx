import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Star, FileText, Calendar, DollarSign, MapPin, Building2, Loader2, Download, ExternalLink } from 'lucide-react'
import { buscarContratacoesPorData, buscarDetalhesContratacao } from '@/lib/pncp'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { salvarLicitacaoCompleta as salvarLicitacaoCompletaSync, buscarLicitacaoDoBanco as buscarLicitacaoDoBancoSync } from '@/lib/sync'

// Função para salvar licitação completa no banco (usa a função centralizada)
async function salvarLicitacaoCompleta(licitacao, userId) {
  return await salvarLicitacaoCompletaSync(licitacao, userId)
}

// Função para buscar licitação do banco (usa a função centralizada)
async function buscarLicitacaoDoBanco(numeroControlePNCP) {
  const resultado = await buscarLicitacaoDoBancoSync(numeroControlePNCP)
  if (!resultado || !resultado.contratacao) {
    console.log('⚠️ [Sidepanel] Nenhum resultado do banco')
    return null
  }
  
  // Converter para formato plano esperado pelo componente (mesmo formato da API)
  const licitacao = resultado.contratacao
  return {
    // Dados principais (formato plano, não aninhado)
    numeroControlePNCP: licitacao.numero_controle_pncp,
    numeroCompra: licitacao.numero_compra,
    anoCompra: licitacao.ano_compra,
    processo: licitacao.processo,
    objetoCompra: licitacao.objeto_compra,
    informacaoComplementar: licitacao.informacao_complementar,
    codigoModalidadeContratacao: licitacao.modalidade_id,
    modalidadeNome: licitacao.modalidade_nome,
    valorTotalEstimado: licitacao.valor_total_estimado,
    dataAberturaProposta: licitacao.data_abertura_proposta,
    dataEncerramentoProposta: licitacao.data_encerramento_proposta,
    dataPublicacaoPNCP: licitacao.data_publicacao_pncp,
    orgaoEntidade: {
      cnpj: licitacao.orgao_cnpj,
      razaosocial: licitacao.orgao_razao_social,
    },
    unidadeOrgao: {
      municipioNome: licitacao.municipio_nome,
      ufSigla: licitacao.uf_sigla,
    },
    // Itens e documentos
    itens: resultado.itens?.map(item => ({
      numeroItem: item.numero_item,
      descricaoItem: item.descricao_item,
      quantidade: item.quantidade,
      valorUnitario: item.valor_unitario,
      valorTotal: item.valor_total,
      unidadeFornecimento: item.unidade_fornecimento,
      classificacao: {
        codigo: item.classificacao_codigo,
        nome: item.classificacao_nome,
      },
    })) || [],
    documentos: resultado.documentos?.map(doc => ({
      nomeArquivo: doc.nome_arquivo,
      urlDocumento: doc.url_documento, // LINKS DOS DOCUMENTOS
      tipoDocumento: {
        id: doc.tipo_documento_id,
        nome: doc.tipo_documento_nome,
      },
      tamanhoBytes: doc.tamanho_bytes,
      dataPublicacao: doc.data_publicacao,
    })) || [],
  }
}


export function EditalSidepanel({ numeroControle, open, onOpenChange }) {
  const { user } = useAuth()
  const [isFavorito, setIsFavorito] = useState(false)

  // Buscar a licitação específica - PRIMEIRO DO BANCO, depois da API
  const { data: licitacao, isLoading, error } = useQuery({
    queryKey: ['edital-sidepanel', numeroControle, user?.id],
    queryFn: async () => {
      if (!numeroControle) {
        console.warn('⚠️ [Sidepanel] Número de controle não fornecido')
        return null
      }

      console.log('🔍 [Sidepanel] ===== INICIANDO BUSCA =====')
      console.log('🔍 [Sidepanel] Número de controle:', numeroControle)
      console.log('🔍 [Sidepanel] User ID:', user?.id)

      // 1. PRIMEIRO: Tentar buscar do banco de dados
      if (user?.id && supabase) {
        console.log('📦 [Sidepanel] Buscando do banco de dados...')
        const licitacaoDoBanco = await buscarLicitacaoDoBanco(numeroControle)
        
        if (licitacaoDoBanco && licitacaoDoBanco.numeroControlePNCP) {
          console.log('✅ [Sidepanel] Licitação encontrada no banco!', {
            itens: licitacaoDoBanco.itens?.length || 0,
            documentos: licitacaoDoBanco.documentos?.length || 0,
          })
          return licitacaoDoBanco
        }
        console.log('⚠️ [Sidepanel] Licitação não encontrada no banco, buscando da API...')
      }

      // 2. SEGUNDO: Se não encontrou no banco, buscar da API
      const hoje = new Date()
      let licitacaoBasica = null

      // Buscar nas últimas 30 datas (reduzido porque agora temos cache no banco)
      for (let i = 0; i < 30; i++) {
        const data = new Date(hoje)
        data.setDate(hoje.getDate() - i)
        const dataStr = `${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, '0')}${String(data.getDate()).padStart(2, '0')}`
        
        try {
          // Buscar com número de controle diretamente
          const resultado = await buscarContratacoesPorData({
            dataInicial: dataStr,
            dataFinal: dataStr,
            numeroControlePNCP: numeroControle,
            pagina: 1,
            tamanhoPagina: 50,
            // Sem limiteInicial para garantir que encontre
          })

          if (resultado.data && resultado.data.length > 0) {
            const encontrada = resultado.data.find(
              (l) => l.numeroControlePNCP === numeroControle
            )

            if (encontrada) {
              licitacaoBasica = encontrada
              console.log('✅ [Sidepanel] Licitação encontrada na API, data:', dataStr)
              break
            }
          }
        } catch (err) {
          console.warn(`⚠️ [Sidepanel] Erro ao buscar data ${dataStr}:`, err.message)
          continue
        }
      }

      if (!licitacaoBasica) {
        console.warn('⚠️ [Sidepanel] Licitação não encontrada na API')
        return null
      }

      // 3. Buscar detalhes completos (itens, documentos)
      console.log('🔍 [Sidepanel] Buscando detalhes da API...')
      let detalhes = null
      try {
        detalhes = await buscarDetalhesContratacao(numeroControle)
        console.log('✅ [Sidepanel] Detalhes obtidos:', {
          temContratacao: !!detalhes?.contratacao,
          itens: detalhes?.itens?.length || 0,
          documentos: detalhes?.documentos?.length || 0,
        })
      } catch (err) {
        console.error('❌ [Sidepanel] Erro ao buscar detalhes:', err)
      }
      
      // Combinar dados básicos com detalhes (formato plano)
      const resultado = {
        ...licitacaoBasica,
        // Se detalhes.contratacao existir, mesclar
        ...(detalhes?.contratacao || {}),
        // Itens e documentos
        itens: detalhes?.itens || [],
        documentos: detalhes?.documentos || []
      }
      
      console.log('📊 [Sidepanel] Resultado final:', {
        numeroControle: resultado.numeroControlePNCP,
        objeto: resultado.objetoCompra?.substring(0, 50),
        itens: resultado.itens?.length || 0,
        documentos: resultado.documentos?.length || 0,
      })
      
      // 4. SALVAR NO BANCO para próximas consultas
      if (user?.id && supabase && resultado.numeroControlePNCP) {
        console.log('💾 [Sidepanel] Salvando no banco de dados...')
        try {
          const salvo = await salvarLicitacaoCompleta(resultado, user.id)
          if (salvo) {
            console.log('✅ [Sidepanel] Licitação salva com sucesso no banco!')
          } else {
            console.warn('⚠️ [Sidepanel] Não foi possível salvar no banco')
          }
        } catch (err) {
          console.error('❌ [Sidepanel] Erro ao salvar no banco:', err)
        }
      } else {
        console.warn('⚠️ [Sidepanel] Não salvando - faltam dados:', {
          temUser: !!user?.id,
          temSupabase: !!supabase,
          temNumeroControle: !!resultado.numeroControlePNCP,
        })
      }
      
      return resultado
    },
    enabled: !!numeroControle && open,
    retry: 1, // Tentar apenas 1 vez (já temos cache no banco)
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  })

  // Verificar se já é favorito
  const { data: favoritoData } = useQuery({
    queryKey: ['favorito-check', user?.id, numeroControle],
    queryFn: async () => {
      if (!user || !supabase || !licitacao) return false

      try {
        let licitacaoId = licitacao._id
        
        if (!licitacaoId) {
          const { data: licitacaoExistente } = await supabase
            .from('licitacoes')
            .select('id')
            .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
            .maybeSingle()
          
          if (!licitacaoExistente) return false
          licitacaoId = licitacaoExistente.id
        }

        const { data: existing } = await supabase
          .from('licitacoes_favoritas')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('licitacao_id', licitacaoId)
          .maybeSingle()

        return !!existing
      } catch (error) {
        console.error('Erro ao verificar favorito:', error)
        return false
      }
    },
    enabled: !!user && !!licitacao && open,
  })

  const handleToggleFavorito = async () => {
    if (!user || !supabase || !licitacao) {
      alert('Você precisa estar logado para adicionar favoritos.')
      return
    }

    try {
      // Buscar ID da licitação pelo número de controle
      const { data: licitacaoExistente } = await supabase
        .from('licitacoes')
        .select('id')
        .eq('numero_controle_pncp', licitacao.numeroControlePNCP)
        .maybeSingle()
      
      if (!licitacaoExistente) {
        console.warn('⚠️ [Favorito] Licitação não encontrada no banco:', licitacao.numeroControlePNCP)
        alert('Licitação não encontrada no banco. Tente abrir os detalhes novamente.')
        return
      }
      
      const licitacaoId = licitacaoExistente.id

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
        setIsFavorito(false)
      } else {
        await supabase
          .from('licitacoes_favoritas')
          .insert({
            usuario_id: user.id,
            licitacao_id: licitacaoId,
          })
        setIsFavorito(true)
      }
    } catch (error) {
      console.error('Erro ao atualizar favorito:', error)
      alert('Erro ao atualizar favorito. Tente novamente.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="sr-only">Detalhes do Edital</SheetTitle>
          <SheetDescription className="sr-only">Informações completas da licitação</SheetDescription>
        </SheetHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
              <p className="text-gray-600">Carregando detalhes do edital...</p>
            </div>
          </div>
        ) : error || !licitacao ? (
          <div className="py-12">
            <p className="text-red-600 text-center">
              {error ? `Erro ao carregar edital: ${error.message}` : 'Edital não encontrado.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <h2 className="text-2xl font-semibold mb-2 text-orange-600">
                    {licitacao.objetoCompra || 'Objeto não informado'}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="w-4 h-4" />
                    <span>Nº Controle PNCP: {licitacao.numeroControlePNCP}</span>
                  </div>
                </div>
                {user && (
                  <button
                    onClick={handleToggleFavorito}
                    className="p-2 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Adicionar aos favoritos"
                    aria-label="Adicionar aos favoritos"
                  >
                    <Star 
                      className={`w-6 h-6 ${favoritoData || isFavorito ? 'fill-orange-500 text-orange-500' : 'text-gray-400 hover:text-orange-500'}`} 
                    />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {/* Informações Básicas */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-orange-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500">Modalidade</p>
                    <p className="font-semibold">{licitacao.modalidadeNome || 'Não informado'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-orange-600 mt-1 flex-shrink-0" />
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
                  <DollarSign className="w-5 h-5 text-orange-600 mt-1 flex-shrink-0" />
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
                  <Building2 className="w-5 h-5 text-orange-600 mt-1 flex-shrink-0" />
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
                  <MapPin className="w-5 h-5 text-orange-600 mt-1 flex-shrink-0" />
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
                  <p className="text-sm text-gray-500 mb-2 font-semibold">Informações Complementares</p>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">
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

              {/* Itens da Licitação */}
              {licitacao.itens && licitacao.itens.length > 0 ? (
                <div className="pt-4 border-t">
                  <h3 className="text-sm text-gray-500 mb-3 font-semibold">Itens da Licitação ({licitacao.itens.length})</h3>
                  <div className="space-y-3">
                    {licitacao.itens.map((item, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-semibold text-sm">Item {item.numeroItem || item.numero || index + 1}</div>
                          {item.valorTotal && (
                            <div className="text-sm font-semibold text-orange-600">
                              {formatarMoeda(item.valorTotal)}
                            </div>
                          )}
                        </div>
                        {item.descricaoItem && (
                          <div className="text-sm text-gray-700 mb-2">{item.descricaoItem}</div>
                        )}
                        {item.descricao && !item.descricaoItem && (
                          <div className="text-sm text-gray-700 mb-2">{item.descricao}</div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          {item.quantidade && (
                            <div>
                              <span className="font-semibold">Quantidade:</span> {item.quantidade}
                              {item.unidadeFornecimento && ` ${item.unidadeFornecimento}`}
                            </div>
                          )}
                          {item.valorUnitario && (
                            <div>
                              <span className="font-semibold">Valor Unitário:</span> {formatarMoeda(item.valorUnitario)}
                            </div>
                          )}
                          {item.classificacaoNome && (
                            <div className="col-span-2">
                              <span className="font-semibold">Classificação:</span> {item.classificacaoNome}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t">
                  <div className="text-sm text-gray-500">Nenhum item encontrado para esta licitação.</div>
                </div>
              )}

              {/* Documentos e Anexos */}
              {licitacao.documentos && licitacao.documentos.length > 0 ? (
                <div className="pt-4 border-t">
                  <h3 className="text-sm text-gray-500 mb-3 font-semibold">Documentos e Anexos ({licitacao.documentos.length})</h3>
                  <div className="space-y-2">
                    {licitacao.documentos.map((doc, index) => {
                      const url = doc.urlDocumento || doc.linkDocumento || doc.url || doc.link
                      const nome = doc.nomeArquivo || doc.nomeDocumento || doc.nome || `Documento ${index + 1}`
                      
                      return url ? (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-orange-50 hover:border-orange-300 transition-colors group"
                        >
                          <FileText className="w-5 h-5 text-orange-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate group-hover:text-orange-600">
                              {nome}
                            </div>
                            {doc.tipoDocumentoNome && (
                              <div className="text-xs text-gray-500">{doc.tipoDocumentoNome}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.tamanhoBytes && (
                              <div className="text-xs text-gray-500">
                                {(doc.tamanhoBytes / 1024).toFixed(1)} KB
                              </div>
                            )}
                            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-orange-600" />
                          </div>
                        </a>
                      ) : (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {nome}
                            </div>
                            <div className="text-xs text-gray-500">Link não disponível</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t">
                  <div className="text-sm text-gray-500">Nenhum documento encontrado para esta licitação.</div>
                </div>
              )}

              {/* Link do Sistema de Origem (se disponível) */}
              {licitacao.linkSistemaOrigem && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2 font-semibold">Link Original</p>
                  <a
                    href={licitacao.linkSistemaOrigem}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 underline"
                  >
                    <FileText className="w-4 h-4" />
                    Ver no sistema de origem
                  </a>
                </div>
              )}

              {/* Informações do Órgão (mais detalhadas) */}
              {licitacao.orgaoEntidade && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2 font-semibold">Informações do Órgão</p>
                  <div className="space-y-1 text-sm">
                    {licitacao.orgaoEntidade.razaosocial && (
                      <p><span className="font-semibold">Razão Social:</span> {licitacao.orgaoEntidade.razaosocial}</p>
                    )}
                    {licitacao.orgaoEntidade.cnpj && (
                      <p><span className="font-semibold">CNPJ:</span> {licitacao.orgaoEntidade.cnpj}</p>
                    )}
                    {licitacao.orgaoEntidade.poderNome && (
                      <p><span className="font-semibold">Poder:</span> {licitacao.orgaoEntidade.poderNome}</p>
                    )}
                    {licitacao.orgaoEntidade.esferaNome && (
                      <p><span className="font-semibold">Esfera:</span> {licitacao.orgaoEntidade.esferaNome}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

