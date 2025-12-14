import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { buscarContratacoesPorData } from '@/lib/pncp'
import { formatarData, formatarMoeda } from '@/lib/utils'
import { formatarDataParaPNCP } from '@/lib/pncp'
import { useAuth } from '@/hooks/useAuth'
import { EditalSidepanel } from '@/components/EditalSidepanel'

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

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

function FiltroContent() {
  const { user } = useAuth()
  const [editalAberto, setEditalAberto] = useState(false)
  const [numeroControleSelecionado, setNumeroControleSelecionado] = useState(null)
  const [filtros, setFiltros] = useState({
    dataInicial: formatarDataParaPNCP(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    dataFinal: formatarDataParaPNCP(new Date()),
    codigoModalidadeContratacao: '',
    uf: '',
    codigoMunicipioIbge: '',
    cnpj: '',
    numeroControlePNCP: '', // Novo filtro por número de controle
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['licitacoes-filtro', filtros],
    queryFn: async () => {
      // Buscar DIRETAMENTE do PNCP (aplicação é máscara da API)
      const params = {
        dataInicial: filtros.dataInicial,
        dataFinal: filtros.dataFinal,
        // Só enviar modalidade se for válida (1-13)
        codigoModalidadeContratacao: filtros.codigoModalidadeContratacao && 
                                      filtros.codigoModalidadeContratacao !== '' && 
                                      filtros.codigoModalidadeContratacao !== 'TODAS' &&
                                      parseInt(filtros.codigoModalidadeContratacao) >= 1 &&
                                      parseInt(filtros.codigoModalidadeContratacao) <= 13
          ? parseInt(filtros.codigoModalidadeContratacao)
          : undefined, // undefined = não enviar (busca todas)
        pagina: 1,
        tamanhoPagina: 50,
      }

      if (filtros.uf && filtros.uf !== 'TODOS') params.uf = filtros.uf
      if (filtros.codigoMunicipioIbge) params.codigoMunicipioIbge = filtros.codigoMunicipioIbge
      if (filtros.cnpj) params.cnpj = filtros.cnpj.replace(/\D/g, '')
      if (filtros.numeroControlePNCP) params.numeroControlePNCP = filtros.numeroControlePNCP.trim()

      return await buscarContratacoesPorData(params)
    },
    enabled: false, // Só busca quando clicar no botão
  })

  const handleFiltroChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }))
  }

  const handleBuscar = () => {
    refetch()
  }

  const licitacoes = data?.data || []

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 py-12 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
              Filtro de Licitações
            </h1>
            <p className="text-gray-600">
              Busque licitações com filtros avançados
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Filtros de Busca</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="dataInicial">Data Inicial</Label>
                      <Input
                        id="dataInicial"
                        type="date"
                        value={filtros.dataInicial ? new Date(
                          parseInt(filtros.dataInicial.substring(0, 4)),
                          parseInt(filtros.dataInicial.substring(4, 6)) - 1,
                          parseInt(filtros.dataInicial.substring(6, 8))
                        ).toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value.replace(/-/g, '')
                          handleFiltroChange('dataInicial', date)
                        }}
                      />
                    </div>

                    <div>
                      <Label htmlFor="dataFinal">Data Final</Label>
                      <Input
                        id="dataFinal"
                        type="date"
                        value={filtros.dataFinal ? new Date(
                          parseInt(filtros.dataFinal.substring(0, 4)),
                          parseInt(filtros.dataFinal.substring(4, 6)) - 1,
                          parseInt(filtros.dataFinal.substring(6, 8))
                        ).toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value.replace(/-/g, '')
                          handleFiltroChange('dataFinal', date)
                        }}
                      />
                    </div>

                    <div>
                      <Label htmlFor="modalidade">Modalidade</Label>
                      <Select
                        value={filtros.codigoModalidadeContratacao}
                        onValueChange={(value) => handleFiltroChange('codigoModalidadeContratacao', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as modalidades" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TODAS">Todas as modalidades</SelectItem>
                          {MODALIDADES.map((mod) => (
                            <SelectItem key={mod.id} value={mod.id.toString()}>
                              {mod.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="uf">Estado (UF)</Label>
                      <Select
                        value={filtros.uf}
                        onValueChange={(value) => handleFiltroChange('uf', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os estados" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TODOS">Todos os estados</SelectItem>
                          {UFS.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="cnpj">CNPJ do Órgão</Label>
                      <Input
                        id="cnpj"
                        type="text"
                        placeholder="00.000.000/0000-00"
                        value={filtros.cnpj}
                        onChange={(e) => handleFiltroChange('cnpj', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="numeroControlePNCP">Número de Controle PNCP</Label>
                      <Input
                        id="numeroControlePNCP"
                        type="text"
                        placeholder="Ex: 91987669000174-1-000604/2025"
                        value={filtros.numeroControlePNCP}
                        onChange={(e) => handleFiltroChange('numeroControlePNCP', e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Busque uma licitação específica pelo número de controle
                      </p>
                    </div>

                    <Button onClick={handleBuscar} className="w-full" disabled={isLoading}>
                      {isLoading ? 'Buscando...' : 'Buscar Licitações'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {isLoading && (
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
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600">Erro ao buscar licitações: {error.message}</p>
                </div>
              )}

              {!isLoading && !error && data && (
                <>
                  <div className="mb-4">
                    <p className="text-gray-600">
                      {licitacoes.length} licitação(ões) encontrada(s)
                    </p>
                  </div>

                  {licitacoes.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border-2 border-orange-100 p-8 text-center">
                      <p className="text-gray-600">Nenhuma licitação encontrada com os filtros selecionados.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {licitacoes.map((licitacao) => (
                        <Card key={licitacao.numeroControlePNCP}>
                          <CardHeader>
                            <CardTitle className="mb-2">
                              {licitacao.objetoCompra || 'Sem objeto informado'}
                            </CardTitle>
                            <CardDescription>
                              <div className="space-y-1 mt-2">
                                <p><strong>Modalidade:</strong> {licitacao.modalidadeNome}</p>
                                <p><strong>Órgão:</strong> {licitacao.orgaoEntidade?.razaosocial}</p>
                                <p><strong>Valor Estimado:</strong> {formatarMoeda(licitacao.valorTotalEstimado)}</p>
                                {licitacao.dataEncerramentoProposta && (
                                  <p><strong>Encerramento:</strong> {formatarData(licitacao.dataEncerramentoProposta)}</p>
                                )}
                              </div>
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Button
                              onClick={() => {
                                setNumeroControleSelecionado(licitacao.numeroControlePNCP)
                                setEditalAberto(true)
                              }}
                              variant="outline"
                              className="mt-4"
                            >
                              Ver Detalhes do Edital →
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
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

export function FiltroPage() {
  return (
    <ProtectedRoute>
      <FiltroContent />
    </ProtectedRoute>
  )
}

