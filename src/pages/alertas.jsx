import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useFiltrosSalvos } from '@/hooks/useFiltrosSalvos'
import { Trash2, Plus, Filter, Check, X, Loader2 } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'

const alertaSchema = z.object({
  nome_alerta: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email_notificacao: z.string().email('Email inválido'),
  frequencia: z.enum(['diario', 'semanal', 'imediato'], {
    required_error: 'Selecione uma frequência',
  }),
  horario_verificacao: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário inválido (formato: HH:MM)').optional(),
  filtros: z.object({
    modalidade: z.string().optional(),
    uf: z.string().optional(),
    valorMinimo: z.string().optional(),
    valorMaximo: z.string().optional(),
  }).optional(),
})

function AlertasContent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { success, error: showError, warning, confirm: confirmDialog } = useNotifications()
  const { filtrosSalvos, isLoading: loadingFiltros } = useFiltrosSalvos()
  const [showForm, setShowForm] = useState(false)
  const [filtroSelecionado, setFiltroSelecionado] = useState(null)

  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas', user?.id],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase não configurado')
      
      const { data, error } = await supabase
        .from('alertas_usuario')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!user && !!supabase,
  })

  const { mutate: criarAlerta } = useMutation({
    mutationFn: async (novoAlerta) => {
      if (!supabase) throw new Error('Supabase não configurado')
      
      // Se um filtro foi selecionado, usar os filtros do filtro salvo
      let filtrosParaSalvar = novoAlerta.filtros || {}
      let filtrosAvancados = {}
      
      if (filtroSelecionado) {
        filtrosParaSalvar = filtroSelecionado.filtros_inclusao || {}
        filtrosAvancados = {
          filtros_exclusao: filtroSelecionado.filtros_exclusao || {},
          filtros_cnaes: filtroSelecionado.filtros_cnaes || {},
        }
      }
      
      // Preparar dados para inserção (só incluir filtros_avancados se tiver conteúdo)
      const dadosInsercao = {
        usuario_id: user.id,
        nome_alerta: novoAlerta.nome_alerta,
        email_notificacao: novoAlerta.email_notificacao,
        frequencia: novoAlerta.frequencia,
        filtros: filtrosParaSalvar,
        ativo: true, // Por padrão, alerta é criado ativo
      }

      // Adicionar horário de verificação se fornecido (apenas para diário e semanal)
      // Converter formato HH:MM para TIME (HH:MM:SS)
      if (novoAlerta.horario_verificacao && (novoAlerta.frequencia === 'diario' || novoAlerta.frequencia === 'semanal')) {
        // Garantir formato HH:MM:SS
        const horario = novoAlerta.horario_verificacao.includes(':') 
          ? novoAlerta.horario_verificacao.length === 5 
            ? `${novoAlerta.horario_verificacao}:00` 
            : novoAlerta.horario_verificacao
          : null
        if (horario) {
          dadosInsercao.horario_verificacao = horario
        }
      }

      // Só adicionar filtros_avancados se tiver conteúdo
      if (Object.keys(filtrosAvancados).length > 0) {
        dadosInsercao.filtros_avancados = filtrosAvancados
      }

      const { data, error } = await supabase
        .from('alertas_usuario')
        .insert(dadosInsercao)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas', user?.id])
      setShowForm(false)
      setFiltroSelecionado(null)
      reset()
      success('Alerta criado com sucesso!')
    },
    onError: (error) => {
      showError('Erro ao criar alerta: ' + (error.message || 'Erro desconhecido'))
    },
  })

  const { mutate: deletarAlerta, isPending: deletandoAlerta } = useMutation({
    mutationFn: async (alertaId) => {
      if (!supabase) throw new Error('Supabase não configurado')
      
      const { error } = await supabase
        .from('alertas_usuario')
        .delete()
        .eq('id', alertaId)
        .eq('usuario_id', user.id) // Garantir que só deleta alertas do próprio usuário

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas', user?.id])
      success('Alerta excluído com sucesso!')
    },
    onError: (error) => {
      showError('Erro ao excluir alerta: ' + (error.message || 'Erro desconhecido'))
    },
  })

  const { mutate: toggleAlerta } = useMutation({
    mutationFn: async ({ alertaId, ativo }) => {
      if (!supabase) throw new Error('Supabase não configurado')
      
      const { error } = await supabase
        .from('alertas_usuario')
        .update({ ativo: !ativo })
        .eq('id', alertaId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas', user?.id])
      success('Status do alerta atualizado!')
    },
    onError: (error) => {
      showError('Erro ao atualizar alerta: ' + (error.message || 'Erro desconhecido'))
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(alertaSchema),
    defaultValues: {
      frequencia: 'diario',
      filtros: {},
    },
  })

  const onSubmit = (data) => {
    criarAlerta(data)
  }

  return (
    <AppLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Alertas
              </h1>
              <p className="text-gray-600">
                Configure alertas para receber notificações sobre novas licitações
              </p>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancelar
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Alerta
                </>
              )}
            </Button>
          </div>

          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando alertas...</p>
            </div>
          )}

          {!isLoading && showForm && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Criar Novo Alerta</CardTitle>
                <CardDescription>
                  Configure critérios para receber notificações via webhook quando novas licitações corresponderem aos seus filtros
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Campos Principais - 4 colunas */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="nome_alerta">Nome do Alerta *</Label>
                      <Input
                        id="nome_alerta"
                        {...register('nome_alerta')}
                        placeholder="Ex: Licitações de TI em SP"
                        className={errors.nome_alerta ? 'border-red-500' : ''}
                      />
                      {errors.nome_alerta && (
                        <p className="text-red-600 text-sm mt-1">{errors.nome_alerta.message}</p>
                      )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="email_notificacao">Email para Notificações *</Label>
                      <Input
                        id="email_notificacao"
                        type="email"
                        {...register('email_notificacao')}
                        placeholder="seu@email.com"
                        className={errors.email_notificacao ? 'border-red-500' : ''}
                      />
                      {errors.email_notificacao && (
                        <p className="text-red-600 text-sm mt-1">{errors.email_notificacao.message}</p>
                      )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="frequencia">Frequência *</Label>
                      <Select
                        value={watch('frequencia')}
                        onValueChange={(value) => {
                          setValue('frequencia', value)
                          // Limpar horário se mudar para imediato
                          if (value === 'imediato') {
                            setValue('horario_verificacao', undefined)
                          }
                        }}
                      >
                        <SelectTrigger className={errors.frequencia ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Selecione a frequência" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="imediato">Imediato</SelectItem>
                          <SelectItem value="diario">Diário</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.frequencia && (
                        <p className="text-red-600 text-sm mt-1">{errors.frequencia.message}</p>
                      )}
                    </div>

                    {(watch('frequencia') === 'diario' || watch('frequencia') === 'semanal') && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="horario_verificacao">Horário de Verificação</Label>
                        <Input
                          id="horario_verificacao"
                          type="time"
                          {...register('horario_verificacao')}
                          defaultValue="09:00"
                          className={errors.horario_verificacao ? 'border-red-500' : ''}
                        />
                        {errors.horario_verificacao && (
                          <p className="text-red-600 text-sm mt-1">{errors.horario_verificacao.message}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Horário em que o sistema verificará novas licitações (apenas para frequências Diário e Semanal)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Seção de Filtros Salvos */}
                  <div className="pt-4 border-t">
                    <Label className="text-base font-semibold mb-4 block flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      Selecione um Filtro Salvo
                    </Label>
                    
                    {loadingFiltros ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">Carregando filtros...</p>
                      </div>
                    ) : filtrosSalvos.length === 0 ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                        <Filter className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-1">Nenhum filtro salvo encontrado</p>
                        <p className="text-xs text-gray-500">Crie filtros personalizados na página de Licitações para usá-los aqui</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtrosSalvos.map((filtro) => {
                          const isSelected = filtroSelecionado?.id === filtro.id
                          return (
                            <Card
                              key={filtro.id}
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                isSelected
                                  ? 'border-orange-500 bg-orange-50 shadow-sm'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => {
                                setFiltroSelecionado(isSelected ? null : filtro)
                              }}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Filter className={`w-4 h-4 ${isSelected ? 'text-orange-600' : 'text-gray-400'}`} />
                                      <h4 className={`font-semibold text-sm truncate ${isSelected ? 'text-orange-900' : 'text-gray-900'}`}>
                                        {filtro.nome}
                                      </h4>
                                    </div>
                                    {filtro.descricao && (
                                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                        {filtro.descricao}
                                      </p>
                                    )}
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {filtro.filtros_inclusao?.uf && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                          UF: {filtro.filtros_inclusao.uf}
                                        </span>
                                      )}
                                      {filtro.filtros_inclusao?.modalidade && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                          {filtro.filtros_inclusao.modalidade}
                                        </span>
                                      )}
                                      {filtro.filtros_cnaes && Object.keys(filtro.filtros_cnaes).length > 0 && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                          CNAEs
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0">
                                    {isSelected ? (
                                      <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                    
                    {filtroSelecionado && (
                      <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-orange-900 mb-1">
                              Filtro selecionado: {filtroSelecionado.nome}
                            </p>
                            <p className="text-xs text-orange-700">
                              Este filtro será usado como critério para o alerta
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFiltroSelecionado(null)}
                            className="text-orange-700 hover:text-orange-900"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botão de Submit */}
                  <div className="pt-4 border-t">
                    <Button type="submit" className="w-full md:w-auto">
                      Criar Alerta
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {!isLoading && (
            <div className="space-y-4">
              {alertas && alertas.length > 0 ? (
                alertas.map((alerta) => (
                  <Card key={alerta.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle>{alerta.nome_alerta}</CardTitle>
                          <CardDescription className="mt-2">
                            <p><strong>Email:</strong> {alerta.email_notificacao}</p>
                            <p><strong>Frequência:</strong> {
                              alerta.frequencia === 'imediato' ? 'Imediato' :
                              alerta.frequencia === 'diario' ? 'Diário' : 'Semanal'
                            }</p>
                            {alerta.horario_verificacao && (
                              <p><strong>Horário:</strong> {alerta.horario_verificacao}</p>
                            )}
                            {alerta.ultima_verificacao && (
                              <p><strong>Última verificação:</strong> {new Date(alerta.ultima_verificacao).toLocaleString('pt-BR')}</p>
                            )}
                            <p><strong>Status:</strong> {alerta.ativo ? 'Ativo' : 'Inativo'}</p>
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAlerta({ alertaId: alerta.id, ativo: alerta.ativo })}
                          >
                            {alerta.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              const confirmado = await confirmDialog(
                                'Excluir Alerta',
                                `Tem certeza que deseja excluir o alerta "${alerta.nome_alerta}"? Esta ação não pode ser desfeita.`
                              )
                              if (confirmado) {
                                deletarAlerta(alerta.id)
                              }
                            }}
                            disabled={deletandoAlerta}
                          >
                            {deletandoAlerta ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-gray-600">Nenhum alerta configurado ainda.</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Clique em "Novo Alerta" para criar seu primeiro alerta.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

export function AlertasPage() {
  return (
    <ProtectedRoute>
      <AlertasContent />
    </ProtectedRoute>
  )
}

