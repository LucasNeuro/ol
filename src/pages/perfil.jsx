import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Building2, MapPin, Phone, FileText, Edit2, Save, X, Key } from 'lucide-react'

function PerfilContent() {
  const { user } = useAuth()
  const [editMode, setEditMode] = useState(false)
  const [changePassword, setChangePassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    telefone: user?.telefone || '',
    complemento: user?.complemento || '',
    senha_atual: '',
    senha_nova: '',
    confirmar_senha: '',
  })

  if (!user) return null

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

      setSuccess('Dados atualizados com sucesso!')
      setEditMode(false)
      
      // Recarregar dados do usuário
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setError(err.message || 'Erro ao atualizar dados')
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

