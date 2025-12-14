import { useState, useEffect } from 'react'
import { useLocation } from 'wouter'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useUserStore } from '@/store/userStore'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Edit,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNotifications } from '@/hooks/useNotifications'

function AdminUsuariosContent() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()
  const { success, error: showError } = useNotifications()
  
  // Verificar se é admin
  const [location, setLocation] = useLocation()
  useEffect(() => {
    if (user && !user.is_adm) {
      // Redirecionar usuários não-admin para licitações
      setLocation('/licitacoes')
    }
  }, [user, setLocation])

  const [busca, setBusca] = useState('')
  const [filtroPlano, setFiltroPlano] = useState('TODOS')
  const [filtroAtivo, setFiltroAtivo] = useState('TODOS')
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(false)

  // Buscar planos da tabela
  const { data: planos = [] } = useQuery({
    queryKey: ['planos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })

      if (error) throw error
      return data || []
    }
  })

  // Criar mapa de planos para busca rápida
  const mapaPlanos = planos.reduce((acc, plano) => {
    acc[plano.codigo] = plano
    return acc
  }, {})

  // Buscar todos os usuários
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['admin-usuarios', busca, filtroPlano, filtroAtivo],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      // Filtro de busca
      if (busca) {
        query = query.or(`razao_social.ilike.%${busca}%,email.ilike.%${busca}%,cnpj.ilike.%${busca}%`)
      }

      // Filtro de plano
      if (filtroPlano !== 'TODOS') {
        query = query.eq('plano', filtroPlano.toLowerCase())
      }

      // Filtro de ativo
      if (filtroAtivo !== 'TODOS') {
        query = query.eq('ativo', filtroAtivo === 'ATIVO')
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
    enabled: !!user?.is_adm
  })

  // Toggle ativo/inativo
  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: !ativo, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-usuarios'])
      success('Status do usuário atualizado com sucesso')
    },
    onError: (err) => {
      showError('Erro ao atualizar status do usuário')
    }
  })

  // Atualizar usuário
  const atualizarUsuario = useMutation({
    mutationFn: async (dados) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...dados,
          updated_at: new Date().toISOString()
        })
        .eq('id', dados.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-usuarios'])
      success('Usuário atualizado com sucesso')
      setModalAberto(false)
      setUsuarioSelecionado(null)
      setEditando(false)
    },
    onError: (err) => {
      showError('Erro ao atualizar usuário')
    }
  })

  const handleEditar = (usuario) => {
    setUsuarioSelecionado(usuario)
    setEditando(true)
    setModalAberto(true)
  }

  const handleVisualizar = (usuario) => {
    setUsuarioSelecionado(usuario)
    setEditando(false)
    setModalAberto(true)
  }

  const formatarValor = (valor) => {
    if (!valor) return 'Não informado'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  // Calcular receita mensal total
  const receitaMensal = usuarios.reduce((total, usuario) => {
    const plano = mapaPlanos[usuario.plano]
    if (plano && plano.preco_mensal) {
      return total + parseFloat(plano.preco_mensal)
    }
    return total
  }, 0)

  const formatarData = (data) => {
    if (!data) return 'Não informada'
    return format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  }

  if (!user?.is_adm) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Acesso negado. Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-orange-500" />
              Gerenciamento de Usuários
            </h1>
            <p className="text-gray-600 mt-2">
              Gerencie todos os cadastros da plataforma
            </p>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total de Usuários</p>
                  <p className="text-2xl font-bold text-gray-900">{usuarios.length}</p>
                </div>
                <Users className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Usuários Ativos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {usuarios.filter(u => u.ativo).length}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Usuários Inativos</p>
                  <p className="text-2xl font-bold text-red-600">
                    {usuarios.filter(u => !u.ativo).length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Receita Mensal</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatarValor(receitaMensal)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {usuarios.filter(u => u.plano === 'enterprise').length} Enterprise
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por nome, email ou CNPJ..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filtroPlano} onValueChange={setFiltroPlano}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os Planos</SelectItem>
                  {planos.map((plano) => (
                    <SelectItem key={plano.id} value={plano.codigo}>
                      {plano.nome} {plano.preco_mensal > 0 && `(${formatarValor(plano.preco_mensal)})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="ATIVO">Ativos</SelectItem>
                  <SelectItem value="INATIVO">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : usuarios.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Nenhum usuário encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cadastrado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuarios.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">
                              {usuario.razao_social || usuario.nome_fantasia || 'Não informado'}
                            </p>
                            {usuario.nome_fantasia && usuario.razao_social && (
                              <p className="text-sm text-gray-500">{usuario.nome_fantasia}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{usuario.email || 'Não informado'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">{usuario.cnpj || 'Não informado'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={
                                usuario.plano === 'enterprise' ? 'default' :
                                usuario.plano === 'pro' ? 'secondary' : 'outline'
                              }
                              className={
                                usuario.plano === 'enterprise' ? 'bg-purple-500' :
                                usuario.plano === 'pro' ? 'bg-blue-500' : ''
                              }
                            >
                              {mapaPlanos[usuario.plano]?.nome || usuario.plano?.toUpperCase() || 'FREE'}
                            </Badge>
                            {mapaPlanos[usuario.plano]?.preco_mensal && (
                              <span className="text-xs text-gray-600">
                                {formatarValor(mapaPlanos[usuario.plano].preco_mensal)}/mês
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{usuario.uf || 'Não informado'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={usuario.ativo}
                              onCheckedChange={() => {
                                toggleAtivo.mutate({ id: usuario.id, ativo: usuario.ativo })
                              }}
                              disabled={toggleAtivo.isLoading}
                            />
                            <Badge variant={usuario.ativo ? 'default' : 'secondary'}>
                              {usuario.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {formatarData(usuario.created_at)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVisualizar(usuario)}
                              title="Visualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditar(usuario)}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Detalhes/Edição */}
        {usuarioSelecionado && (
          <Dialog open={modalAberto} onOpenChange={setModalAberto}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editando ? 'Editar Usuário' : 'Detalhes do Usuário'}
                </DialogTitle>
                <DialogDescription>
                  {editando
                    ? 'Edite as informações do usuário'
                    : 'Visualize todas as informações do cadastro'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Informações Básicas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Razão Social</Label>
                    {editando ? (
                      <Input
                        value={usuarioSelecionado.razao_social || ''}
                        onChange={(e) => setUsuarioSelecionado({
                          ...usuarioSelecionado,
                          razao_social: e.target.value
                        })}
                      />
                    ) : (
                      <p className="text-sm text-gray-900 mt-1">
                        {usuarioSelecionado.razao_social || 'Não informado'}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Nome Fantasia</Label>
                    {editando ? (
                      <Input
                        value={usuarioSelecionado.nome_fantasia || ''}
                        onChange={(e) => setUsuarioSelecionado({
                          ...usuarioSelecionado,
                          nome_fantasia: e.target.value
                        })}
                      />
                    ) : (
                      <p className="text-sm text-gray-900 mt-1">
                        {usuarioSelecionado.nome_fantasia || 'Não informado'}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p className="text-sm text-gray-900 mt-1">{usuarioSelecionado.email || 'Não informado'}</p>
                  </div>
                  <div>
                    <Label>CNPJ</Label>
                    <p className="text-sm text-gray-900 mt-1 font-mono">
                      {usuarioSelecionado.cnpj || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <Label>Plano</Label>
                    {editando ? (
                      <Select
                        value={usuarioSelecionado.plano || 'free'}
                        onValueChange={(value) => setUsuarioSelecionado({
                          ...usuarioSelecionado,
                          plano: value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {planos.map((plano) => (
                            <SelectItem key={plano.id} value={plano.codigo}>
                              {plano.nome} - {formatarValor(plano.preco_mensal)}/mês
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        <Badge>
                          {mapaPlanos[usuarioSelecionado.plano]?.nome || (usuarioSelecionado.plano || 'free').toUpperCase()}
                        </Badge>
                        {mapaPlanos[usuarioSelecionado.plano]?.preco_mensal && (
                          <p className="text-sm text-gray-600 mt-1">
                            {formatarValor(mapaPlanos[usuarioSelecionado.plano].preco_mensal)}/mês
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Switch
                        checked={usuarioSelecionado.ativo}
                        onCheckedChange={(checked) => setUsuarioSelecionado({
                          ...usuarioSelecionado,
                          ativo: checked
                        })}
                        disabled={!editando}
                      />
                      <Badge variant={usuarioSelecionado.ativo ? 'default' : 'secondary'}>
                        {usuarioSelecionado.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Endereço
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Logradouro</Label>
                      {editando ? (
                        <Input
                          value={usuarioSelecionado.logradouro || ''}
                          onChange={(e) => setUsuarioSelecionado({
                            ...usuarioSelecionado,
                            logradouro: e.target.value
                          })}
                        />
                      ) : (
                        <p className="text-sm text-gray-900 mt-1">
                          {usuarioSelecionado.logradouro || 'Não informado'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Número</Label>
                      {editando ? (
                        <Input
                          value={usuarioSelecionado.numero || ''}
                          onChange={(e) => setUsuarioSelecionado({
                            ...usuarioSelecionado,
                            numero: e.target.value
                          })}
                        />
                      ) : (
                        <p className="text-sm text-gray-900 mt-1">
                          {usuarioSelecionado.numero || 'Não informado'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      {editando ? (
                        <Input
                          value={usuarioSelecionado.bairro || ''}
                          onChange={(e) => setUsuarioSelecionado({
                            ...usuarioSelecionado,
                            bairro: e.target.value
                          })}
                        />
                      ) : (
                        <p className="text-sm text-gray-900 mt-1">
                          {usuarioSelecionado.bairro || 'Não informado'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>CEP</Label>
                      {editando ? (
                        <Input
                          value={usuarioSelecionado.cep || ''}
                          onChange={(e) => setUsuarioSelecionado({
                            ...usuarioSelecionado,
                            cep: e.target.value
                          })}
                        />
                      ) : (
                        <p className="text-sm text-gray-900 mt-1">
                          {usuarioSelecionado.cep || 'Não informado'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Município</Label>
                      {editando ? (
                        <Input
                          value={usuarioSelecionado.municipio || ''}
                          onChange={(e) => setUsuarioSelecionado({
                            ...usuarioSelecionado,
                            municipio: e.target.value
                          })}
                        />
                      ) : (
                        <p className="text-sm text-gray-900 mt-1">
                          {usuarioSelecionado.municipio || 'Não informado'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>UF</Label>
                      {editando ? (
                        <Input
                          value={usuarioSelecionado.uf || ''}
                          onChange={(e) => setUsuarioSelecionado({
                            ...usuarioSelecionado,
                            uf: e.target.value
                          })}
                        />
                      ) : (
                        <p className="text-sm text-gray-900 mt-1">
                          {usuarioSelecionado.uf || 'Não informado'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Informações Adicionais */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Informações da Empresa
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Telefone</Label>
                      {editando ? (
                        <Input
                          value={usuarioSelecionado.telefone || ''}
                          onChange={(e) => setUsuarioSelecionado({
                            ...usuarioSelecionado,
                            telefone: e.target.value
                          })}
                        />
                      ) : (
                        <p className="text-sm text-gray-900 mt-1">
                          {usuarioSelecionado.telefone || 'Não informado'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Capital Social</Label>
                      {editando ? (
                        <Input
                          type="number"
                          value={usuarioSelecionado.capital_social || ''}
                          onChange={(e) => setUsuarioSelecionado({
                            ...usuarioSelecionado,
                            capital_social: parseFloat(e.target.value) || 0
                          })}
                        />
                      ) : (
                        <p className="text-sm text-gray-900 mt-1">
                          {formatarValor(usuarioSelecionado.capital_social)}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Cadastrado em</Label>
                      <p className="text-sm text-gray-900 mt-1">
                        {formatarData(usuarioSelecionado.created_at)}
                      </p>
                    </div>
                    <div>
                      <Label>Último Login</Label>
                      <p className="text-sm text-gray-900 mt-1">
                        {formatarData(usuarioSelecionado.ultimo_login)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                {editando && (
                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setModalAberto(false)
                        setUsuarioSelecionado(null)
                        setEditando(false)
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        atualizarUsuario.mutate(usuarioSelecionado)
                      }}
                      disabled={atualizarUsuario.isLoading}
                    >
                      {atualizarUsuario.isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Alterações'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  )
}

export function AdminUsuariosPage() {
  return (
    <ProtectedRoute>
      <AdminUsuariosContent />
    </ProtectedRoute>
  )
}

