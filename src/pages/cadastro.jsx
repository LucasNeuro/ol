import { useState } from 'react'
import { useLocation, Link } from 'wouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { useAuth } from '@/hooks/useAuth'
import { validarCNPJ, formatarCNPJ } from '@/lib/utils'
import { Search, Building2, Loader2, CheckCircle } from 'lucide-react'

const cadastroSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
  cnpj: z.string().refine((val) => validarCNPJ(val), {
    message: 'CNPJ inválido',
  }),
  razaoSocial: z.string().min(3, 'Razão social deve ter no mínimo 3 caracteres'),
  nomeFantasia: z.string().optional(),
  cargo: z.enum(['Gerente', 'Dono', 'Independente'], {
    required_error: 'Selecione um cargo',
  }),
  // Campos de endereço
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().optional(),
  telefone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

/**
 * Buscar dados da empresa pela API OpenCNPJ
 */
async function buscarDadosCNPJ(cnpj) {
  try {
    const cnpjLimpo = cnpj.replace(/\D/g, '')
    const response = await fetch(`https://api.opencnpj.org/${cnpjLimpo}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('CNPJ não encontrado na base de dados')
      }
      throw new Error('Erro ao buscar dados do CNPJ')
    }
    
    const dados = await response.json()
    return dados
  } catch (error) {
    throw error
  }
}

/**
 * Buscar endereço pela API ViaCEP
 */
async function buscarEnderecoCEP(cep) {
  try {
    const cepLimpo = cep.replace(/\D/g, '')
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
    
    if (!response.ok) {
      throw new Error('Erro ao buscar CEP')
    }
    
    const dados = await response.json()
    
    if (dados.erro) {
      throw new Error('CEP não encontrado')
    }
    
    return dados
  } catch (error) {
    throw error
  }
}

export function CadastroPage() {
  const [, setLocation] = useLocation()
  const { signUp, user } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cnpjValue, setCnpjValue] = useState('')
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [dadosEmpresa, setDadosEmpresa] = useState(null)
  const [cnpjEncontrado, setCnpjEncontrado] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(cadastroSchema),
  })

  const cargo = watch('cargo')

  // Redirecionar se já estiver logado
  if (user) {
    setLocation('/dashboard')
    return null
  }

  const handleCnpjChange = async (e) => {
    const value = e.target.value.replace(/\D/g, '')
    setCnpjValue(value)
    setValue('cnpj', value, { shouldValidate: true })
    
    // Resetar estados quando CNPJ mudar
    setCnpjEncontrado(false)
    setDadosEmpresa(null)

    // Buscar automaticamente quando digitar 14 dígitos
    if (value.length === 14 && validarCNPJ(value)) {
      setError('')
      setBuscandoCNPJ(true)

      try {
        console.log('🔍 Buscando dados do CNPJ automaticamente:', value)
        const dados = await buscarDadosCNPJ(value)
        console.log('✅ Dados encontrados:', dados)
        
        setDadosEmpresa(dados)
        setCnpjEncontrado(true)

        // Preencher campos automaticamente
        setValue('razaoSocial', dados.razao_social || '')
        setValue('nomeFantasia', dados.nome_fantasia || '')
        setValue('cep', dados.cep || '')
        setValue('logradouro', dados.logradouro || '')
        setValue('numero', dados.numero || '')
        setValue('complemento', dados.complemento || '')
        setValue('bairro', dados.bairro || '')
        setValue('municipio', dados.municipio || '')
        setValue('uf', dados.uf || '')
        setValue('telefone', dados.telefones?.[0] ? `(${dados.telefones[0].ddd}) ${dados.telefones[0].numero}` : '')

      } catch (err) {
        console.error('❌ Erro ao buscar CNPJ:', err)
        setError(err.message || 'Erro ao buscar dados do CNPJ.')
        setCnpjEncontrado(false)
        setDadosEmpresa(null)
      } finally {
        setBuscandoCNPJ(false)
      }
    }
  }

  const handleCepBlur = async (e) => {
    const cep = e.target.value.replace(/\D/g, '')
    
    if (cep.length === 8) {
      try {
        console.log('🔍 Buscando endereço do CEP:', cep)
        const endereco = await buscarEnderecoCEP(cep)
        console.log('✅ Endereço encontrado:', endereco)
        
        // Preencher campos de endereço
        setValue('logradouro', endereco.logradouro || '')
        setValue('bairro', endereco.bairro || '')
        setValue('municipio', endereco.localidade || '')
        setValue('uf', endereco.uf || '')
        
      } catch (err) {
        console.warn('⚠️ Erro ao buscar CEP:', err.message)
      }
    }
  }

  /**
   * Validar e limpar data (evitar "0000-00-00" que causa erro)
   */
  const validarData = (data) => {
    if (!data || data === '0000-00-00' || data === '' || data === null) {
      return null
    }
    // Verificar se é uma data válida
    const [ano, mes, dia] = data.split('-')
    if (ano === '0000' || mes === '00' || dia === '00') {
      return null
    }
    return data
  }

  const onSubmit = async (data) => {
    setError('')
    setLoading(true)
    try {
      const { confirmPassword, ...profileData } = data
      
      // Preparar dados completos para salvar
      const dadosCompletos = {
        cnpj: data.cnpj,
        razao_social: data.razaoSocial,
        nome_fantasia: data.nomeFantasia || null,
        cargo: data.cargo,
        // Campos de endereço
        cep: data.cep || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        complemento: data.complemento || null,
        bairro: data.bairro || null,
        municipio: data.municipio || null,
        uf: data.uf || null,
        telefone: data.telefone || null,
        // Adicionar dados da empresa se foram buscados
        ...(dadosEmpresa && {
          situacao_cadastral: dadosEmpresa.situacao_cadastral || null,
          data_situacao_cadastral: validarData(dadosEmpresa.data_situacao_cadastral),
          matriz_filial: dadosEmpresa.matriz_filial || null,
          data_inicio_atividade: validarData(dadosEmpresa.data_inicio_atividade),
          cnae_principal: dadosEmpresa.cnae_principal || null,
          natureza_juridica: dadosEmpresa.natureza_juridica || null,
          porte_empresa: dadosEmpresa.porte_empresa || null,
          capital_social: dadosEmpresa.capital_social ? parseFloat(dadosEmpresa.capital_social.replace(',', '.')) : null,
          opcao_simples: dadosEmpresa.opcao_simples || null,
          data_opcao_simples: validarData(dadosEmpresa.data_opcao_simples),
          opcao_mei: dadosEmpresa.opcao_mei || null,
          data_opcao_mei: validarData(dadosEmpresa.data_opcao_mei),
          cnaes_secundarios: dadosEmpresa.cnaes_secundarios || [],
          quadro_societario: dadosEmpresa.QSA || [],
          dados_completos_receita: dadosEmpresa,
        }),
      }
      
      console.log('📝 Dados a serem salvos:', dadosCompletos)
      
      await signUp(data.email, data.password, dadosCompletos)
      setLocation('/dashboard')
    } catch (err) {
      console.error('❌ Erro ao criar conta:', err)
      setError(err.message || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Criar Conta" subtitle="Comece gratuitamente hoje mesmo">
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-2xl rounded-2xl p-8 md:p-10 border border-gray-100 space-y-6">
        {/* Seção: Dados da Empresa - PRIMEIRO */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">Dados da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="cnpj" className="text-sm font-medium text-gray-700">
                    CNPJ *
                  </Label>
                  <div className="relative">
                    <Input
                      id="cnpj"
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={cnpjValue ? formatarCNPJ(cnpjValue) : ''}
                      onChange={handleCnpjChange}
                      maxLength={18}
                      className={`h-11 pr-10 ${errors.cnpj ? 'border-red-500' : ''} ${cnpjEncontrado ? 'bg-green-50 border-green-500' : ''}`}
                    />
                    {buscandoCNPJ && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      </div>
                    )}
                    {cnpjEncontrado && !buscandoCNPJ && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                  </div>
                  {errors.cnpj && <p className="text-red-600 text-xs mt-1">{errors.cnpj.message}</p>}
                  {cnpjEncontrado && (
                    <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Dados carregados da Receita Federal
                    </p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="razaoSocial" className="text-sm font-medium text-gray-700">
                    Razão Social *
                  </Label>
                  <Input
                    id="razaoSocial"
                    type="text"
                    placeholder="Nome completo da empresa"
                    {...register('razaoSocial')}
                    className={`h-11 ${errors.razaoSocial ? 'border-red-500' : ''} ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                    readOnly={cnpjEncontrado}
                  />
                  {errors.razaoSocial && <p className="text-red-600 text-xs mt-1">{errors.razaoSocial.message}</p>}
                </div>

                <div className="space-y-2 md:col-span-4">
                  <Label htmlFor="nomeFantasia" className="text-sm font-medium text-gray-700">
                    Nome Fantasia
                  </Label>
                  <Input
                    id="nomeFantasia"
                    type="text"
                    placeholder="Nome fantasia"
                    {...register('nomeFantasia')}
                    className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                    readOnly={cnpjEncontrado}
                  />
                </div>
          </div>
        </div>

        {/* Seção: Dados de Acesso - DEPOIS */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">Dados de Acesso</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@empresa.com.br"
                    {...register('email')}
                    className={`h-11 ${errors.email ? 'border-red-500' : ''}`}
                  />
                  {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="cargo" className="text-sm font-medium text-gray-700">
                    Cargo *
                  </Label>
                  <Select value={cargo} onValueChange={(value) => setValue('cargo', value, { shouldValidate: true })}>
                    <SelectTrigger className={`h-11 ${errors.cargo ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Selecione seu cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gerente">Gerente</SelectItem>
                      <SelectItem value="Dono">Dono</SelectItem>
                      <SelectItem value="Independente">Independente</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.cargo && <p className="text-red-600 text-xs mt-1">{errors.cargo.message}</p>}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Senha *
                  </Label>
                  <PasswordInput
                    id="password"
                    placeholder="Mínimo 6 caracteres"
                    {...register('password')}
                    className={`h-11 ${errors.password ? 'border-red-500' : ''}`}
                  />
                  {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirmar Senha *
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Digite a senha novamente"
                    {...register('confirmPassword')}
                    className={`h-11 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  />
                  {errors.confirmPassword && <p className="text-red-600 text-xs mt-1">{errors.confirmPassword.message}</p>}
                </div>
          </div>
        </div>

        {/* Seção: Endereço */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep" className="text-sm font-medium text-gray-700">
                    CEP
                  </Label>
                  <Input
                    id="cep"
                    type="text"
                    placeholder="00000-000"
                    {...register('cep')}
                    onBlur={handleCepBlur}
                    maxLength={9}
                    className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                  />
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="logradouro" className="text-sm font-medium text-gray-700">
                    Logradouro
                  </Label>
                  <Input
                    id="logradouro"
                    type="text"
                    placeholder="Rua, Avenida, etc"
                    {...register('logradouro')}
                    className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                    readOnly={cnpjEncontrado}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numero" className="text-sm font-medium text-gray-700">
                    Número
                  </Label>
                  <Input
                    id="numero"
                    type="text"
                    placeholder="Nº"
                    {...register('numero')}
                    className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                    readOnly={cnpjEncontrado}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="complemento" className="text-sm font-medium text-gray-700">
                    Complemento
                  </Label>
                  <Input
                    id="complemento"
                    type="text"
                    placeholder="Sala, andar, etc"
                    {...register('complemento')}
                    className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bairro" className="text-sm font-medium text-gray-700">
                    Bairro
                  </Label>
                  <Input
                    id="bairro"
                    type="text"
                    placeholder="Bairro"
                    {...register('bairro')}
                    className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                    readOnly={cnpjEncontrado}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="municipio" className="text-sm font-medium text-gray-700">
                    Município
                  </Label>
                  <Input
                    id="municipio"
                    type="text"
                    placeholder="Cidade"
                    {...register('municipio')}
                    className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                    readOnly={cnpjEncontrado}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uf" className="text-sm font-medium text-gray-700">
                    UF
                  </Label>
                  <Input
                    id="uf"
                    type="text"
                    placeholder="SP"
                    {...register('uf')}
                    maxLength={2}
                    className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                    readOnly={cnpjEncontrado}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone" className="text-sm font-medium text-gray-700">
                    Telefone
                  </Label>
                  <Input
                    id="telefone"
                    type="text"
                    placeholder="(11) 99999-9999"
                    {...register('telefone')}
                    className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`}
                  />
                </div>
          </div>
        </div>

        {error && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base shadow-lg" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Criando conta...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Criar Conta Grátis
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-gray-500 mt-3">
                  Sem cartão de crédito • Sem compromisso
                </p>
              </div>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <Link href="/login">
              <a className="text-orange-600 hover:text-orange-700 font-semibold hover:underline cursor-pointer">
                Faça login aqui
              </a>
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}

