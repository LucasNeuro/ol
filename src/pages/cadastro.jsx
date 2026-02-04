import { useState, useEffect } from 'react'
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
import { PublicRoute } from '@/components/PublicRoute'
import { useAuth } from '@/hooks/useAuth'
import { validarCNPJ, formatarCNPJ } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { syncPalavrasFortesFromSetores } from '@/lib/palavrasFortes'
import { Search, Building2, Loader2, CheckCircle, Plus } from 'lucide-react'
import { SelecionarSetores } from '@/components/SelecionarSetores'
import { SelecionarEstados } from '@/components/SelecionarEstados'
import { Badge } from '@/components/ui/badge'

const cadastroSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
  cnpj: z.string().refine((val) => validarCNPJ(val), {
    message: 'CNPJ inválido',
  }),
  razaoSocial: z.string().min(3, 'Razão social deve ter no mínimo 3 caracteres'),
  nomeFantasia: z.string().optional(),
  cargo: z.enum([
    'Proprietário(a) / Sócio(a)',
    'Presidente / CEO',
    'Administrador(a)',
    'Diretor(a)',
    'Engenheiro(a)',
    'Gerente',
    'Analista de licitação',
    'Assistente administrativo',
    'Advogado(a)',
    'Contador(a)',
    'Consultor(a)',
    'Representante',
    'Servidor público',
    'Coordenador(a)',
    'Supervisor(a)',
    'Técnico(a)',
    'Auxiliar',
    'Estagiário(a)',
    'Outro'
  ], {
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
  // Campos de qualificação
  comoConheceu: z.string().optional(),
  quantidadeFuncionarios: z.string().optional(),
  licitacoesPorMes: z.string().optional(),
  faturamentoAnual: z.string().optional(),
  comoPretendeUsar: z.string().optional(),
  // Campos de configuração do serviço
  setoresAtividades: z.array(z.any()).optional(),
  estadosInteresse: z.array(z.string()).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

/**
 * Buscar dados da empresa pela API BrasilAPI (permite CORS)
 * BrasilAPI é gratuita, permite CORS e não requer autenticação
 */
async function buscarDadosCNPJ(cnpj) {
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  
  // Tentar primeiro com BrasilAPI (permite CORS)
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      mode: 'cors',
    })
    
    if (response.ok) {
      const dados = await response.json()
      
      // Mapear dados da BrasilAPI para o formato esperado
      return {
        razao_social: dados.razao_social || '',
        nome_fantasia: dados.nome_fantasia || '',
        situacao_cadastral: dados.descricao_situacao_cadastral || '',
        data_situacao_cadastral: dados.data_situacao_cadastral || null,
        matriz_filial: dados.descricao_tipo_logradouro === 'MATRIZ' ? 'Matriz' : dados.descricao_tipo_logradouro === 'FILIAL' ? 'Filial' : null,
        data_inicio_atividade: dados.data_inicio_atividade || null,
        cnae_principal: dados.cnae_fiscal_principal?.codigo || null,
        natureza_juridica: dados.natureza_juridica || null,
        porte_empresa: dados.porte || null,
        capital_social: dados.capital_social ? parseFloat(dados.capital_social.toString().replace(',', '.')) : null,
        opcao_simples: dados.opcao_pelo_simples ? 'Sim' : 'Não',
        data_opcao_simples: dados.data_opcao_pelo_simples || null,
        opcao_mei: dados.opcao_pelo_mei ? 'Sim' : 'Não',
        data_opcao_mei: dados.data_opcao_pelo_mei || null,
        cnaes_secundarios: dados.cnaes_fiscal_secundaria?.map(a => ({
          codigo: a.codigo,
          descricao: a.descricao
        })) || [],
        QSA: dados.qsa?.map(socio => ({
          nome: socio.nome,
          qualificacao: socio.qual
        })) || [],
        // Endereço
        cep: dados.cep?.replace(/\D/g, '') || '',
        logradouro: dados.logradouro || '',
        numero: dados.numero || '',
        complemento: dados.complemento || '',
        bairro: dados.bairro || '',
        municipio: dados.municipio || '',
        uf: dados.uf || '',
        telefone: dados.ddd_telefone_1 ? `(${dados.ddd_telefone_1}) ${dados.telefone_1}` : '',
        email: dados.email || '',
      }
    } else if (response.status === 404) {
      throw new Error('CNPJ não encontrado na base de dados')
    }
  } catch (error) {
    console.warn('⚠️ Erro ao buscar na BrasilAPI:', error)
    // Se falhar, não tentar outras APIs (elas também têm CORS)
    // Apenas informar que o usuário pode preencher manualmente
    throw new Error('Não foi possível buscar os dados do CNPJ automaticamente. Por favor, preencha os dados manualmente.')
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
  const [modalSetoresAberto, setModalSetoresAberto] = useState(false)
  const [modalEstadosAberto, setModalEstadosAberto] = useState(false)
  const [setoresSelecionados, setSetoresSelecionados] = useState([])
  const [estadosSelecionados, setEstadosSelecionados] = useState([])

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
  const comoConheceu = watch('comoConheceu')
  const quantidadeFuncionarios = watch('quantidadeFuncionarios')
  const licitacoesPorMes = watch('licitacoesPorMes')
  const faturamentoAnual = watch('faturamentoAnual')
  const comoPretendeUsar = watch('comoPretendeUsar')

  // Redirecionar se já estiver logado (em useEffect para não atualizar outro componente durante o render)
  useEffect(() => {
    if (user) setLocation('/modulos')
  }, [user, setLocation])
  if (user) return null

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
        // Telefone NÃO é preenchido automaticamente - usuário deve preencher manualmente

      } catch (err) {
        console.warn('⚠️ Erro ao buscar CNPJ:', err)
        // Não bloquear o cadastro - apenas mostrar aviso suave
        setError('')
        // Se for erro de API indisponível, não mostrar erro crítico
        if (err.message && err.message.includes('indisponível')) {
          console.log('ℹ️ API temporariamente indisponível. O usuário pode preencher manualmente.')
        } else if (err.message && err.message.includes('não encontrado')) {
          console.log('ℹ️ CNPJ não encontrado automaticamente. O usuário pode preencher manualmente.')
        }
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
      // Validar cargo antes de enviar
      if (!data.cargo) {
        throw new Error('Por favor, selecione um cargo')
      }

      // Validar que pelo menos uma atividade de interesse OU um estado foi selecionado
      if (setoresSelecionados.length === 0 && estadosSelecionados.length === 0) {
        throw new Error('Por favor, selecione pelo menos uma atividade de interesse ou um estado para continuar')
      }

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
        // Campos de qualificação
        como_conheceu: data.comoConheceu || null,
        quantidade_funcionarios: data.quantidadeFuncionarios || null,
        licitacoes_por_mes: data.licitacoesPorMes || null,
        faturamento_anual: data.faturamentoAnual || null,
        como_pretende_usar: data.comoPretendeUsar || null,
        // Campos de configuração do serviço
        setores_atividades: setoresSelecionados.length > 0 ? setoresSelecionados : null,
        estados_interesse: estadosSelecionados.length > 0 ? estadosSelecionados : null,
        // Adicionar dados da empresa se foram buscados
        ...(dadosEmpresa && {
          situacao_cadastral: dadosEmpresa.situacao_cadastral || null,
          data_situacao_cadastral: validarData(dadosEmpresa.data_situacao_cadastral),
          matriz_filial: dadosEmpresa.matriz_filial || null,
          data_inicio_atividade: validarData(dadosEmpresa.data_inicio_atividade),
          cnae_principal: dadosEmpresa.cnae_principal || null,
          natureza_juridica: dadosEmpresa.natureza_juridica || null,
          porte_empresa: dadosEmpresa.porte_empresa || null,
          capital_social: dadosEmpresa.capital_social ? parseFloat(dadosEmpresa.capital_social.toString().replace(',', '.')) : null,
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
      // Popular tabela de palavras fortes com setores/subsetores escolhidos (filtro dinâmico)
      if (setoresSelecionados?.length > 0) {
        syncPalavrasFortesFromSetores(setoresSelecionados, supabase).then(({ ok, inseridas }) => {
          if (ok && inseridas) console.log(`✅ [palavrasFortes] ${inseridas} termo(s) sincronizado(s) a partir do cadastro`)
        })
      }
      setLocation('/modulos')
    } catch (err) {
      console.error('❌ Erro ao criar conta:', err)
      
      // Mensagem de erro mais clara para constraint de cargo
      if (err.code === '23514' && err.message?.includes('profiles_cargo_check')) {
        setError('Erro: O cargo selecionado não está permitido no banco de dados. Por favor, execute o script SQL "atualizar-opcoes-cargo.sql" no Supabase para atualizar as opções de cargo permitidas.')
      } else {
        setError(err.message || 'Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicRoute>
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

                <div className="space-y-2 md:col-span-2">
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

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="telefone" className="text-sm font-medium text-gray-700">
                    Telefone
                  </Label>
                  <Input
                    id="telefone"
                    type="text"
                    placeholder="(11) 99999-9999"
                    {...register('telefone')}
                    className="h-11"
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
                      <SelectItem value="Proprietário(a) / Sócio(a)">Proprietário(a) / Sócio(a)</SelectItem>
                      <SelectItem value="Presidente / CEO">Presidente / CEO</SelectItem>
                      <SelectItem value="Administrador(a)">Administrador(a)</SelectItem>
                      <SelectItem value="Diretor(a)">Diretor(a)</SelectItem>
                      <SelectItem value="Engenheiro(a)">Engenheiro(a)</SelectItem>
                      <SelectItem value="Gerente">Gerente</SelectItem>
                      <SelectItem value="Analista de licitação">Analista de licitação</SelectItem>
                      <SelectItem value="Assistente administrativo">Assistente administrativo</SelectItem>
                      <SelectItem value="Advogado(a)">Advogado(a)</SelectItem>
                      <SelectItem value="Contador(a)">Contador(a)</SelectItem>
                      <SelectItem value="Consultor(a)">Consultor(a)</SelectItem>
                      <SelectItem value="Representante">Representante</SelectItem>
                      <SelectItem value="Servidor público">Servidor público</SelectItem>
                      <SelectItem value="Coordenador(a)">Coordenador(a)</SelectItem>
                      <SelectItem value="Supervisor(a)">Supervisor(a)</SelectItem>
                      <SelectItem value="Técnico(a)">Técnico(a)</SelectItem>
                      <SelectItem value="Auxiliar">Auxiliar</SelectItem>
                      <SelectItem value="Estagiário(a)">Estagiário(a)</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
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
          </div>
        </div>

        {/* Seção: Configuração do serviço */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">Configuração do serviço</h3>
          <div className="space-y-4">
            {/* Atividades de interesse */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Atividades de interesse <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500">
                Selecione pelo menos uma atividade de interesse ou um estado para continuar
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={
                    setoresSelecionados.length > 0
                      ? `${setoresSelecionados.length} setor(es) selecionado(s)`
                      : ''
                  }
                  placeholder="Nenhum setor selecionado"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalSetoresAberto(true)}
                  className="border-green-500 text-green-600 hover:bg-green-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  selecionar atividade
                </Button>
              </div>
              {setoresSelecionados.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {setoresSelecionados.map((item, idx) => (
                    <Badge key={idx} variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
                      {item.setor} {item.subsetores.length > 0 && `(${item.subsetores.length} atividades)`}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Estados */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Estados <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={
                    estadosSelecionados.length > 0
                      ? `${estadosSelecionados.length} estado(s) selecionado(s)`
                      : ''
                  }
                  placeholder="Nenhum estado selecionado"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalEstadosAberto(true)}
                  className="border-green-500 text-green-600 hover:bg-green-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  selecionar estados
                </Button>
              </div>
              {estadosSelecionados.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {estadosSelecionados.map((estado) => (
                    <Badge key={estado} variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">
                      {estado}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Seção: Informações do Perfil */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">Informações do Perfil</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comoConheceu" className="text-sm font-medium text-gray-700">
                Como conheceu o Sitema Licitação?
              </Label>
              <Select value={comoConheceu} onValueChange={(value) => setValue('comoConheceu', value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Google / Busca online">Google / Busca online</SelectItem>
                  <SelectItem value="Redes sociais (Facebook, Instagram, LinkedIn)">Redes sociais (Facebook, Instagram, LinkedIn)</SelectItem>
                  <SelectItem value="Indicação de amigo/colega">Indicação de amigo/colega</SelectItem>
                  <SelectItem value="Email marketing">Email marketing</SelectItem>
                  <SelectItem value="Evento/Feira">Evento/Feira</SelectItem>
                  <SelectItem value="Parceiro comercial">Parceiro comercial</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidadeFuncionarios" className="text-sm font-medium text-gray-700">
                Quantidade de funcionários?
              </Label>
              <Select value={quantidadeFuncionarios} onValueChange={(value) => setValue('quantidadeFuncionarios', value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-5 funcionários">1-5 funcionários</SelectItem>
                  <SelectItem value="6-10 funcionários">6-10 funcionários</SelectItem>
                  <SelectItem value="11-50 funcionários">11-50 funcionários</SelectItem>
                  <SelectItem value="51-200 funcionários">51-200 funcionários</SelectItem>
                  <SelectItem value="201-500 funcionários">201-500 funcionários</SelectItem>
                  <SelectItem value="Mais de 500 funcionários">Mais de 500 funcionários</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="licitacoesPorMes" className="text-sm font-medium text-gray-700">
                Quantas licitações participa por mês?
              </Label>
              <Select value={licitacoesPorMes} onValueChange={(value) => setValue('licitacoesPorMes', value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nenhuma">Nenhuma</SelectItem>
                  <SelectItem value="1-5 licitações">1-5 licitações</SelectItem>
                  <SelectItem value="6-10 licitações">6-10 licitações</SelectItem>
                  <SelectItem value="11-20 licitações">11-20 licitações</SelectItem>
                  <SelectItem value="21-50 licitações">21-50 licitações</SelectItem>
                  <SelectItem value="Mais de 50 licitações">Mais de 50 licitações</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="faturamentoAnual" className="text-sm font-medium text-gray-700">
                Faturamento anual com licitações?
              </Label>
              <Select value={faturamentoAnual} onValueChange={(value) => setValue('faturamentoAnual', value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Até R$ 100.000">Até R$ 100.000</SelectItem>
                  <SelectItem value="R$ 100.001 - R$ 500.000">R$ 100.001 - R$ 500.000</SelectItem>
                  <SelectItem value="R$ 500.001 - R$ 1.000.000">R$ 500.001 - R$ 1.000.000</SelectItem>
                  <SelectItem value="R$ 1.000.001 - R$ 5.000.000">R$ 1.000.001 - R$ 5.000.000</SelectItem>
                  <SelectItem value="R$ 5.000.001 - R$ 10.000.000">R$ 5.000.001 - R$ 10.000.000</SelectItem>
                  <SelectItem value="Mais de R$ 10.000.000">Mais de R$ 10.000.000</SelectItem>
                  <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="comoPretendeUsar" className="text-sm font-medium text-gray-700">
                Como pretende usar os serviços do Sistema licitação?
              </Label>
              <Select value={comoPretendeUsar} onValueChange={(value) => setValue('comoPretendeUsar', value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Buscar oportunidades de licitações">Buscar oportunidades de licitações</SelectItem>
                  <SelectItem value="Monitorar editais do meu interesse">Monitorar editais do meu interesse</SelectItem>
                  <SelectItem value="Receber alertas personalizados">Receber alertas personalizados</SelectItem>
                  <SelectItem value="Analisar histórico de licitações">Analisar histórico de licitações</SelectItem>
                  <SelectItem value="Gerenciar favoritos">Gerenciar favoritos</SelectItem>
                  <SelectItem value="Todos os recursos">Todos os recursos</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Modais */}
        <SelecionarSetores
          open={modalSetoresAberto}
          onOpenChange={setModalSetoresAberto}
          setoresSelecionados={setoresSelecionados}
          onConfirm={(setores) => {
            setSetoresSelecionados(setores)
            setValue('setoresAtividades', setores)
          }}
        />

        <SelecionarEstados
          open={modalEstadosAberto}
          onOpenChange={setModalEstadosAberto}
          estadosSelecionados={estadosSelecionados}
          onConfirm={(estados) => {
            setEstadosSelecionados(estados)
            setValue('estadosInteresse', estados)
          }}
        />

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
    </PublicRoute>
  )
}

