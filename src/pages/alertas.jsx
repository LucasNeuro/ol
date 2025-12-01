import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Trash2 } from 'lucide-react'

const alertaSchema = z.object({
  nome_alerta: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email_notificacao: z.string().email('Email inválido'),
  frequencia: z.enum(['diario', 'semanal', 'imediato']),
  filtros: z.object({
    modalidade: z.string().optional(),
    uf: z.string().optional(),
    valorMinimo: z.string().optional(),
  }),
})

function AlertasContent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
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
      
      const { data, error } = await supabase
        .from('alertas_usuario')
        .insert({
          usuario_id: user.id,
          ...novoAlerta,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas', user?.id])
      setShowForm(false)
    },
  })

  const { mutate: deletarAlerta } = useMutation({
    mutationFn: async (alertaId) => {
      if (!supabase) throw new Error('Supabase não configurado')
      
      const { error } = await supabase
        .from('alertas_usuario')
        .delete()
        .eq('id', alertaId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas', user?.id])
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
    reset()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-12 px-6">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando alertas...</p>
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
                Alertas
              </h1>
              <p className="text-gray-600">
                Configure alertas por email para novas licitações
              </p>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancelar' : 'Novo Alerta'}
            </Button>
          </div>

          {showForm && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Criar Novo Alerta</CardTitle>
                <CardDescription>
                  Configure critérios para receber notificações por email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <Label htmlFor="nome_alerta">Nome do Alerta</Label>
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

                  <div>
                    <Label htmlFor="email_notificacao">Email para Notificações</Label>
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

                  <div>
                    <Label htmlFor="frequencia">Frequência</Label>
                    <Select
                      value={watch('frequencia')}
                      onValueChange={(value) => setValue('frequencia', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imediato">Imediato</SelectItem>
                        <SelectItem value="diario">Diário</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label>Filtros (Opcional)</Label>
                    
                    <div>
                      <Label htmlFor="modalidade">Modalidade</Label>
                      <Input
                        id="modalidade"
                        {...register('filtros.modalidade')}
                        placeholder="Ex: Pregão Eletrônico"
                      />
                    </div>

                    <div>
                      <Label htmlFor="uf">Estado (UF)</Label>
                      <Input
                        id="uf"
                        {...register('filtros.uf')}
                        placeholder="Ex: SP"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Criar Alerta
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

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
                          onClick={() => deletarAlerta(alerta.id)}
                        >
                          <Trash2 className="w-4 h-4" />
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
        </div>
      </main>

      <Footer />
    </div>
  )
}

export function AlertasPage() {
  return (
    <ProtectedRoute>
      <AlertasContent />
    </ProtectedRoute>
  )
}

