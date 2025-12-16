import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { supabase } from '@/lib/supabase'
import { Building2, MapPin, Phone, FileText, Edit2, Save, X, Key, Settings, Plus, CheckCircle2 } from 'lucide-react'
import { SelecionarSetores } from '@/components/SelecionarSetores'
import { SelecionarEstados } from '@/components/SelecionarEstados'
import { useUserStore } from '@/store/userStore'

function PerfilContent() {
  const { user: userAuth } = useAuth()
  const { setUser } = useUserStore()
  const queryClient = useQueryClient()
  const { success: showSuccess, error: showError } = useNotifications()
  const [editMode, setEditMode] = useState(false)
  const [changePassword, setChangePassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Estados para configuração de setores e estados
  const [setoresSelecionados, setSetoresSelecionados] = useState([])
  const [estadosSelecionados, setEstadosSelecionados] = useState([])
  const [modalSetoresAberto, setModalSetoresAberto] = useState(false)
  const [modalEstadosAberto, setModalEstadosAberto] = useState(false)
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  // Buscar TODOS os dados do perfil do banco
  const { data: perfilCompleto, isLoading: loadingPerfil } = useQuery({
    queryKey: ['perfil-completo', userAuth?.id],
    queryFn: async () => {
      if (!userAuth?.id) return null
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userAuth.id)
        .maybeSingle()
      
      if (error) {
        console.error('❌ Erro ao buscar perfil completo:', error)
        throw error
      }
      
      return data
    },
    enabled: !!userAuth?.id,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  })

  // Usar perfil completo se disponível, senão usar userAuth
  const user = perfilCompleto || userAuth
  
  const [formData, setFormData] = useState({
    telefone: '',
    complemento: '',
    senha_atual: '',
    senha_nova: '',
    confirmar_senha: '',
  })

  // Atualizar formData quando o perfil for carregado
  useEffect(() => {
    if (user) {
      setFormData({
        telefone: user.telefone || '',
        complemento: user.complemento || '',
        senha_atual: '',
        senha_nova: '',
        confirmar_senha: '',
      })
      
      // Carregar setores e estados
      const setores = user.setores_atividades || []
      const estados = user.estados_interesse || []
      setSetoresSelecionados(setores)
      setEstadosSelecionados(estados)
    }
  }, [user])

  if (!userAuth) return null
  
  if (loadingPerfil) {
    return (
      <AppLayout>
        <div className="py-12 px-6">
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando perfil...</p>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }
  
  if (!user) {
    return (
      <AppLayout>
        <div className="py-12 px-6">
          <div className="container mx-auto max-w-7xl">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-red-700">Erro ao carregar dados do perfil. Por favor, recarregue a página.</p>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // Atualizar dados básicos
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          telefone: formData.telefone,
          complemento: formData.complemento,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Se tiver mudança de senha
      if (changePassword && formData.senha_nova) {
        if (formData.senha_nova !== formData.confirmar_senha) {
          throw new Error('As senhas não coincidem')
        }
        if (formData.senha_nova.length < 6) {
          throw new Error('A nova senha deve ter no mínimo 6 caracteres')
        }

        // Hash da nova senha
        const encoder = new TextEncoder()
        const hashData = encoder.encode(formData.senha_nova)
        const hashBuffer = await crypto.subtle.digest('SHA-256', hashData)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        // Atualizar senha
        await supabase
          .from('profiles')
          .update({ password_hash: passwordHash })
          .eq('id', user.id)

        setChangePassword(false)
        setFormData({ ...formData, senha_atual: '', senha_nova: '', confirmar_senha: '' })
      }

      // Atualizar o store do usuário
      const { password_hash, ...userData } = data
      setUser(userData)

      // Invalidar queries para atualizar em tempo real
      queryClient.invalidateQueries(['perfil-completo', user.id])
      queryClient.invalidateQueries(['perfil-usuario', user.id])

      showSuccess('Dados atualizados com sucesso!')
      setSuccess('Dados atualizados com sucesso!')
      setEditMode(false)
    } catch (err) {
      const errorMsg = err.message || 'Erro ao atualizar dados'
      setError(errorMsg)
      showError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditMode(false)
    setChangePassword(false)
    setFormData({
      telefone: user?.telefone || '',
      complemento: user?.complemento || '',
      senha_atual: '',
      senha_nova: '',
      confirmar_senha: '',
    })
    setError('')
    setSuccess('')
  }

  // Salvar configuração de setores e estados
  const handleSalvarConfiguracao = async () => {
    if (!user?.id) return

    setSalvandoConfig(true)
    setError('')
    setSuccess('')

    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          setores_atividades: setoresSelecionados.length > 0 ? setoresSelecionados : null,
          estados_interesse: estadosSelecionados.length > 0 ? estadosSelecionados : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Atualizar o store do usuário
      const { password_hash, ...userData } = data
      setUser(userData)

      // Invalidar queries para atualizar em tempo real
      queryClient.invalidateQueries(['perfil-completo', user.id])
      queryClient.invalidateQueries(['perfil-usuario', user.id])
      queryClient.invalidateQueries(['licitacoes']) // Recarregar licitações com novos filtros

      // Mostrar notificação de sucesso
      showSuccess('Configuração salva com sucesso! As licitações serão filtradas automaticamente.')
      
      setModalSetoresAberto(false)
      setModalEstadosAberto(false)
      
      // Atualizar estado local imediatamente (sem recarregar página)
      setSetoresSelecionados(setoresSelecionados)
      setEstadosSelecionados(estadosSelecionados)
    } catch (err) {
      const errorMsg = err.message || 'Erro ao salvar configuração'
      setError(errorMsg)
      showError(errorMsg)
    } finally {
      setSalvandoConfig(false)
    }
  }

  return (
    <AppLayout>
      <div className="py-12 px-6">
        <div className="container mx-auto max-w-7xl">
          {/* Cabeçalho do Perfil */}
          <div className="mb-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold shadow-lg">
                  {user.razao_social?.substring(0, 2).toUpperCase() || 'U'}
                </div>
                <div>
                  <h1 className="text-3xl font-bold mb-2">{user.razao_social || 'Empresa'}</h1>
                  <p className="text-orange-100 text-lg">{user.email}</p>
                  {user.nome_fantasia && (
                    <p className="text-orange-100 text-sm mt-1">Nome Fantasia: {user.nome_fantasia}</p>
                  )}
                </div>
              </div>
              
              {/* Botões de ação */}
              <div className="flex gap-3">
                {!editMode ? (
                  <Button
                    onClick={() => setEditMode(true)}
                    className="bg-white text-orange-600 hover:bg-orange-50"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Editar Perfil
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleSave}
                      disabled={loading}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      className="bg-white border-white text-orange-600 hover:bg-orange-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mensagens de erro/sucesso */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded text-green-700">
              {success}
            </div>
          )}

          {/* Grid de Informações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card: Dados da Empresa */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-orange-500" />
                  Dados da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {user.cnpj && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">CNPJ</label>
                      <p className="text-base text-gray-900 font-mono">{user.cnpj}</p>
                    </div>
                  )}
                  {user.razao_social && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Razão Social</label>
                      <p className="text-base text-gray-900">{user.razao_social}</p>
                    </div>
                  )}
                  {user.nome_fantasia && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Nome Fantasia</label>
                      <p className="text-base text-gray-900">{user.nome_fantasia}</p>
                    </div>
                  )}
                  {user.situacao_cadastral && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Situação Cadastral</label>
                      <p className="text-base text-gray-900">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          user.situacao_cadastral === 'Ativa' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.situacao_cadastral}
                        </span>
                      </p>
                    </div>
                  )}
                  {user.porte_empresa && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Porte da Empresa</label>
                      <p className="text-base text-gray-900">{user.porte_empresa}</p>
                    </div>
                  )}
                  {user.natureza_juridica && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Natureza Jurídica</label>
                      <p className="text-base text-gray-900">{user.natureza_juridica}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card: Endereço */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-500" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {user.cep && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">CEP</label>
                      <p className="text-base text-gray-900">{user.cep}</p>
                    </div>
                  )}
                  {user.logradouro && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Logradouro</label>
                      <p className="text-base text-gray-900">
                        {user.logradouro}{user.numero && `, ${user.numero}`}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs font-medium text-gray-500 uppercase">Complemento</Label>
                    {editMode ? (
                      <Input
                        value={formData.complemento}
                        onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                        placeholder="Sala, andar, etc"
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-base text-gray-900 mt-1">{user.complemento || 'Não informado'}</p>
                    )}
                  </div>
                  {user.bairro && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Bairro</label>
                      <p className="text-base text-gray-900">{user.bairro}</p>
                    </div>
                  )}
                  {user.municipio && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Cidade/UF</label>
                      <p className="text-base text-gray-900">{user.municipio} - {user.uf}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card: Contato (Editável) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-orange-500" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {user.email && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500 uppercase">Email</Label>
                      <p className="text-base text-gray-900 mt-1">{user.email}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs font-medium text-gray-500 uppercase">Telefone</Label>
                    {editMode ? (
                      <Input
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        placeholder="(11) 99999-9999"
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-base text-gray-900 mt-1">{user.telefone || 'Não informado'}</p>
                    )}
                  </div>
                  {user.cargo && (
                    <div>
                      <Label className="text-xs font-medium text-gray-500 uppercase">Seu Cargo</Label>
                      <p className="text-base text-gray-900 mt-1">{user.cargo}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card: Informações Adicionais */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" />
                  Informações Adicionais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {user.cnae_principal && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">CNAE Principal</label>
                      <p className="text-base text-gray-900 font-mono">{user.cnae_principal}</p>
                    </div>
                  )}
                  {user.data_inicio_atividade && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Data de Início</label>
                      <p className="text-base text-gray-900">{new Date(user.data_inicio_atividade).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                  {user.capital_social && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Capital Social</label>
                      <p className="text-base text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(user.capital_social)}
                      </p>
                    </div>
                  )}
                  {user.opcao_simples && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Optante Simples Nacional</label>
                      <p className="text-base text-gray-900">{user.opcao_simples === 'S' ? 'Sim' : 'Não'}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card: Configuração do Serviço */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-orange-500" />
                  Configuração do Serviço
                </CardTitle>
                <p className="text-sm text-gray-500 mt-2">
                  Configure seus setores de atuação e estados de interesse para receber apenas licitações relevantes
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Setores/Atividades */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Atividades de Interesse
                    </Label>
                    <div className="flex items-start gap-3">
                      <Button
                        onClick={() => setModalSetoresAberto(true)}
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {setoresSelecionados.length > 0 ? 'Editar Atividades' : 'Selecionar Atividades'}
                      </Button>
                      {setoresSelecionados.length > 0 && (
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-2">
                            {setoresSelecionados.length} setor(es) selecionado(s)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {setoresSelecionados.map((item, idx) => (
                              <Badge 
                                key={idx} 
                                variant="secondary" 
                                className="bg-orange-100 text-orange-800 flex items-center gap-2 pr-2"
                              >
                                <span>{item.setor} ({item.subsetores?.length || 0} atividades)</span>
                                <button
                                  onClick={async () => {
                                    const novosSetores = setoresSelecionados.filter((_, i) => i !== idx)
                                    setSetoresSelecionados(novosSetores)
                                    
                                    // Salvar automaticamente
                                    if (user?.id) {
                                      try {
                                        const { error } = await supabase
                                          .from('profiles')
                                          .update({
                                            setores_atividades: novosSetores.length > 0 ? novosSetores : null,
                                            updated_at: new Date().toISOString(),
                                          })
                                          .eq('id', user.id)

                                        if (error) throw error

                                        queryClient.invalidateQueries(['perfil-usuario', user.id])
                                        queryClient.invalidateQueries(['licitacoes'])
                                        
                                        const { data: perfilAtualizado } = await supabase
                                          .from('profiles')
                                          .select('*')
                                          .eq('id', user.id)
                                          .single()
                                        
                                        if (perfilAtualizado) {
                                          const { password_hash, ...userData } = perfilAtualizado
                                          setUser(userData)
                                        }

                                        showSuccess('Setor removido!')
                                      } catch (err) {
                                        showError('Erro ao remover setor')
                                      }
                                    }
                                  }}
                                  className="ml-1 hover:bg-orange-200 rounded-full p-0.5"
                                  title="Remover setor"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Estados */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Estados de Interesse
                    </Label>
                    <div className="flex items-start gap-3">
                      <Button
                        onClick={() => setModalEstadosAberto(true)}
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {estadosSelecionados.length > 0 ? 'Editar Estados' : 'Selecionar Estados'}
                      </Button>
                      {estadosSelecionados.length > 0 && (
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-2">
                            {estadosSelecionados.length} estado(s) selecionado(s)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {estadosSelecionados.map((estado, idx) => (
                              <Badge 
                                key={idx} 
                                variant="secondary" 
                                className="bg-blue-100 text-blue-800 flex items-center gap-2 pr-2"
                              >
                                <span>{estado}</span>
                                <button
                                  onClick={async () => {
                                    const novosEstados = estadosSelecionados.filter((_, i) => i !== idx)
                                    setEstadosSelecionados(novosEstados)
                                    
                                    // Salvar automaticamente
                                    if (user?.id) {
                                      try {
                                        const { error } = await supabase
                                          .from('profiles')
                                          .update({
                                            estados_interesse: novosEstados.length > 0 ? novosEstados : null,
                                            updated_at: new Date().toISOString(),
                                          })
                                          .eq('id', user.id)

                                        if (error) throw error

                                        queryClient.invalidateQueries(['perfil-usuario', user.id])
                                        queryClient.invalidateQueries(['licitacoes'])
                                        
                                        const { data: perfilAtualizado } = await supabase
                                          .from('profiles')
                                          .select('*')
                                          .eq('id', user.id)
                                          .single()
                                        
                                        if (perfilAtualizado) {
                                          const { password_hash, ...userData } = perfilAtualizado
                                          setUser(userData)
                                        }

                                        showSuccess('Estado removido!')
                                      } catch (err) {
                                        showError('Erro ao remover estado')
                                      }
                                    }
                                  }}
                                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                                  title="Remover estado"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Informação sobre salvamento automático */}
                  {(setoresSelecionados.length > 0 || estadosSelecionados.length > 0) && (
                    <div className="pt-4 border-t">
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        As alterações são salvas automaticamente. As licitações serão filtradas em tempo real.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card: Trocar Senha (quando em modo de edição) */}
            {editMode && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-orange-500" />
                    Segurança
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!changePassword ? (
                    <Button
                      onClick={() => setChangePassword(true)}
                      variant="outline"
                      className="w-full border-2 border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Alterar Senha
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Nova Senha *</Label>
                        <PasswordInput
                          value={formData.senha_nova}
                          onChange={(e) => setFormData({ ...formData, senha_nova: e.target.value })}
                          placeholder="Mínimo 6 caracteres"
                          className="mt-1 h-11"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Confirmar Nova Senha *</Label>
                        <PasswordInput
                          value={formData.confirmar_senha}
                          onChange={(e) => setFormData({ ...formData, confirmar_senha: e.target.value })}
                          placeholder="Digite a senha novamente"
                          className="mt-1 h-11"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          setChangePassword(false)
                          setFormData({ ...formData, senha_nova: '', confirmar_senha: '' })
                        }}
                        variant="ghost"
                        className="text-sm text-gray-600"
                      >
                        Cancelar alteração de senha
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modais para seleção */}
      <SelecionarSetores
        open={modalSetoresAberto}
        onOpenChange={setModalSetoresAberto}
        setoresSelecionados={setoresSelecionados}
        onConfirm={async (setores) => {
          setSetoresSelecionados(setores)
          setModalSetoresAberto(false)
          
          // Salvar automaticamente
          if (user?.id) {
            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  setores_atividades: setores.length > 0 ? setores : null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', user.id)

              if (updateError) throw updateError

              // Invalidar queries para atualizar em tempo real
              queryClient.invalidateQueries(['perfil-usuario', user.id])
              queryClient.invalidateQueries(['licitacoes'])
              
              // Atualizar store do usuário
              const { data: perfilAtualizado } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
              
              if (perfilAtualizado) {
                const { password_hash, ...userData } = perfilAtualizado
                setUser(userData)
              }

              showSuccess('Setores atualizados! As licitações serão filtradas automaticamente.')
            } catch (err) {
              showError('Erro ao salvar setores: ' + (err.message || 'Erro desconhecido'))
            }
          }
        }}
      />

      <SelecionarEstados
        open={modalEstadosAberto}
        onOpenChange={setModalEstadosAberto}
        estadosSelecionados={estadosSelecionados}
        onConfirm={async (estados) => {
          setEstadosSelecionados(estados)
          setModalEstadosAberto(false)
          
          // Salvar automaticamente
          if (user?.id) {
            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  estados_interesse: estados.length > 0 ? estados : null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', user.id)

              if (updateError) throw updateError

              // Invalidar queries para atualizar em tempo real
              queryClient.invalidateQueries(['perfil-usuario', user.id])
              queryClient.invalidateQueries(['licitacoes'])
              
              // Atualizar store do usuário
              const { data: perfilAtualizado } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
              
              if (perfilAtualizado) {
                const { password_hash, ...userData } = perfilAtualizado
                setUser(userData)
              }

              showSuccess('Estados atualizados! As licitações serão filtradas automaticamente.')
            } catch (err) {
              showError('Erro ao salvar estados: ' + (err.message || 'Erro desconhecido'))
            }
          }
        }}
      />
    </AppLayout>
  )
}

export function PerfilPage() {
  return (
    <ProtectedRoute>
      <PerfilContent />
    </ProtectedRoute>
  )
}

