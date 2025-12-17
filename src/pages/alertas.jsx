import { useState, useEffect } from 'react'
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
import { Trash2, Plus, Filter, Loader2, Clock, Edit } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'

const alertaSchema = z.object({
  nome_alerta: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  horario_verificacao: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário inválido (formato: HH:MM)'),
})

function AlertasContent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { success, error: showError, warning, confirm: confirmDialog } = useNotifications()
  const [showForm, setShowForm] = useState(false)

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
      
      // 1. Buscar perfil completo da empresa para usar filtros automáticos
      const { data: perfil, error: perfilError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (perfilError) {
        throw new Error('Erro ao buscar perfil da empresa')
      }

      // 2. Preparar filtros baseados no perfil da empresa
      const filtros = {}
      const filtrosAvancados = {}
      
      // Estados de interesse do perfil
      if (perfil.estados_interesse && Array.isArray(perfil.estados_interesse) && perfil.estados_interesse.length > 0) {
        // Se tiver apenas um estado, usar diretamente
        if (perfil.estados_interesse.length === 1) {
          filtros.uf = perfil.estados_interesse[0]
        }
        // Se tiver múltiplos, usar filtros avançados
        filtrosAvancados.filtros_exclusao = {
          ...filtrosAvancados.filtros_exclusao,
          incluirUfs: perfil.estados_interesse
        }
      }

      // Setores de atividade (CNAEs)
      if (perfil.setores_atividades && Array.isArray(perfil.setores_atividades) && perfil.setores_atividades.length > 0) {
        filtrosAvancados.filtros_cnaes = {}
        perfil.setores_atividades.forEach(cnae => {
          filtrosAvancados.filtros_cnaes[cnae] = true
        })
      }

      // CNAE principal
      if (perfil.cnae_principal) {
        if (!filtrosAvancados.filtros_cnaes) {
          filtrosAvancados.filtros_cnaes = {}
        }
        filtrosAvancados.filtros_cnaes[perfil.cnae_principal] = true
      }
      
      // 3. Preparar dados para inserção
      const horario = novoAlerta.horario_verificacao.includes(':') 
        ? novoAlerta.horario_verificacao.length === 5 
          ? `${novoAlerta.horario_verificacao}:00` 
          : novoAlerta.horario_verificacao
        : null

      const dadosInsercao = {
        usuario_id: user.id,
        nome_alerta: novoAlerta.nome_alerta,
        email_notificacao: perfil.email || user.email, // Usar email do perfil ou do usuário
        frequencia: 'diario', // Sempre diário
        horario_verificacao: horario,
        filtros: filtros,
        filtros_avancados: filtrosAvancados,
        ativo: true, // Por padrão, alerta é criado ativo
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
      reset()
      success('Alerta criado com sucesso! O alerta usará automaticamente os filtros do seu perfil.')
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

  const [alertaEditando, setAlertaEditando] = useState(null)

  const { mutate: editarAlerta } = useMutation({
    mutationFn: async ({ alertaId, dados }) => {
      if (!supabase) throw new Error('Supabase não configurado')
      
      const horario = dados.horario_verificacao.includes(':') 
        ? dados.horario_verificacao.length === 5 
          ? `${dados.horario_verificacao}:00` 
          : dados.horario_verificacao
        : null

      const { error } = await supabase
        .from('alertas_usuario')
        .update({
          nome_alerta: dados.nome_alerta,
          horario_verificacao: horario,
        })
        .eq('id', alertaId)
        .eq('usuario_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas', user?.id])
      success('Alerta atualizado com sucesso!')
      setAlertaEditando(null)
    },
    onError: (error) => {
      showError('Erro ao atualizar alerta: ' + (error.message || 'Erro desconhecido'))
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
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(alertaSchema),
    defaultValues: {
      horario_verificacao: '09:00',
    },
  })

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit },
  } = useForm({
    resolver: zodResolver(alertaSchema),
  })

  // Atualizar form de edição quando alertaEditando mudar
  useEffect(() => {
    if (alertaEditando) {
      resetEdit({
        nome_alerta: alertaEditando.nome_alerta,
        horario_verificacao: alertaEditando.horario_verificacao?.slice(0, 5) || '09:00',
      })
    }
  }, [alertaEditando, resetEdit])

  const onSubmit = (data) => {
    criarAlerta(data)
  }

  const onSubmitEdit = (data) => {
    editarAlerta({ alertaId: alertaEditando.id, dados: data })
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

          {!isLoading && alertaEditando && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Editar Alerta</CardTitle>
                <CardDescription>
                  Edite o nome e horário do alerta. Os filtros continuam sendo automáticos baseados no seu perfil.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_nome_alerta">Nome do Alerta *</Label>
                      <Input
                        id="edit_nome_alerta"
                        {...registerEdit('nome_alerta')}
                        className={errorsEdit.nome_alerta ? 'border-red-500' : ''}
                      />
                      {errorsEdit.nome_alerta && (
                        <p className="text-red-600 text-sm mt-1">{errorsEdit.nome_alerta.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit_horario_verificacao">Horário de Verificação *</Label>
                      <Input
                        id="edit_horario_verificacao"
                        type="time"
                        {...registerEdit('horario_verificacao')}
                        className={errorsEdit.horario_verificacao ? 'border-red-500' : ''}
                      />
                      {errorsEdit.horario_verificacao && (
                        <p className="text-red-600 text-sm mt-1">{errorsEdit.horario_verificacao.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t flex gap-2">
                    <Button type="submit" className="w-full md:w-auto">
                      Salvar Alterações
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setAlertaEditando(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {!isLoading && showForm && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Criar Novo Alerta</CardTitle>
                <CardDescription>
                  O alerta será configurado automaticamente com base no perfil da sua empresa (setores, estados de interesse, CNAEs). 
                  Ele verificará novas licitações diariamente no horário especificado e enviará um resumo via webhook.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Campos Simplificados */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome_alerta">Nome do Alerta *</Label>
                      <Input
                        id="nome_alerta"
                        {...register('nome_alerta')}
                        placeholder="Ex: Alertas Diários"
                        className={errors.nome_alerta ? 'border-red-500' : ''}
                      />
                      {errors.nome_alerta && (
                        <p className="text-red-600 text-sm mt-1">{errors.nome_alerta.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="horario_verificacao">Horário de Verificação *</Label>
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
                        Horário em que o sistema verificará novas licitações diariamente
                        </p>
                      </div>
                  </div>

                  {/* Informação sobre filtros automáticos */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Filter className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 mb-1">
                          Filtros Automáticos
                        </p>
                        <p className="text-xs text-blue-700">
                          Este alerta usará automaticamente os filtros do seu perfil:
                        </p>
                        <ul className="text-xs text-blue-700 mt-2 list-disc list-inside space-y-1">
                          <li>Estados de interesse da sua empresa</li>
                          <li>Setores de atividade (CNAEs)</li>
                          <li>CNAE principal e secundários</li>
                        </ul>
                        <p className="text-xs text-blue-600 mt-2 italic">
                          Atualize seu perfil na página de Perfil para ajustar os filtros.
                        </p>
                      </div>
                    </div>
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
                            <div className="space-y-1 text-sm">
                            <p><strong>Email:</strong> {alerta.email_notificacao}</p>
                              <p><strong>Frequência:</strong> Diário (automático)</p>
                            {alerta.horario_verificacao && (
                                <p className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <strong>Horário:</strong> {alerta.horario_verificacao.slice(0, 5)}
                                </p>
                            )}
                            {alerta.ultima_verificacao && (
                              <p><strong>Última verificação:</strong> {new Date(alerta.ultima_verificacao).toLocaleString('pt-BR')}</p>
                            )}
                            <p><strong>Status:</strong> {alerta.ativo ? 'Ativo' : 'Inativo'}</p>
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs text-gray-600">
                                  <strong>Filtros automáticos:</strong> Usa estados de interesse, setores e CNAEs do seu perfil
                                </p>
                              </div>
                            </div>
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAlertaEditando(alerta)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
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

