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
import { PublicRoute } from '@/components/PublicRoute'
import { useAuth } from '@/hooks/useAuth'
import { validarCNPJ, formatarCNPJ } from '@/lib/utils'
import { Search, Building2, Loader2, CheckCircle, Plus, ChevronRight, ChevronLeft } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
 * Formato interno único para CNAEs secundários: array de códigos (string).
 * O score de aderência no boletim aceita string[] ou { codigo }[].
 */
function normalizarCnaesSecundarios(origem) {
  if (!origem || !Array.isArray(origem)) return []
  return origem.map(item => {
    if (typeof item === 'string') return item.replace(/\D/g, '').slice(0, 7) || null
    const cod = item?.codigo ?? item?.id
    return cod ? String(cod).replace(/\D/g, '').slice(0, 7) : null
  }).filter(Boolean)
}

/**
 * Buscar dados da empresa: tenta openCnpj (publica.cnpj.ws) primeiro para ter CNAEs secundários;
 * fallback para BrasilAPI. Ambas permitem CORS.
 */
async function buscarDadosCNPJ(cnpj) {
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  let resultado = null
  let origem = null

  // 1) Tentar openCnpj (publica.cnpj.ws) — costuma retornar cnaes_secundarios e QSA completos
  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      mode: 'cors',
    })
    if (res.ok) {
      const dados = await res.json()
      const estab = dados.estabelecimento || dados
      const ativPrincipal = estab.atividade_principal || dados.atividade_principal
      const ativSecundarias = estab.atividades_secundarias || dados.atividades_secundarias || dados.cnaes_secundarios
      const socios = dados.socios || dados.QSA || []
      const cnaePrincipal = ativPrincipal?.id ?? ativPrincipal?.codigo ?? dados.cnae_principal
      const cnaesSec = Array.isArray(ativSecundarias)
        ? ativSecundarias.map(a => (typeof a === 'string' ? a : (a?.id ?? a?.codigo)))
        : (Array.isArray(dados.cnaes_secundarios) ? dados.cnaes_secundarios : [])
      resultado = {
        razao_social: dados.razao_social || '',
        nome_fantasia: (estab.nome_fantasia ?? dados.nome_fantasia) || '',
        situacao_cadastral: estab.situacao_cadastral ?? dados.situacao_cadastral ?? '',
        data_situacao_cadastral: estab.data_situacao_cadastral ?? dados.data_situacao_cadastral ?? null,
        matriz_filial: (estab.tipo === 'Matriz' || estab.tipo === 'MATRIZ') ? 'Matriz' : (estab.tipo === 'Filial' || estab.tipo === 'FILIAL') ? 'Filial' : null,
        data_inicio_atividade: estab.data_inicio_atividade ?? dados.data_inicio_atividade ?? null,
        cnae_principal: cnaePrincipal ? String(cnaePrincipal).replace(/\D/g, '').slice(0, 7) : null,
        natureza_juridica: typeof dados.natureza_juridica === 'object' ? dados.natureza_juridica?.descricao : dados.natureza_juridica,
        porte_empresa: typeof dados.porte === 'object' ? dados.porte?.descricao : dados.porte_empresa ?? dados.porte,
        capital_social: dados.capital_social ? parseFloat(String(dados.capital_social).replace(',', '.')) : null,
        opcao_simples: dados.simples?.simples ?? dados.opcao_simples ? 'Sim' : 'Não',
        data_opcao_simples: dados.simples?.data_opcao ?? dados.data_opcao_simples ?? null,
        opcao_mei: dados.opcao_mei === 'S' || dados.opcao_mei === true ? 'Sim' : 'Não',
        data_opcao_mei: dados.data_opcao_mei ?? null,
        cnaes_secundarios: normalizarCnaesSecundarios(cnaesSec),
        QSA: socios.map(s => ({
          nome: s.nome ?? s.nome_socio,
          qualificacao: s.qualificacao_socio?.descricao ?? s.qualificacao_socio ?? s.qual,
        })),
        cep: (estab.cep ?? dados.cep ?? '').replace(/\D/g, ''),
        logradouro: [estab.tipo_logradouro, estab.logradouro].filter(Boolean).join(' ') || dados.logradouro || '',
        numero: estab.numero ?? dados.numero ?? '',
        complemento: estab.complemento ?? dados.complemento ?? '',
        bairro: estab.bairro ?? dados.bairro ?? '',
        municipio: estab.cidade?.nome ?? dados.municipio ?? dados.cidade ?? '',
        uf: estab.estado?.sigla ?? dados.uf ?? '',
        telefone: estab.ddd1 && estab.telefone1 ? `(${estab.ddd1}) ${estab.telefone1}` : (dados.telefones?.[0] ? `(${dados.telefones[0].ddd}) ${dados.telefones[0].numero}` : ''),
        email: estab.email ?? dados.email ?? '',
      }
      origem = 'openCnpj'
    }
  } catch (_) {}

  // 2) Fallback: BrasilAPI (às vezes não traz cnaes_fiscal_secundaria; se openCnpj já trouxe CNAEs, não sobrescrever)
  if (!resultado) {
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        mode: 'cors',
      })
      if (response.ok) {
        const dados = await response.json()
        const cnaesSec = dados.cnaes_fiscal_secundaria?.map(a => ({ codigo: a.codigo, descricao: a.descricao })) || []
        resultado = {
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
          cnaes_secundarios: normalizarCnaesSecundarios(cnaesSec),
          QSA: dados.qsa?.map(socio => ({ nome: socio.nome, qualificacao: socio.qual })) || [],
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
        origem = 'BrasilAPI'
      } else if (response.status === 404) {
        throw new Error('CNPJ não encontrado na base de dados')
      }
    } catch (err) {
      throw new Error('Não foi possível buscar os dados do CNPJ automaticamente. Por favor, preencha os dados manualmente.')
    }
  }

  if (!resultado) throw new Error('Não foi possível buscar os dados do CNPJ automaticamente. Por favor, preencha os dados manualmente.')
  return resultado
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
  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 5

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

  // Redirecionar se já estiver logado
  if (user) {
    setLocation('/modulos')
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
        const dados = await buscarDadosCNPJ(value)
        
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
        // Não bloquear o cadastro - apenas mostrar aviso suave
        setError('')
        // Se for erro de API indisponível, não mostrar erro crítico
        if (err.message && err.message.includes('indisponível')) {
        } else if (err.message && err.message.includes('não encontrado')) {
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
        const endereco = await buscarEnderecoCEP(cep)
        
        // Preencher campos de endereço
        setValue('logradouro', endereco.logradouro || '')
        setValue('bairro', endereco.bairro || '')
        setValue('municipio', endereco.localidade || '')
        setValue('uf', endereco.uf || '')
        
      } catch (err) {
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
      
      
      await signUp(data.email, data.password, dadosCompletos)
      setLocation('/modulos')
    } catch (err) {
      const msg = err.message || ''
      if (/email signups are disabled|signups are disabled/i.test(msg)) {
        setError('Cadastro por e-mail está desativado no servidor. No Supabase Dashboard, vá em Authentication → Providers → Email e ative o provedor de e-mail e os signups. Deixe "Confirm email" desativado para acesso imediato sem envio de e-mail. Ver docs/SUPABASE-CADASTRO.md.')
      } else if (err.status === 429 || /rate limit|email rate limit|too many requests/i.test(msg)) {
        setError('Limite de envio de e-mails atingido. No Supabase: Authentication → Providers → Email, desative "Confirm email" para não enviar e-mail e evitar o limite. Ver docs/SUPABASE-CADASTRO.md.')
      } else if (err.code === '23514' && msg.includes('profiles_cargo_check')) {
        setError('Erro: O cargo selecionado não está permitido no banco de dados. Por favor, execute o script SQL "atualizar-opcoes-cargo.sql" no Supabase para atualizar as opções de cargo permitidas.')
      } else {
        setError(msg || 'Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const stepTitles = ['Dados da Empresa', 'Dados de Acesso', 'Endereço', 'Configuração do serviço', 'Informações do Perfil']

  return (
    <PublicRoute>
      <AuthLayout title="Criar Conta" subtitle="Comece gratuitamente hoje mesmo" contentClassName="w-full max-w-4xl px-2">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Indicador de etapas */}
        <div className="flex items-center justify-between gap-2 mb-6">
          {stepTitles.map((title, i) => (
            <div key={i} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => setStep(i + 1)}
                className={`flex flex-col items-center gap-1 min-w-0 ${step === i + 1 ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${step === i + 1 ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}>
                  {i + 1}
                </span>
                <span className="text-[10px] sm:text-xs font-medium truncate w-full text-center hidden sm:block">{title}</span>
              </button>
              {i < TOTAL_STEPS - 1 && <div className={`flex-1 h-0.5 mx-0.5 rounded ${step > i + 1 ? 'bg-orange-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <Card className="overflow-hidden shadow-lg border-gray-200/80">
          <CardHeader className="bg-gray-50/80 border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-900">{stepTitles[step - 1]}</h3>
            <p className="text-sm text-gray-500">Etapa {step} de {TOTAL_STEPS}</p>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            {/* Etapa 1: Dados da Empresa */}
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="text-sm font-medium text-gray-700">CNPJ *</Label>
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
                    {buscandoCNPJ && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>}
                    {cnpjEncontrado && !buscandoCNPJ && <div className="absolute right-3 top-1/2 -translate-y-1/2"><CheckCircle className="w-5 h-5 text-green-500" /></div>}
                  </div>
                  {errors.cnpj && <p className="text-red-600 text-xs mt-1">{errors.cnpj.message}</p>}
                  {cnpjEncontrado && <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Dados carregados da Receita Federal</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="razaoSocial" className="text-sm font-medium text-gray-700">Razão Social *</Label>
                  <Input id="razaoSocial" type="text" placeholder="Nome completo da empresa" {...register('razaoSocial')} className={`h-11 ${errors.razaoSocial ? 'border-red-500' : ''} ${cnpjEncontrado ? 'bg-green-50' : ''}`} readOnly={cnpjEncontrado} />
                  {errors.razaoSocial && <p className="text-red-600 text-xs mt-1">{errors.razaoSocial.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomeFantasia" className="text-sm font-medium text-gray-700">Nome Fantasia</Label>
                  <Input id="nomeFantasia" type="text" placeholder="Nome fantasia" {...register('nomeFantasia')} className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`} readOnly={cnpjEncontrado} />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="telefone" className="text-sm font-medium text-gray-700">Telefone</Label>
                  <Input id="telefone" type="text" placeholder="(11) 99999-9999" {...register('telefone')} className="h-11 max-w-xs" />
                </div>
              </div>
            )}

            {/* Etapa 2: Dados de Acesso */}
            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email *</Label>
                  <Input id="email" type="email" placeholder="seu@empresa.com.br" {...register('email')} className={`h-11 ${errors.email ? 'border-red-500' : ''}`} />
                  {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo" className="text-sm font-medium text-gray-700">Cargo *</Label>
                  <Select value={cargo} onValueChange={(value) => setValue('cargo', value, { shouldValidate: true })}>
                    <SelectTrigger className={`h-11 ${errors.cargo ? 'border-red-500' : ''}`}><SelectValue placeholder="Selecione seu cargo" /></SelectTrigger>
                    <SelectContent>
                      {['Proprietário(a) / Sócio(a)', 'Presidente / CEO', 'Administrador(a)', 'Diretor(a)', 'Engenheiro(a)', 'Gerente', 'Analista de licitação', 'Assistente administrativo', 'Advogado(a)', 'Contador(a)', 'Consultor(a)', 'Representante', 'Servidor público', 'Coordenador(a)', 'Supervisor(a)', 'Técnico(a)', 'Auxiliar', 'Estagiário(a)', 'Outro'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.cargo && <p className="text-red-600 text-xs mt-1">{errors.cargo.message}</p>}
                </div>
                <div className="space-y-2" />
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Senha *</Label>
                  <PasswordInput id="password" placeholder="Mínimo 6 caracteres" {...register('password')} className={`h-11 ${errors.password ? 'border-red-500' : ''}`} />
                  {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirmar Senha *</Label>
                  <PasswordInput id="confirmPassword" placeholder="Digite a senha novamente" {...register('confirmPassword')} className={`h-11 ${errors.confirmPassword ? 'border-red-500' : ''}`} />
                  {errors.confirmPassword && <p className="text-red-600 text-xs mt-1">{errors.confirmPassword.message}</p>}
                </div>
              </div>
            )}

            {/* Etapa 3: Endereço */}
            {step === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="cep" className="text-sm font-medium text-gray-700">CEP</Label>
                  <Input id="cep" type="text" placeholder="00000-000" {...register('cep')} onBlur={handleCepBlur} maxLength={9} className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logradouro" className="text-sm font-medium text-gray-700">Logradouro</Label>
                  <Input id="logradouro" type="text" placeholder="Rua, Avenida, etc" {...register('logradouro')} className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`} readOnly={cnpjEncontrado} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero" className="text-sm font-medium text-gray-700">Número</Label>
                  <Input id="numero" type="text" placeholder="Nº" {...register('numero')} className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`} readOnly={cnpjEncontrado} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complemento" className="text-sm font-medium text-gray-700">Complemento</Label>
                  <Input id="complemento" type="text" placeholder="Sala, andar, etc" {...register('complemento')} className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bairro" className="text-sm font-medium text-gray-700">Bairro</Label>
                  <Input id="bairro" type="text" placeholder="Bairro" {...register('bairro')} className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`} readOnly={cnpjEncontrado} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="municipio" className="text-sm font-medium text-gray-700">Município</Label>
                  <Input id="municipio" type="text" placeholder="Cidade" {...register('municipio')} className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`} readOnly={cnpjEncontrado} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uf" className="text-sm font-medium text-gray-700">UF</Label>
                  <Input id="uf" type="text" placeholder="SP" {...register('uf')} maxLength={2} className={`h-11 ${cnpjEncontrado ? 'bg-green-50' : ''}`} readOnly={cnpjEncontrado} />
                </div>
              </div>
            )}

            {/* Etapa 4: Configuração do serviço */}
            {step === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 min-w-0">
                  <Label className="text-sm font-medium text-gray-700">Atividades de interesse *</Label>
                  <p className="text-xs text-gray-500">Selecione pelo menos uma atividade ou um estado para continuar</p>
                  <div className="flex gap-2 flex-wrap">
                    <Input readOnly value={setoresSelecionados.length > 0 ? `${setoresSelecionados.length} setor(es) selecionado(s)` : ''} placeholder="Nenhum setor" className="flex-1 min-w-0" />
                    <Button type="button" variant="outline" onClick={() => setModalSetoresAberto(true)} className="border-orange-500 text-orange-600 hover:bg-orange-50 shrink-0"><Plus className="w-4 h-4 mr-2" /> Selecionar atividade</Button>
                  </div>
                  {setoresSelecionados.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{setoresSelecionados.map((item, idx) => <Badge key={idx} variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">{item.setor} {item.subsetores?.length > 0 && `(${item.subsetores.length})`}</Badge>)}</div>}
                </div>
                <div className="space-y-2 min-w-0">
                  <Label className="text-sm font-medium text-gray-700">Estados *</Label>
                  <p className="text-xs text-gray-500">Selecione os estados de interesse</p>
                  <div className="flex gap-2 flex-wrap">
                    <Input readOnly value={estadosSelecionados.length > 0 ? `${estadosSelecionados.length} estado(s)` : ''} placeholder="Nenhum estado" className="flex-1 min-w-0" />
                    <Button type="button" variant="outline" onClick={() => setModalEstadosAberto(true)} className="border-orange-500 text-orange-600 hover:bg-orange-50 shrink-0"><Plus className="w-4 h-4 mr-2" /> Estados</Button>
                  </div>
                  {estadosSelecionados.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{estadosSelecionados.map((e) => <Badge key={e} variant="outline" className="bg-orange-50 text-orange-800 border-orange-200">{e}</Badge>)}</div>}
                </div>
              </div>
            )}

            {/* Etapa 5: Informações do Perfil */}
            {step === 5 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Como conheceu o Sistema Licitação?</Label>
                  <Select value={comoConheceu} onValueChange={(v) => setValue('comoConheceu', v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Google / Busca online">Google / Busca online</SelectItem>
                      <SelectItem value="Redes sociais (Facebook, Instagram, LinkedIn)">Redes sociais</SelectItem>
                      <SelectItem value="Indicação de amigo/colega">Indicação de amigo/colega</SelectItem>
                      <SelectItem value="Email marketing">Email marketing</SelectItem>
                      <SelectItem value="Evento/Feira">Evento/Feira</SelectItem>
                      <SelectItem value="Parceiro comercial">Parceiro comercial</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Quantidade de funcionários?</Label>
                  <Select value={quantidadeFuncionarios} onValueChange={(v) => setValue('quantidadeFuncionarios', v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
                  <Label className="text-sm font-medium text-gray-700">Licitações por mês?</Label>
                  <Select value={licitacoesPorMes} onValueChange={(v) => setValue('licitacoesPorMes', v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
                  <Label className="text-sm font-medium text-gray-700">Faturamento anual com licitações?</Label>
                  <Select value={faturamentoAnual} onValueChange={(v) => setValue('faturamentoAnual', v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Até R$ 100.000">Até R$ 100.000</SelectItem>
                      <SelectItem value="R$ 100.001 - R$ 500.000">R$ 100.001 - R$ 500.000</SelectItem>
                      <SelectItem value="R$ 500.001 - R$ 1.000.000">R$ 500.001 - R$ 1 mi</SelectItem>
                      <SelectItem value="R$ 1.000.001 - R$ 5.000.000">R$ 1 mi - R$ 5 mi</SelectItem>
                      <SelectItem value="R$ 5.000.001 - R$ 10.000.000">R$ 5 mi - R$ 10 mi</SelectItem>
                      <SelectItem value="Mais de R$ 10.000.000">Mais de R$ 10 mi</SelectItem>
                      <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-medium text-gray-700">Como pretende usar os serviços?</Label>
                  <Select value={comoPretendeUsar} onValueChange={(v) => setValue('comoPretendeUsar', v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Buscar oportunidades de licitações">Buscar oportunidades</SelectItem>
                      <SelectItem value="Monitorar editais do meu interesse">Monitorar editais</SelectItem>
                      <SelectItem value="Receber alertas personalizados">Alertas personalizados</SelectItem>
                      <SelectItem value="Analisar histórico de licitações">Histórico de licitações</SelectItem>
                      <SelectItem value="Gerenciar favoritos">Gerenciar favoritos</SelectItem>
                      <SelectItem value="Todos os recursos">Todos os recursos</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navegação entre etapas */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div>
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={() => setStep(s => s + 1)} className="gap-2 bg-orange-500 hover:bg-orange-600">
                Próximo <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="submit" className="h-12 px-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg" disabled={loading}>
                {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Criando conta...</> : <>Criar Conta Grátis</>}
              </Button>
            )}
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

        <p className="text-center text-xs text-gray-500">Sem cartão de crédito • Sem compromisso</p>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
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

