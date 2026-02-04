import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useUserStore } from '@/store/userStore'
import { useLocation } from 'wouter'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Calendar, 
  MapPin, 
  Building2, 
  DollarSign, 
  FileText, 
  Download,
  ExternalLink,
  Filter,
  X,
  Clock,
  Eye,
  Star,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Plus,
  Edit,
  Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { VisualizadorDocumento } from '@/components/VisualizadorDocumento'
import { useNotifications } from '@/hooks/useNotifications'
import { usePalavrasFortes } from '@/hooks/usePalavrasFortes'
import { obterNomeAtividadeCnae, obterListaCompletaCnaes, resumirNomeAtividade } from '@/lib/cnae'
import { 
  extrairPalavrasChaveDosSetores, 
  correspondeAtividades,
  obterObjetoCompleto,
  normalizarTexto
} from '@/lib/filtroSemantico'
import { filtrarLicitacoesPorBusca, buscarEmLicitacao } from '@/lib/buscaFuzzy'
import { useFiltroContext } from '@/contexts/FiltroContext'
import { isZipFile, descompactarZip, limparBlobUrls } from '@/lib/zipService'
import { LicitacaoCardSkeletonList } from '@/components/LicitacaoCardSkeleton'

// Função auxiliar para normalizar código CNAE (remover hífens e barras)
function normalizarCodigoCnae(codigo) {
  if (!codigo) return null
  return String(codigo).replace(/[-\/\s]/g, '')
}

function LicitacoesContent() {
  const { user } = useUserStore()
  const queryClient = useQueryClient()
  const [location] = useLocation()
  const [cardsExpandidos, setCardsExpandidos] = useState(() => new Set())
  const [favoritos, setFavoritos] = useState(() => new Set())
  const [filtrosSidebarAberta, setFiltrosSidebarAberta] = useState(true)
  const [visualizadorAberto, setVisualizadorAberto] = useState(false)
  const [documentoVisualizacao, setDocumentoVisualizacao] = useState(null)
  const [limitePagina, setLimitePagina] = useState(50)
  const [arquivosZipDescompactados, setArquivosZipDescompactados] = useState({}) // { anexoKey: { loading, arquivos, erro } }
  const [baixandoDocumentos, setBaixandoDocumentos] = useState(new Set()) // IDs de licitações sendo processadas
  // Estados para processamento do filtro (compartilhado via contexto)
  const { 
    processandoFiltro, 
    setProcessandoFiltro, 
    mensagemProgresso, 
    setMensagemProgresso,
    progressoPercentual,
    setProgressoPercentual,
    addLogFiltro
  } = useFiltroContext()
  
  // Cache key baseado em licitações + perfil
  const getCacheKey = () => {
    if (!perfilUsuario || !licitacoes || licitacoes.length === 0) return null
    const perfilHash = JSON.stringify({
      estados: perfilUsuario.estados_interesse,
      setores: perfilUsuario.setores_atividades,
      totalLicitacoes: licitacoes.length
    })
    return `filtro_semantico_${user?.id}_${perfilHash}`
  }
  // Hook para notificações customizadas
  const { success, error: showError, warning, confirm } = useNotifications()

  // Buscar perfil do usuário com setores, estados e sinônimos personalizados
  const { data: perfilUsuario } = useQuery({
    queryKey: ['perfil-usuario', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      
      // Tentar buscar com sinônimos personalizados primeiro
      let { data, error } = await supabase
        .from('profiles')
        .select('setores_atividades, estados_interesse, sinonimos_personalizados')
        .eq('id', user.id)
          .maybeSingle()

      // Se a primeira query falhou (ex.: coluna sinonimos_personalizados não existe), tentar sem ela
      if (error) {
        console.log('ℹ️ Buscando perfil sem sinonimos_personalizados...', error.code || error.message)
        const { data: dataSemSinonimos, error: errorSemSinonimos } = await supabase
          .from('profiles')
          .select('setores_atividades, estados_interesse')
          .eq('id', user.id)
          .maybeSingle()
        
        if (errorSemSinonimos) {
          console.warn('⚠️ Erro ao buscar perfil:', errorSemSinonimos)
          return null
        }
        
        return dataSemSinonimos ? { ...dataSemSinonimos, sinonimos_personalizados: {} } : null
      }
      
      // Garantir que sinonimos_personalizados existe (mesmo que vazio)
      return { ...data, sinonimos_personalizados: data?.sinonimos_personalizados || {} }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60, // Cache por 1 hora
  })

  // API Key do Mistral (opcional - pode estar em variável de ambiente)
  const mistralApiKey = import.meta.env.VITE_MISTRAL_API_KEY || null

  // Buscar sinônimos do banco associados aos setores do usuário
  const { data: sinonimosBanco } = useQuery({
    queryKey: ['sinonimos-banco', perfilUsuario?.setores_atividades],
    queryFn: async () => {
      if (!perfilUsuario?.setores_atividades || perfilUsuario.setores_atividades.length === 0) {
        return {}
      }

      // Extrair IDs dos setores do perfil
      const setoresIds = perfilUsuario.setores_atividades
        .map(s => s.setor_id || s.id)
        .filter(Boolean)

      if (setoresIds.length === 0) {
        return {}
      }

      // Buscar sinônimos associados aos setores via setores_sinonimos
      const { data: setoresSinonimos, error } = await supabase
        .from('setores_sinonimos')
        .select(`
          sinonimo_id,
          sinonimos (
            id,
            palavra_base,
            sinonimo,
            peso
          )
        `)
        .in('setor_id', setoresIds)
        .eq('ativo', true)

      if (error) {
        console.warn('⚠️ Erro ao buscar sinônimos do banco:', error)
        return {}
      }

      // Formatar sinônimos no formato esperado: { palavra_base: [{ sinonimo, peso }] }
      const sinonimosFormatados = {}
      
      if (setoresSinonimos) {
        setoresSinonimos.forEach(ss => {
          if (ss.sinonimos && ss.sinonimos.palavra_base) {
            const palavraBase = ss.sinonimos.palavra_base.toLowerCase()
            if (!sinonimosFormatados[palavraBase]) {
              sinonimosFormatados[palavraBase] = []
            }
            // Adicionar sinônimo se ainda não estiver na lista
            const jaExiste = sinonimosFormatados[palavraBase].some(
              s => s.sinonimo === ss.sinonimos.sinonimo
            )
            if (!jaExiste) {
              sinonimosFormatados[palavraBase].push({
                sinonimo: ss.sinonimos.sinonimo.toLowerCase(),
                peso: ss.sinonimos.peso || 10
              })
            }
          }
        })
      }

      console.log(`✅ [Sinônimos] Carregados ${Object.keys(sinonimosFormatados).length} palavras-base com sinônimos do banco`)
      return sinonimosFormatados
    },
    enabled: !!perfilUsuario?.setores_atividades && perfilUsuario.setores_atividades.length > 0,
    staleTime: 1000 * 60 * 60, // Cache por 1 hora
  })

  // Palavras fortes por setor (dinâmico, do banco) para filtro de preferência
  const { data: palavrasFortesPorSetor = {} } = usePalavrasFortes()

  // Estados dos Filtros
  const [filtros, setFiltros] = useState({
    // Essenciais
    buscaObjeto: '', // Campo para INCLUIR palavras (busca normal)
    excluirPalavras: '', // Campo para EXCLUIR palavras (separado)
    uf: '',
    modalidade: '',
    dataPublicacaoInicio: '',
    dataPublicacaoFim: '',
    valorMin: '',
    valorMax: '',
    statusEdital: '', // Em Andamento, Encerrando, Encerrado
    
    // Úteis
    comDocumentos: false,
    comItens: false,
    comValor: false,
    
    // Avançados
    situacao: '',
    esfera: '',
    modoDisputa: '',
    amparoLegal: '',
    
    // Exclusões (o que NÃO quer ver)
    filtrosExclusaoAtivo: false, // Toggle para ativar/desativar filtros de exclusão
    excluirUfs: [], // Array de UFs para excluir
    excluirPalavrasObjeto: [], // Array de palavras para excluir do objeto (ex: "construção", "saúde")
    
    
  })

  const [dataFiltro, setDataFiltro] = useState('')

  // Verificar se veio com data do calendário (query string)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const data = params.get('data')
    if (data) {
      // Converter de YYYYMMDD para YYYY-MM-DD
      const ano = data.substring(0, 4)
      const mes = data.substring(4, 6)
      const dia = data.substring(6, 8)
      const dataFormatada = `${ano}-${mes}-${dia}`
      setDataFiltro(dataFormatada)
      setFiltros(prev => ({
        ...prev,
        dataPublicacaoInicio: dataFormatada,
        dataPublicacaoFim: dataFormatada
      }))
      console.log(`Filtrando licitações do dia: ${dataFormatada}`)
        } else {
      setDataFiltro('')
      console.log('Mostrando todas as licitações')
    }
  }, [location])

 
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtros)
  
  
  useEffect(() => {
    setLimitePagina(50)
  }, [filtrosAplicados, dataFiltro])

  
  useEffect(() => {
    setFiltrosAplicados(prev => ({
      ...prev,
      // Manter buscaObjeto, excluirPalavras, dataPublicacaoInicio e dataPublicacaoFim como estão (só mudam ao clicar em "Aplicar")
      // Atualizar apenas filtros não-texto e não-data
      uf: filtros.uf,
      modalidade: filtros.modalidade,
      statusEdital: filtros.statusEdital,
      valorMin: filtros.valorMin,
      valorMax: filtros.valorMax,
      comDocumentos: filtros.comDocumentos,
      comItens: filtros.comItens,
      comValor: filtros.comValor,
      situacao: filtros.situacao,
      esfera: filtros.esfera,
      modoDisputa: filtros.modoDisputa,
      amparoLegal: filtros.amparoLegal,
    }))
  }, [
    filtros.uf, 
    filtros.modalidade, 
    filtros.statusEdital, 
    filtros.valorMin, 
    filtros.valorMax, 
    filtros.comDocumentos, 
    filtros.comItens, 
    filtros.comValor, 
    filtros.situacao, 
    filtros.esfera, 
    filtros.modoDisputa, 
    filtros.amparoLegal
    // NÃO incluir: filtros.buscaObjeto, filtros.excluirPalavras, filtros.dataPublicacaoInicio, filtros.dataPublicacaoFim
    // Esses campos só são aplicados ao clicar no botão "Aplicar"
  ])

  // Determinar status do edital (definido antes do useMemo)
  // Função auxiliar para extrair documentos de diferentes fontes
  const getDocumentos = useCallback((licitacao) => {
    // Tentar de diferentes lugares na estrutura
    if (licitacao.anexos && Array.isArray(licitacao.anexos) && licitacao.anexos.length > 0) {
      return licitacao.anexos
    }
    
    // Tentar de dados_completos
    if (licitacao.dados_completos) {
      // Pode estar como string JSON ou objeto
      let dadosCompletos = licitacao.dados_completos
      if (typeof dadosCompletos === 'string') {
        try {
          dadosCompletos = JSON.parse(dadosCompletos)
        } catch (e) {
          console.warn('Erro ao parsear dados_completos:', e)
          return []
        }
      }
      
      // Verificar diferentes estruturas possíveis
      if (dadosCompletos.anexos && Array.isArray(dadosCompletos.anexos)) {
        return dadosCompletos.anexos
      }
      if (dadosCompletos.documentos && Array.isArray(dadosCompletos.documentos)) {
        return dadosCompletos.documentos
      }
    }
    
    return []
  }, [])

  // Função para baixar e compactar todos os documentos de uma licitação em ZIP
  const baixarDocumentosComoZip = useCallback(async (licitacao) => {
    try {
      const licitacaoId = licitacao.id || licitacao.numero_controle_pncp
      const numeroControlePNCP = licitacao.numero_controle_pncp
      
      setBaixandoDocumentos(prev => new Set(prev).add(licitacaoId))
      
      console.log('📦 [Download ZIP] Chamando Edge Function para baixar e compactar documentos...')
      
      // Obter token de autenticação
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL não configurado')
      }

      const { supabase } = await import('@/lib/supabase')
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

      // Chamar Edge Function
      const response = await fetch(
        `${supabaseUrl}/functions/v1/baixar-documentos-zip`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            numeroControlePNCP: numeroControlePNCP,
            licitacaoId: licitacao.id,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success || !result.zipBase64) {
        throw new Error(result.error || 'Erro ao processar ZIP')
      }

      console.log(`✅ [Download ZIP] ZIP recebido! ${result.documentosBaixados} documentos baixados`)

      // Converter base64 para blob
      const binaryString = atob(result.zipBase64)
      const len = binaryString.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const zipBlob = new Blob([bytes], { type: 'application/zip' })

      // Criar link de download
      const urlZip = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = urlZip
      link.download = result.nomeArquivo || `Documentos_${numeroControlePNCP}_${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Limpar URL do blob após um tempo
      setTimeout(() => URL.revokeObjectURL(urlZip), 1000)

      console.log(`✅ [Download ZIP] ZIP baixado com sucesso!`)

      if (result.documentosErros > 0) {
        alert(`Download concluído! ${result.documentosBaixados} documentos baixados com sucesso, ${result.documentosErros} documentos não puderam ser baixados.`)
      }
      
      setBaixandoDocumentos(prev => {
        const novo = new Set(prev)
        novo.delete(licitacaoId)
        return novo
      })
    } catch (error) {
      console.error('❌ [Download ZIP] Erro ao baixar ZIP:', error)
      alert(`Erro ao baixar documentos: ${error.message}`)
      setBaixandoDocumentos(prev => {
        const novo = new Set(prev)
        novo.delete(licitacao.id || licitacao.numero_controle_pncp)
        return novo
      })
    }
  }, [])

  // Função auxiliar para extrair itens de diferentes fontes
  const getItens = useCallback((licitacao) => {
    // Tentar de diferentes lugares na estrutura
    if (licitacao.itens && Array.isArray(licitacao.itens) && licitacao.itens.length > 0) {
      return licitacao.itens
    }
    
    // Tentar de dados_completos
    if (licitacao.dados_completos) {
      // Pode estar como string JSON ou objeto
      let dadosCompletos = licitacao.dados_completos
      if (typeof dadosCompletos === 'string') {
        try {
          dadosCompletos = JSON.parse(dadosCompletos)
        } catch (e) {
          console.warn('Erro ao parsear dados_completos:', e)
          return []
        }
      }
      
      // Verificar diferentes estruturas possíveis
      if (dadosCompletos.itens && Array.isArray(dadosCompletos.itens)) {
        return dadosCompletos.itens
      }
    }
    
    return []
  }, [])

  const getStatusEdital = useCallback((licitacao) => {
    // Tentar buscar de diferentes lugares na estrutura JSONB
    let dataAbertura = licitacao.dados_completos?.dataAberturaProposta || 
                        licitacao.dados_completos?.data_abertura_proposta ||
                        licitacao.dados_completos?.dataAberturaPropostaData
    let dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta || 
                             licitacao.dados_completos?.data_encerramento_proposta ||
                             licitacao.dados_completos?.dataEncerramentoPropostaData
    
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0) // Normalizar para comparar apenas datas
    
    // Se tem data de abertura, verificar se ainda não abriu (PRÓXIMO)
    if (dataAbertura) {
      const abertura = new Date(dataAbertura)
      abertura.setHours(0, 0, 0, 0)
      
      // Se ainda não abriu
      if (hoje < abertura) {
        return 'proximo'
      }
    }
    
    // Se tem data de encerramento, verificar status baseado nela
    if (dataEncerramento) {
    const encerramento = new Date(dataEncerramento)
      encerramento.setHours(0, 0, 0, 0)
    const diasRestantes = Math.ceil((encerramento - hoje) / (1000 * 60 * 60 * 24))
    
    // Encerrado
      if (diasRestantes < 0) {
        return 'encerrado'
      }
    
    // Encerrando (3 dias ou menos)
      if (diasRestantes <= 3 && diasRestantes > 0) {
        return 'encerrando'
      }
    
      // Em andamento (se já abriu e ainda não encerrou)
    if (dataAbertura) {
      const abertura = new Date(dataAbertura)
        abertura.setHours(0, 0, 0, 0)
      if (hoje >= abertura && hoje <= encerramento) {
          return 'andamento'
        }
      } else {
        // Se não tem abertura mas tem encerramento no futuro, considerar em andamento
        if (diasRestantes > 0) {
          return 'andamento'
        }
      }
    } else if (dataAbertura) {
      // Se só tem abertura, verificar se já abriu
      const abertura = new Date(dataAbertura)
      abertura.setHours(0, 0, 0, 0)
      if (hoje >= abertura) {
        return 'andamento'
      }
    }

    // Se não tem datas específicas mas tem data de publicação recente, considerar ativa
    if (!dataAbertura && !dataEncerramento && licitacao.data_publicacao_pncp) {
      const publicacao = new Date(licitacao.data_publicacao_pncp)
      publicacao.setHours(0, 0, 0, 0)
      const diasDesdePublicacao = Math.ceil((hoje - publicacao) / (1000 * 60 * 60 * 24))
      if (diasDesdePublicacao <= 30 && diasDesdePublicacao >= 0) {
        return 'andamento'
      }
    }

    return null
  }, [])

  // Buscar favoritos do usuário
  useQuery({
    queryKey: ['meus-favoritos', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await supabase
        .from('licitacoes_favoritas')
        .select('licitacao_id')
        .eq('usuario_id', user.id)
      
      const ids = new Set(data?.map(f => f.licitacao_id) || [])
      setFavoritos(ids)
      return data
    },
    enabled: !!user?.id
  })

  const [ultimoUserId, setUltimoUserId] = useState(null)
  
  const { data: licitacoes = [], isLoading, error } = useQuery({
    queryKey: ['licitacoes-sessao-completa', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { buscarLicitacoesDoBanco, salvarCacheLicitacoes, carregarCacheLicitacoes, limparCacheLicitacoes, limparCacheSemantico } = await import('@/lib/collections/licitacoesStore')
      const mudouUsuario = ultimoUserId && ultimoUserId !== user.id
      if (mudouUsuario) {
        await limparCacheLicitacoes(ultimoUserId)
      }
      setUltimoUserId(user.id)
      const cached = await carregarCacheLicitacoes(user.id)
      if (cached?.length) {
        const LIMITE_RECENTES = 15000
        const licitacoesLimitadas = cached.length > LIMITE_RECENTES ? cached.slice(0, LIMITE_RECENTES) : cached
        if (licitacoesLimitadas.length < cached.length) {
          addLogFiltro(`Cache reutilizado: ${licitacoesLimitadas.length} licitações (limite dos 15 mil mais recentes)`)
        } else {
          addLogFiltro(`Cache reutilizado: ${licitacoesLimitadas.length} licitações (sem novo carregamento)`)
        }
        return licitacoesLimitadas
      }
      setProcessandoFiltro(true)
      setMensagemProgresso('Carregando licitações do banco...')
      addLogFiltro('Carregando licitações do banco...')
      let ultimoLogBanco = 0
      const todasLicitacoes = await buscarLicitacoesDoBanco(
        (buscados, total) => {
          setMensagemProgresso(`Carregando do banco: ${buscados.toLocaleString()} licitações...`)
          if (buscados - ultimoLogBanco >= 5000 || buscados === total) {
            addLogFiltro(`Carregando do banco: ${buscados.toLocaleString()} licitações...`)
            ultimoLogBanco = buscados
          }
        }
      )
      addLogFiltro(`✅ ${todasLicitacoes.length.toLocaleString()} licitações carregadas do banco`)
      await salvarCacheLicitacoes(todasLicitacoes, user.id)
      await limparCacheSemantico(user.id)
      return todasLicitacoes
    },
    enabled: !!user?.id,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  // Estado para licitações filtradas (filtro semântico síncrono)
  const [licitacoesFiltradas, setLicitacoesFiltradas] = useState([])
  
  // Estado para desativar filtro semântico e mostrar todas as licitações
  const [mostrarTodasLicitacoes, setMostrarTodasLicitacoes] = useState(false)
  
  // Limpar blob URLs quando cards fecharem ou componente desmontar
  useEffect(() => {
    return () => {
      // Limpar todos os blob URLs quando componente desmontar
      Object.values(arquivosZipDescompactados).forEach(zipData => {
        if (zipData?.arquivos && Array.isArray(zipData.arquivos)) {
          limparBlobUrls(zipData.arquivos)
        }
      })
    }
  }, [arquivosZipDescompactados])
  
  // Filtrar por status do edital, perfil da empresa e exclusões (assíncrono para IA)
  useEffect(() => {
    const aplicarFiltros = async () => {
      if (!licitacoes || licitacoes.length === 0) {
        setLicitacoesFiltradas([])
        setProcessandoFiltro(false)
        setProgressoPercentual(0)
        return
      }

      // Reusar cache semântico ao voltar de outra aba (evita reprocessar tudo)
      if (!mostrarTodasLicitacoes && user?.id) {
        try {
          const { carregarCacheSemantico } = await import('@/lib/collections/licitacoesStore')
          const cached = await carregarCacheSemantico(user.id)
          if (cached?.licitacoes && cached.licitacoesTotalLength === licitacoes.length) {
            setLicitacoesFiltradas(cached.licitacoes)
            setProcessandoFiltro(false)
            setProgressoPercentual(100)
            addLogFiltro(`Cache reutilizado: ${cached.licitacoes.length} licitações (sem reprocessar)`)
            return
          }
        } catch (e) {
          console.warn('⚠️ [Cache] Erro ao carregar cache semântico:', e)
        }
      }
      
      let resultado = licitacoes
      try {
      // Iniciar processamento do filtro semântico (sempre ao logar)
      if (!mostrarTodasLicitacoes) {
      setProcessandoFiltro(true)
      setProgressoPercentual(10)
      setMensagemProgresso('Iniciando filtro semântico...')
      addLogFiltro('Iniciando filtro semântico...')
      setProgressoPercentual(20)
      setMensagemProgresso('Carregando perfil da empresa...')
      }

    // Se o botão "Mostrar Todas" foi clicado, pular filtro semântico
    if (mostrarTodasLicitacoes) {
      console.log('📋 [Filtro] Modo "Mostrar Todas" ativo - pulando filtro semântico')
      resultado = licitacoes
      setProgressoPercentual(100)
      setMensagemProgresso('Mostrando todas as licitações')
      addLogFiltro('Mostrando todas as licitações (sem filtro por setor)')
    } else {
      // SEMPRE aplicar filtro semântico ao logar (garantir dados corretos do perfil)
    // FILTRO AUTOMÁTICO BASEADO NO PERFIL DA EMPRESA
    if (perfilUsuario) {
      const estadosInteresse = perfilUsuario.estados_interesse || []
      const setoresAtividades = perfilUsuario.setores_atividades || []

      // Filtrar por estados de interesse (apenas se não foi filtrado no banco)
      // Se foi filtrado no banco, pular esta etapa para melhor performance
      const foiFiltradoEstadoNoBanco = perfilUsuario?.estados_interesse && 
                                       perfilUsuario.estados_interesse.length > 0 &&
                                       !perfilUsuario.estados_interesse.some(e => 
                                         typeof e === 'string' ? e === 'Nacional' : e === 'Nacional'
                                       ) &&
                                       !filtrosAplicados.uf
      
      if (!foiFiltradoEstadoNoBanco && estadosInteresse.length > 0) {
        // Se tem "Nacional", não filtrar por estado
        const temNacional = estadosInteresse.some(e => 
          typeof e === 'string' ? e === 'Nacional' : e === 'Nacional'
        )
        
        if (!temNacional) {
          setProgressoPercentual(30)
          setMensagemProgresso(`Filtrando por estados: ${estadosInteresse.join(', ')}...`)
          addLogFiltro(`Filtrando por estados: ${estadosInteresse.join(', ')}`)
          
          resultado = resultado.filter(licitacao => {
            const uf = licitacao.uf_sigla?.toUpperCase()
            return estadosInteresse.some(estado => {
              const estadoUpper = typeof estado === 'string' ? estado.toUpperCase() : estado
              return estadoUpper === uf
            })
          })
          
          setProgressoPercentual(40)
          setMensagemProgresso(`${resultado.length} licitações encontradas nos estados selecionados`)
          addLogFiltro(`${resultado.length} licitações nos estados selecionados`)
        }
      } else if (foiFiltradoEstadoNoBanco) {
        // Já foi filtrado no banco, apenas atualizar progresso
        setProgressoPercentual(40)
        setMensagemProgresso(`${resultado.length} licitações encontradas nos estados selecionados`)
        addLogFiltro(`${resultado.length} licitações nos estados selecionados`)
      }

      // FILTRO OBRIGATÓRIO E RESTRITIVO: Se tem setores cadastrados, DEVE filtrar rigorosamente
      if (setoresAtividades.length > 0) {
        // Obter sinônimos personalizados do perfil (se existirem) - apenas do profile
        const sinonimosPersonalizados = perfilUsuario?.sinonimos_personalizados || {}
        
        // Obter sinônimos do banco de dados (associados aos setores via setores_sinonimos)
        const sinonimosBancoFormatados = sinonimosBanco || {}
        
        // Extrair palavras-chave dos setores (AGORA COM sinônimos do banco)
        // Retorna { principais, secundarias, todas }
        const palavrasChave = extrairPalavrasChaveDosSetores(
          setoresAtividades, 
          sinonimosPersonalizados,
          sinonimosBancoFormatados
        )
        
        // REGRA RESTRITIVA: Se tem setores, DEVE ter palavras-chave válidas
        if (!palavrasChave.todas || palavrasChave.todas.length === 0) {
          console.warn('⚠️ Setores cadastrados mas não foi possível extrair palavras-chave. NÃO MOSTRANDO licitações.')
          setLicitacoesFiltradas([]) // MUITO RESTRITIVO: Não mostra nada se não conseguiu extrair palavras
          return
        }
        
        // FILTRO OBRIGATÓRIO: Filtrar TODAS as licitações que não correspondem
        // Usando IA para validação precisa
        console.log(`🔍 [Filtro] Aplicando filtro semântico com IA`)
        console.log(`🔍 [Filtro] Palavras principais (${palavrasChave.principais.length}):`, palavrasChave.principais.slice(0, 10))
        console.log(`🔍 [Filtro] Palavras secundárias (${palavrasChave.secundarias.length}):`, palavrasChave.secundarias.slice(0, 10))
        console.log(`🔍 [Filtro] Setores cadastrados:`, setoresAtividades.map(s => s.setor).join(', '))
        console.log(`🔍 [Filtro] Usando APENAS filtro semântico (sem IA)`)
        
        const antesFiltro = resultado.length
        
        setProgressoPercentual(50)
        setMensagemProgresso(`Processando ${antesFiltro} licitações...`)
        addLogFiltro(`Processando ${antesFiltro} licitações (filtro por palavras)`)
        
        // Filtrar usando APENAS filtro semântico (sem IA)
        // Processar em lotes para não bloquear a UI (lotes maiores = menos etapas e mais rápido)
        const TAMANHO_LOTE = 200
        const resultadosFiltrados = []
        const totalLotes = Math.ceil(resultado.length / TAMANHO_LOTE)
        
        // Processar lotes de forma assíncrona para não bloquear navegação
        await new Promise(async (resolve) => {
          let indiceAtual = 0
          
          const processarProximoLote = async () => {
            // Verificar se ainda há lotes para processar
            if (indiceAtual >= resultado.length) {
              resolve()
              return
            }
            
            const lote = resultado.slice(indiceAtual, indiceAtual + TAMANHO_LOTE)
            const loteAtual = Math.floor(indiceAtual / TAMANHO_LOTE) + 1
          
          // Atualizar progresso baseado no lote atual (50% a 90%)
          const progressoLote = 50 + Math.floor((loteAtual / totalLotes) * 40)
          setProgressoPercentual(progressoLote)
          
          // Atualizar mensagem de progresso
          setMensagemProgresso(
              `Processando: ${loteAtual}/${totalLotes} lotes (${Math.min(indiceAtual + lote.length, antesFiltro)}/${antesFiltro} licitações)...`
          )
          const percentLote = Math.floor((loteAtual / totalLotes) * 100)
          if (percentLote > 0 && (percentLote % 25 === 0 || loteAtual === totalLotes)) {
            addLogFiltro(`Processando: ${loteAtual}/${totalLotes} lotes (${percentLote}%)`)
          }
          
            // Processar lote atual
          const resultadosLote = await Promise.all(
            lote.map(async (licitacao) => {
              // Usar filtro semântico primeiro (rápido)
              const correspondeSemantico = correspondeAtividades(
                licitacao,
                palavrasChave,
                sinonimosPersonalizados, // Sinônimos personalizados
                sinonimosBancoFormatados, // Sinônimos do banco
                setoresAtividades, // Setores para contexto
                palavrasFortesPorSetor // Palavras fortes dinâmicas (banco)
              )
              
              // Se filtro semântico aceitou, usar diretamente
              if (correspondeSemantico === true) {
                return licitacao
              }
              
              // Se filtro semântico rejeitou, tentar validar com IA (filtro semântico + IA é o padrão)
              if (correspondeSemantico === false) {
                // Verificar se objeto tem palavras-chave relevantes antes de chamar IA
                const objetoCompleto = obterObjetoCompleto(licitacao)
                if (objetoCompleto && setoresAtividades && setoresAtividades.length > 0) {
                  const objetoNormalizado = normalizarTexto(objetoCompleto)
                  
                  const temPalavraChave = palavrasChave.principais.some(palavra => {
                    const palavraNormalizada = normalizarTexto(palavra)
                    if (objetoNormalizado.includes(palavraNormalizada)) return true
                    if (palavraNormalizada.length >= 5 && objetoNormalizado.includes(palavraNormalizada.substring(0, 5))) return true
                    return false
                  })
                  
                  if (temPalavraChave) {
                    try {
                      const { validarCorrespondenciaIAEdgeFunction } = await import('@/lib/validacaoIA')
                      const estadosParaIA = (perfilUsuario?.estados_interesse && !perfilUsuario.estados_interesse.some(e => String(e).toUpperCase() === 'NACIONAL'))
                        ? perfilUsuario.estados_interesse
                        : null
                      const validacaoIA = await validarCorrespondenciaIAEdgeFunction(
                        objetoCompleto,
                        setoresAtividades,
                        user?.id,
                        estadosParaIA
                      )
                      if (validacaoIA === true) {
                        console.log('✅ [IA] Licitação aceita por IA (caso duvidoso):', {
                          objeto: objetoCompleto.substring(0, 100)
                        })
                        return licitacao
                      }
                    } catch (error) {
                      console.warn('⚠️ [IA] Erro ao validar com IA, usando filtro semântico:', error)
                    }
                  }
                }
              }
              
              // Log detalhado para debug (apenas 1% para não poluir console)
              if (!correspondeSemantico && licitacao.objeto_compra && Math.random() < 0.01) {
                console.log(`🚫 [Filtro] Licitação filtrada:`, {
                  objeto: licitacao.objeto_compra.substring(0, 100),
                  palavrasPrincipais: palavrasChave.principais.slice(0, 3)
                })
              }
              
              return null
            })
          )
          
          // Filtrar nulls
          const resultadosFiltradosLote = resultadosLote.filter(Boolean)
          
          resultadosFiltrados.push(...resultadosFiltradosLote)
            
            // Avançar para o próximo lote
            indiceAtual += TAMANHO_LOTE
            
            // Usar setTimeout para permitir que o navegador processe outros eventos
            // Isso evita travar a navegação durante o processamento
            setTimeout(async () => {
              await processarProximoLote()
            }, 0)
          }
          
          // Iniciar processamento
          await processarProximoLote()
        })
        
        resultado = resultadosFiltrados

        // Filtro semântico por IA: validar por significado (padrão quando há setores)
        if (resultado.length > 0 && setoresAtividades?.length > 0) {
          const totalParaIA = resultado.length
          // Aviso se muitas licitações (> 100 pode demorar)
          if (totalParaIA > 100) {
            setMensagemProgresso(`Validando ${totalParaIA} licitações com IA (pode demorar)...`)
            addLogFiltro(`Validando ${totalParaIA} licitações com IA (pode demorar)`)
          } else {
            setMensagemProgresso('Validando com IA (semântico)...')
            addLogFiltro('Validando com IA (semântico)...')
          }
          let ultimoPercentIA = -1
          try {
            const { validarCorrespondenciaIABatch } = await import('@/lib/validacaoIA')
            const estadosParaIA = (perfilUsuario?.estados_interesse && perfilUsuario.estados_interesse.length > 0 &&
              !perfilUsuario.estados_interesse.some(e => String(e).toUpperCase() === 'NACIONAL'))
              ? perfilUsuario.estados_interesse
              : null
            const idsAprovados = await validarCorrespondenciaIABatch(
              resultado,
              setoresAtividades,
              obterObjetoCompleto,
              (validados, total) => {
                const percent = Math.round((validados / total) * 100)
                setMensagemProgresso(`Validando com IA: ${validados}/${total} (${percent}%)`)
                if (percent >= ultimoPercentIA + 25 || percent === 100) {
                  addLogFiltro(`Validando com IA: ${validados}/${total} (${percent}%)`)
                  ultimoPercentIA = percent
                }
              },
              estadosParaIA
            )
            resultado = resultado.filter(lic => idsAprovados.has(lic.id))
            addLogFiltro(`✅ IA aprovou ${idsAprovados.size} licitações por significado`)
            console.log(`✅ [IA Semântico] ${idsAprovados.size} licitações aprovadas por significado`)
          } catch (err) {
            console.warn('⚠️ [IA] Erro no filtro semântico por IA:', err)
            addLogFiltro('⚠️ Erro ao validar com IA', 'warn')
          }
        }
        
        // Salvar resultado no cache para reutilizar ao voltar de outra aba (evita reprocessar)
        if (user?.id) {
          const { salvarCacheSemantico } = await import('@/lib/collections/licitacoesStore')
          await salvarCacheSemantico(resultado, user.id, licitacoes.length)
        }
        
        setProgressoPercentual(90)
        setMensagemProgresso(`Filtro concluído! ${resultado.length} licitações encontradas.`)
        addLogFiltro(`Filtro concluído! ${resultado.length} licitações encontradas.`)
        
        const depoisFiltro = resultado.length
        const percentualRemovido = antesFiltro > 0 ? ((1 - depoisFiltro/antesFiltro) * 100).toFixed(1) : 0
        console.log(`✅ [Filtro Semântico] Filtrado: ${antesFiltro} → ${depoisFiltro} licitações (${percentualRemovido}% removidas) - Salvo no cache`)
      } else {
        // Se NÃO tem setores cadastrados, NÃO MOSTRAR NADA (muito restritivo)
        console.warn('⚠️ Empresa sem setores cadastrados. NÃO MOSTRANDO licitações até configurar setores.')
        setProgressoPercentual(100)
        setMensagemProgresso('⚠️ Configure setores e estados no seu perfil')
        addLogFiltro('⚠️ Configure setores e estados no seu perfil', 'warn')
        setTimeout(() => {
          setProcessandoFiltro(false)
          setProgressoPercentual(0)
        }, 2000)
        resultado = []
      }
    } else {
      // Se não tem perfil, não processar filtro
      setProcessandoFiltro(false)
      setProgressoPercentual(0)
    }
    } // Fim do else do mostrarTodasLicitacoes

    // Filtrar por status do edital
    if (filtrosAplicados.statusEdital) {
      const antesStatus = resultado.length
      resultado = resultado.filter(licitacao => {
        // Se filtro for "urgente", usar função isUrgente
        if (filtrosAplicados.statusEdital === 'urgente') {
          return isUrgente(licitacao)
        }
        
        // Para outros status, usar getStatusEdital
        const status = getStatusEdital(licitacao)
        return status === filtrosAplicados.statusEdital
      })
      const depoisStatus = resultado.length
      console.log(`📊 [Filtro Status] ${antesStatus - depoisStatus} licitações removidas. ${depoisStatus} restantes. Status: ${filtrosAplicados.statusEdital}`)
    }

    // Filtrar por UF
    if (filtrosAplicados.uf && filtrosAplicados.uf.trim()) {
      const antesUF = resultado.length
      resultado = resultado.filter(licitacao => {
        return licitacao.uf_sigla?.toUpperCase() === filtrosAplicados.uf.toUpperCase()
      })
      console.log(`🗺️ [Filtro UF] ${antesUF - resultado.length} licitações removidas. ${resultado.length} restantes. UF: ${filtrosAplicados.uf}`)
    }

    // Filtrar por modalidade
    if (filtrosAplicados.modalidade && filtrosAplicados.modalidade.trim()) {
      const antesModalidade = resultado.length
        resultado = resultado.filter(licitacao => {
        return licitacao.modalidade_nome === filtrosAplicados.modalidade
      })
      console.log(`📋 [Filtro Modalidade] ${antesModalidade - resultado.length} licitações removidas. ${resultado.length} restantes. Modalidade: ${filtrosAplicados.modalidade}`)
    }

    // Filtrar por valor (min e max)
    if (filtrosAplicados.valorMin || filtrosAplicados.valorMax) {
      const antesValor = resultado.length
      resultado = resultado.filter(licitacao => {
        const valor = licitacao.valor_total_estimado || 0
        
        if (filtrosAplicados.valorMin && valor < parseFloat(filtrosAplicados.valorMin)) {
          return false
        }
        
        if (filtrosAplicados.valorMax && valor > parseFloat(filtrosAplicados.valorMax)) {
          return false
        }
        
        return true
      })
      console.log(`💰 [Filtro Valor] ${antesValor - resultado.length} licitações removidas. ${resultado.length} restantes. Intervalo: ${filtrosAplicados.valorMin || 'min'} - ${filtrosAplicados.valorMax || 'max'}`)
    }

    // Filtrar por documentos (deve ter documentos)
    if (filtrosAplicados.comDocumentos) {
      const antesDocs = resultado.length
      resultado = resultado.filter(licitacao => {
        const docs = getDocumentos(licitacao)
        return docs && docs.length > 0
      })
      console.log(`📄 [Filtro Com Documentos] ${antesDocs - resultado.length} licitações removidas. ${resultado.length} restantes.`)
    }

    // Filtrar por itens (deve ter itens)
    if (filtrosAplicados.comItens) {
      const antesItens = resultado.length
      resultado = resultado.filter(licitacao => {
        return licitacao.itens && Array.isArray(licitacao.itens) && licitacao.itens.length > 0
      })
      console.log(`📦 [Filtro Com Itens] ${antesItens - resultado.length} licitações removidas. ${resultado.length} restantes.`)
    }

    // Filtrar por valor (deve ter valor)
    if (filtrosAplicados.comValor) {
      const antesComValor = resultado.length
      resultado = resultado.filter(licitacao => {
        const valor = licitacao.valor_total_estimado
        return valor && valor > 0
      })
      console.log(`💵 [Filtro Com Valor] ${antesComValor - resultado.length} licitações removidas. ${resultado.length} restantes.`)
    }

    // Busca Rápida (INCLUIR) - FILTRO INTELIGENTE
    // Busca exclusivamente nos dados do cache IndexedDB (não busca no banco)
    // Busca em TODOS os campos relevantes do objeto do edital:
    // - objeto_compra (principal)
    // - orgao_razao_social, numero_controle_pncp, modalidade_nome
    // - unidade_nome, municipio_nome, uf_sigla
    // - dados_completos (objeto JSON com campos extras)
    // - itens do edital (descrição, material, serviço, marca, especificação)
    // 
    // Características:
    // - Case-insensitive (ignora maiúsculas/minúsculas)
    // - Ignora acentos
    // - Busca por similaridade (tolerante a erros de digitação)
    // - Suporta múltiplas palavras separadas por vírgula (OR lógico)
    // - Threshold 0.62: balanceado entre precisão e recall
    // - Aplicado apenas ao clicar no botão "Aplicar" (melhor performance)
    if (filtrosAplicados.buscaObjeto && filtrosAplicados.buscaObjeto.trim()) {
      const antesBusca = resultado.length
      resultado = filtrarLicitacoesPorBusca(resultado, filtrosAplicados.buscaObjeto, 0.62)
      const encontradas = resultado.length
      const termos = filtrosAplicados.buscaObjeto.split(',').map(t => t.trim()).filter(t => t)
      console.log(`🔍 [Busca Rápida INCLUIR] "${filtrosAplicados.buscaObjeto}" → ${encontradas}/${antesBusca} licitações encontradas (${termos.length} termo${termos.length > 1 ? 's' : ''})`)
    }

    // Excluir Palavras (EXCLUIR) - FILTRO INTELIGENTE DE EXCLUSÃO
    // Remove licitações do cache que contêm qualquer uma das palavras de exclusão
    // Busca exclusivamente nos dados do cache IndexedDB (mesmos campos da busca rápida)
    // 
    // Lógica: Se uma licitação contém QUALQUER uma das palavras de exclusão em QUALQUER campo,
    // ela é REMOVIDA do resultado
    // 
    // Características:
    // - Case-insensitive (ignora maiúsculas/minúsculas)
    // - Ignora acentos
    // - Busca por similaridade (tolerante a erros de digitação)
    // - Suporta múltiplas palavras separadas por vírgula
    // - Threshold 0.72: mais restritivo para evitar exclusões indevidas (precisão > recall)
    // - Busca nos mesmos campos da busca rápida (objeto, órgão, itens, etc)
    // - Aplicado apenas ao clicar no botão "Aplicar" (melhor performance)
    if (filtrosAplicados.excluirPalavras && filtrosAplicados.excluirPalavras.trim()) {
      // Dividir por vírgula ou quebra de linha e limpar cada termo
      const termosExclusao = filtrosAplicados.excluirPalavras
        .split(/[,\n]/)
        .map(termo => termo.trim())
        .filter(termo => termo.length > 0)
        .flatMap(termo => {
          // Se termo tem espaços sem vírgula, manter como termo único
          return termo.includes(' ') && !termo.includes(',') ? [termo] : termo.split(/\s+/).filter(w => w.length > 0)
        })
        .filter(termo => termo.length > 0)
      
      if (termosExclusao.length > 0) {
        const antesExclusao = resultado.length
        resultado = resultado.filter(licitacao => {
          // Verificar se contém ALGUMA das palavras de exclusão em QUALQUER campo do objeto do edital
          // Threshold 0.72: mais restritivo para evitar excluir incorretamente
          const contemAlgumaPalavraExclusao = termosExclusao.some(termo => 
            buscarEmLicitacao(licitacao, termo, 0.72)
          )
          
          // Retornar apenas licitações que NÃO contêm nenhuma palavra de exclusão
          return !contemAlgumaPalavraExclusao
        })
        const excluidas = antesExclusao - resultado.length
        const percentualExcluido = antesExclusao > 0 ? ((excluidas / antesExclusao) * 100).toFixed(1) : 0
        console.log(`🚫 [Excluir Palavras EXCLUIR] "${filtrosAplicados.excluirPalavras}" → ${excluidas} excluídas (${percentualExcluido}%), ${resultado.length} licitações restantes`)
      }
    }

    // Filtros de exclusão removidos temporariamente - será repensado

    // Filtro automático: Apenas licitações dos últimos 7 dias
    // Trabalhando exclusivamente com dados do cache IndexedDB (não busca no banco)
    const antesData = resultado.length
    
    // Função auxiliar para normalizar data (apenas data, sem hora)
    // Aceita diferentes formatos: ISO string, timestamp, DD/MM/YYYY, YYYY-MM-DD, etc.
    const normalizarData = (dataStr) => {
      if (!dataStr) return null
      try {
        // Se já está no formato YYYY-MM-DD (apenas data), retornar direto
        if (typeof dataStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataStr.trim())) {
          return dataStr.trim()
        }
        
        // Tentar criar objeto Date (funciona com ISO, timestamp, etc)
        let data = null
        
        // Tentar DD/MM/YYYY primeiro (formato brasileiro comum)
        const matchDDMMYYYY = String(dataStr).match(/^(\d{2})\/(\d{2})\/(\d{4})/)
        if (matchDDMMYYYY) {
          const [, dia, mes, ano] = matchDDMMYYYY
          data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia))
          if (!isNaN(data.getTime())) {
            const anoNorm = data.getFullYear()
            const mesNorm = String(data.getMonth() + 1).padStart(2, '0')
            const diaNorm = String(data.getDate()).padStart(2, '0')
            return `${anoNorm}-${mesNorm}-${diaNorm}`
          }
        }
        
        // Tentar como Date normal (ISO, timestamp, etc)
        data = new Date(dataStr)
        if (isNaN(data.getTime())) {
          return null
        }
        
        // Retornar apenas YYYY-MM-DD para comparação precisa
        // Usar UTC para evitar problemas de timezone
        const ano = data.getUTCFullYear()
        const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
        const dia = String(data.getUTCDate()).padStart(2, '0')
        return `${ano}-${mes}-${dia}`
      } catch (e) {
        return null
      }
    }
    
    // Verificar se campos de data foram preenchidos manualmente
    const temDataManual = filtrosAplicados.dataPublicacaoInicio || filtrosAplicados.dataPublicacaoFim
    
    let dataInicioNormalizada = null
    let dataFimNormalizada = null
    
    if (temDataManual) {
      // Usar datas do filtro manual
      dataInicioNormalizada = filtrosAplicados.dataPublicacaoInicio 
        ? normalizarData(filtrosAplicados.dataPublicacaoInicio)
        : null
      dataFimNormalizada = filtrosAplicados.dataPublicacaoFim
        ? normalizarData(filtrosAplicados.dataPublicacaoFim)
        : null
        } else {
      // Filtro automático: Apenas licitações dos últimos 7 dias
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0) // Resetar hora para comparar apenas data
      const seteDiasAtras = new Date(hoje)
      seteDiasAtras.setDate(hoje.getDate() - 7)
      
      // Normalizar data mínima para YYYY-MM-DD
      dataInicioNormalizada = normalizarData(seteDiasAtras.toISOString().split('T')[0])
      dataFimNormalizada = normalizarData(hoje.toISOString().split('T')[0])
    }
    
    if (dataInicioNormalizada || dataFimNormalizada) {
      // Debug: Log para entender o problema
      console.log(`📅 [Filtro Data] Aplicando filtro:`, {
        temDataManual,
        dataInicioNormalizada,
        dataFimNormalizada,
        totalAntes: antesData
      })
      
      // Debug: Verificar amostras de datas ANTES do filtro
      const amostrasAntes = resultado.slice(0, Math.min(5, antesData))
      console.log(`📅 [Filtro Data] Amostras ANTES:`, amostrasAntes.map(l => ({
        numero: l.numero_controle_pncp?.substring(0, 30),
        dataOriginal: l.data_publicacao_pncp,
        dataNormalizada: normalizarData(l.data_publicacao_pncp),
        tipo: typeof l.data_publicacao_pncp
      })))
      
      resultado = resultado.filter(licitacao => {
        if (!licitacao.data_publicacao_pncp) {
          // Se não tem data, excluir
          return false
        }
        
        // Normalizar data da licitação
        const dataPublicacaoNormalizada = normalizarData(licitacao.data_publicacao_pncp)
        if (!dataPublicacaoNormalizada) {
          // Se não conseguiu normalizar, excluir
          return false
        }
        
        // Verificar se está dentro do intervalo (inclusive)
        let dentroIntervalo = true
        
        if (dataInicioNormalizada) {
          // dataPublicacao >= dataInicio (inclusive)
          if (dataPublicacaoNormalizada < dataInicioNormalizada) {
            dentroIntervalo = false
          }
        }
        
        if (dataFimNormalizada && dentroIntervalo) {
          // dataPublicacao <= dataFim (inclusive)
          if (dataPublicacaoNormalizada > dataFimNormalizada) {
            dentroIntervalo = false
          }
        }
        
        return dentroIntervalo
      })
      
      const depoisData = resultado.length
      const removidas = antesData - depoisData
      const periodo = temDataManual 
        ? `${filtrosAplicados.dataPublicacaoInicio || 'início'} a ${filtrosAplicados.dataPublicacaoFim || 'fim'}`
        : `últimos 7 dias (${dataInicioNormalizada} a ${dataFimNormalizada})`
      console.log(`📅 [Filtro Data] ${removidas} licitações removidas. ${depoisData} restantes. Período: ${periodo}`)
      
      // Debug: Verificar amostras DEPOIS do filtro
      if (depoisData > 0) {
        const amostrasDepois = resultado.slice(0, Math.min(3, depoisData))
        console.log(`📅 [Filtro Data] Amostras DEPOIS:`, amostrasDepois.map(l => ({
          numero: l.numero_controle_pncp?.substring(0, 30),
          dataOriginal: l.data_publicacao_pncp,
          dataNormalizada: normalizarData(l.data_publicacao_pncp)
        })))
      }
    } else {
      console.warn('⚠️ [Filtro Data] Datas não normalizadas, pulando filtro:', {
        temDataManual,
        dataInicioNormalizada,
        dataFimNormalizada
      })
    }

    // Aplicar filtros finais
    if (processandoFiltro) {
      setMensagemProgresso('Aplicando filtros finais...')
      addLogFiltro('Aplicando filtros finais...')
    }

    // REMOVIDO: Cache final não é mais necessário
    // Já temos cache semântico no IndexedDB que é suficiente
    // O cache final estava causando problemas de quota no localStorage
    // Todos os filtros agora funcionam diretamente no cache semântico do IndexedDB

    setLicitacoesFiltradas(resultado)
    
    // Finalizar processamento
    if (processandoFiltro) {
      setProgressoPercentual(100)
      setMensagemProgresso(`✅ ${resultado.length} licitação${resultado.length !== 1 ? 'ões' : ''} encontrada${resultado.length !== 1 ? 's' : ''}`)
      addLogFiltro(`✅ ${resultado.length} licitação${resultado.length !== 1 ? 'ões' : ''} encontrada${resultado.length !== 1 ? 's' : ''}`)
      
      // Aguardar um momento para mostrar mensagem de sucesso, depois esconder
      setTimeout(() => {
        setProcessandoFiltro(false)
        setMensagemProgresso('')
        setProgressoPercentual(0)
      }, 1500)
    }
      } catch (err) {
        console.error('[Filtro] Erro ao aplicar filtros:', err)
        addLogFiltro('Erro ao aplicar filtros. Exibindo resultado parcial.', 'warn')
        setLicitacoesFiltradas(resultado ?? [])
        setProcessandoFiltro(false)
        setProgressoPercentual(0)
        setMensagemProgresso('')
      }
  }
    
    aplicarFiltros()
  }, [
    licitacoes, 
    filtrosAplicados, // Todos os filtros aplicados (campos texto só mudam ao clicar em "Aplicar", outros são imediatos)
    perfilUsuario, 
    mostrarTodasLicitacoes,
    sinonimosBanco,
    dataFiltro
  ])

  // Licitações finais (sem filtros permanentes)
  const licitacoesFinais = licitacoesFiltradas

  // Log para debug do filtro automático baseado no perfil (após todas as declarações)
  useEffect(() => {
    if (perfilUsuario && licitacoes.length > 0) {
      const estados = perfilUsuario.estados_interesse || []
      const setores = perfilUsuario.setores_atividades || []
      if (estados.length > 0 || setores.length > 0) {
        console.log('🎯 Filtro automático baseado no perfil:', {
          estados: estados.length,
          setores: setores.length,
          totalLicitacoes: licitacoes.length,
          aposFiltroPerfil: licitacoesFiltradas.length,
          licitacoesFinais: licitacoesFinais.length
        })
      }
    }
  }, [perfilUsuario, licitacoes.length, licitacoesFiltradas.length, licitacoesFinais.length])

  const formatarValor = (valor) => {
    if (!valor) return 'Não informado'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarData = (data) => {
    if (!data) return 'Não informada'
    return format(new Date(data), "dd/MM/yyyy", { locale: ptBR })
        }
        
  // Verificar se licitação é urgente (menos de 7 dias para abertura)
  const isUrgente = (licitacao) => {
    // PRIORIDADE 1: Tentar buscar de diferentes lugares na estrutura JSONB
    let dataAbertura = licitacao.dados_completos?.dataAberturaProposta || 
                        licitacao.dados_completos?.data_abertura_proposta ||
                        licitacao.dados_completos?.dataAberturaPropostaData
    let dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta || 
                             licitacao.dados_completos?.data_encerramento_proposta ||
                             licitacao.dados_completos?.dataEncerramentoPropostaData
    
    // PRIORIDADE 2: Se não encontrou no JSONB, usar data_publicacao_pncp como fallback
    // Considerar urgente se foi publicada recentemente (últimos 3 dias)
    if (!dataAbertura && !dataEncerramento && licitacao.data_publicacao_pncp) {
      const hoje = new Date()
      const publicacao = new Date(licitacao.data_publicacao_pncp)
      const diasDesdePublicacao = Math.ceil((hoje - publicacao) / (1000 * 60 * 60 * 24))
      
      // Urgente se foi publicada nos últimos 3 dias
      return diasDesdePublicacao >= 0 && diasDesdePublicacao <= 3
    }
        
    const dataReferencia = dataAbertura || dataEncerramento

    if (!dataReferencia) return false

    const hoje = new Date()
    const dataLimite = new Date(dataReferencia)
    const diasRestantes = Math.ceil((dataLimite - hoje) / (1000 * 60 * 60 * 24))

    // Urgente se falta menos de 7 dias
    return diasRestantes > 0 && diasRestantes <= 7
  }


  // Toggle favorito
  const toggleFavorito = useMutation({
    mutationFn: async (licitacao) => {
      if (!user?.id) {
        warning('Faça login para favoritar licitações')
        return
      }

      // Verificar se o usuário existe na tabela profiles
      const { data: usuarioExiste, error: erroUsuario } = await supabase
        .from('profiles')
          .select('id')
        .eq('id', user.id)
          .maybeSingle()
        
      if (erroUsuario || !usuarioExiste) {
        console.error('❌ Usuário não encontrado na tabela profiles:', erroUsuario)
        showError('Sua sessão expirou. Por favor, faça login novamente.')
        // Limpar sessão inválida
        const { clearUser } = useUserStore.getState()
        clearUser()
        localStorage.removeItem('user')
        localStorage.removeItem('session')
        throw new Error('Usuário não encontrado')
      }

      const isFavorito = favoritos.has(licitacao.id)

      if (isFavorito) {
        // Remover
        console.log('🗑️ Removendo dos favoritos...')
        const { error } = await supabase
          .from('licitacoes_favoritas')
          .delete()
          .eq('usuario_id', user.id)
          .eq('licitacao_id', licitacao.id)
        
        if (error) {
          console.error('Erro ao remover:', error)
          throw error
        }
        console.log('Removido dos favoritos')
      } else {
        // Verificar se já existe (evitar 409)
        console.log('Verificando se já existe...')
        const { data: existente } = await supabase
        .from('licitacoes_favoritas')
        .select('id')
        .eq('usuario_id', user.id)
          .eq('licitacao_id', licitacao.id)
        .maybeSingle()

        if (existente) {
          console.log('Já existe nos favoritos')
          return { licitacaoId: licitacao.id, isFavorito: false }
        }

        // Adicionar
        console.log('Adicionando aos favoritos...')
        const { error } = await supabase
          .from('licitacoes_favoritas')
          .insert({
            usuario_id: user.id,
            licitacao_id: licitacao.id,
            data_adicao: new Date().toISOString()
          })

        if (error) {
          console.error('Erro ao adicionar:', error)
          // Tratamento específico para erro de foreign key
          if (error.code === '23503') {
            showError('Erro ao favoritar: sua sessão pode ter expirado. Por favor, faça login novamente.')
            // Limpar sessão inválida
            const { clearUser } = useUserStore.getState()
            clearUser()
            localStorage.removeItem('user')
            localStorage.removeItem('session')
          }
          throw error
        }
        console.log('Adicionado aos favoritos')
      }

      return { licitacaoId: licitacao.id, isFavorito }
    },
    onSuccess: ({ licitacaoId, isFavorito }) => {
      // Atualizar estado local
      setFavoritos(prev => {
        const newSet = new Set(prev)
        if (isFavorito) {
          newSet.delete(licitacaoId)
        } else {
          newSet.add(licitacaoId)
        }
        return newSet
      })
      queryClient.invalidateQueries(['meus-favoritos'])
      success(isFavorito ? 'Removido dos favoritos' : 'Adicionado aos favoritos')
    },
    onError: (error) => {
      console.error('❌ Erro ao atualizar favorito:', error)
      if (error.message !== 'Usuário não encontrado') {
        showError('Erro ao atualizar favorito. Tente novamente.')
      }
    }
  })

  const handleFavoritar = (e, licitacao) => {
    e.stopPropagation()
    toggleFavorito.mutate(licitacao)
  }

  const toggleCardExpandido = async (e, licitacaoId, licitacao) => {
    e.stopPropagation()
    
    const estaExpandido = cardsExpandidos.has(licitacaoId)
    
    setCardsExpandidos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(licitacaoId)) {
        newSet.delete(licitacaoId)
      } else {
        newSet.add(licitacaoId)
      }
      return newSet
    })
    
  }


  // Obter CNAEs da empresa logada
  const cnaesEmpresa = useMemo(() => {
    if (!user) return []
    
    const cnaes = []
    
    // CNAE Principal (sempre primeiro)
    if (user.cnae_principal) {
      const codigoNormalizado = normalizarCodigoCnae(user.cnae_principal)
      if (codigoNormalizado) {
        cnaes.push({
          codigo: codigoNormalizado,
          tipo: 'principal'
        })
      }
    }
    
    // CNAEs Secundários (TODOS os secundários cadastrados)
    try {
      if (user.cnaes_secundarios) {
        let cnaesSecundarios = []
        
        // Parsear se for string JSON
        if (typeof user.cnaes_secundarios === 'string') {
          try {
            cnaesSecundarios = JSON.parse(user.cnaes_secundarios)
          } catch (e) {
            console.warn('Erro ao parsear CNAEs secundários como JSON:', e)
          }
        } else if (Array.isArray(user.cnaes_secundarios)) {
          cnaesSecundarios = user.cnaes_secundarios
        }
        
        // Adicionar TODOS os secundários (sem limite)
        cnaesSecundarios.forEach(cnae => {
          // Se cnae é string (código direto) ou objeto com código
          const codigo = typeof cnae === 'string' ? cnae : (cnae?.codigo || cnae)
          const codigoNormalizado = normalizarCodigoCnae(codigo)
          
          if (codigoNormalizado && !cnaes.find(c => c.codigo === codigoNormalizado)) {
            cnaes.push({
              codigo: codigoNormalizado,
              tipo: 'secundario'
            })
          }
        })
      }
    } catch (e) {
      console.warn('Erro ao processar CNAEs secundários:', e)
    }
    
    return cnaes
  }, [user])

  // Lista de CNAEs da empresa com nomes completos (TODOS os cadastrados)
  const listaCnaesEmpresa = useMemo(() => {
    try {
      if (!cnaesEmpresa || cnaesEmpresa.length === 0) {
        return []
      }
      
      // Ordenar: principal primeiro, depois secundários
      const ordenados = [...cnaesEmpresa].sort((a, b) => {
        if (a.tipo === 'principal') return -1
        if (b.tipo === 'principal') return 1
        return 0
      })
      
      // Buscar nome completo de cada CNAE (TODOS, sem limite)
      return ordenados.map(cnae => {
        const nomeCompleto = obterNomeAtividadeCnae(cnae.codigo)
        return {
          codigo: cnae.codigo,
          nome: nomeCompleto || `CNAE ${cnae.codigo}`, // Fallback se não encontrar nome
          tipo: cnae.tipo || 'secundario'
        }
      })
    } catch (error) {
      console.error('Erro ao obter lista de CNAEs da empresa:', error)
      return []
    }
  }, [cnaesEmpresa])


  const limparFiltros = () => {
    // IMPORTANTE: Apenas resetar filtros - NÃO buscar do banco
    // O useEffect vai automaticamente reagir e aplicar no cache semântico
    
    // Resetar todos os filtros
    const filtrosLimpos = {
      buscaObjeto: '',
      excluirPalavras: '',
      uf: '',
      modalidade: '',
      statusEdital: '',
      dataPublicacaoInicio: '',
      dataPublicacaoFim: '',
      valorMin: '',
      valorMax: '',
      comDocumentos: false,
      comItens: false,
      comValor: false,
      situacao: '',
      esfera: '',
      modoDisputa: '',
      amparoLegal: '',
      excluirUfs: [],
      excluirPalavrasObjeto: [],
      filtrosExclusaoAtivo: false
    }
    
    setFiltros(filtrosLimpos)
    // Também atualizar filtrosAplicados para aplicar imediatamente ao limpar
    setFiltrosAplicados(filtrosLimpos)
    setDataFiltro('')
    setMostrarTodasLicitacoes(false) // Desativar modo "mostrar todas"
    
    // REMOVIDO: Não precisa limpar cache de filtros no localStorage
    // O cache semântico está no IndexedDB e não precisa ser limpo ao limpar filtros
    // Os filtros agora funcionam diretamente no cache semântico
    
    // NÃO invalidar queries - manter cache do banco
    // NÃO fazer refetch - usar cache existente
    
    // O useEffect vai automaticamente reagir aos filtros limpos
    // e aplicar no cache semântico que já está carregado
    
    window.history.pushState({}, '', '/licitacoes')
    console.log('✅ [Limpar Filtros] Filtros resetados - aplicando no cache semântico (sem buscar do banco)')
  }

  const handleAplicarFiltros = () => {
    // Desativar modo "mostrar todas" quando aplicar filtros
    setMostrarTodasLicitacoes(false)
    
    // Aplicar TODOS os filtros (incluindo campos de texto) ao clicar no botão
    // Isso melhora muito a performance, processando apenas quando o usuário quiser
    setFiltrosAplicados(filtros)
    
    // NÃO invalidar queries - trabalhar apenas com cache
    // O useEffect vai automaticamente reagir e aplicar os filtros no cache
    
    console.log('🔍 [Aplicar Filtros] Aplicando filtros no cache (incluindo busca rápida e exclusão):', {
      buscaObjeto: filtros.buscaObjeto,
      excluirPalavras: filtros.excluirPalavras,
      outrosFiltros: {
        uf: filtros.uf,
        modalidade: filtros.modalidade,
        statusEdital: filtros.statusEdital,
        // ... outros
      }
    })
  }

  const contarFiltrosAtivos = () => {
    let count = 0
    if (filtros.buscaObjeto) count++
    if (filtros.excluirPalavras) count++
    if (filtros.uf) count++
    if (filtros.modalidade) count++
    if (filtros.statusEdital) count++
    if (filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim) count++
    if (filtros.valorMin || filtros.valorMax) count++
    if (filtros.comDocumentos) count++
    if (filtros.comItens) count++
    if (filtros.comValor) count++
    if (dataFiltro) count++
    return count
  }


    return (
    <AppLayout 
      onToggleFiltros={() => setFiltrosSidebarAberta(!filtrosSidebarAberta)}
      filtrosAbertos={filtrosSidebarAberta}
    >
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar de Filtros (Fixed, à esquerda do conteúdo) */}
        <aside 
          className={`
            ${filtrosSidebarAberta ? 'w-[420px]' : 'w-0'}
            flex-shrink-0 bg-white border-r border-gray-200
            transition-all duration-300 ease-in-out
            overflow-hidden h-full
          `}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#e5e7eb transparent'
          }}
        >
          <div className="w-[420px] h-full overflow-y-auto p-6 space-y-6 filtros-sidebar">
            {/* Header Filtros */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Filter className="w-6 h-6 text-orange-500" />
                {contarFiltrosAtivos() > 0 && (
                  <Badge className="bg-orange-500">{contarFiltrosAtivos()}</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltrosSidebarAberta(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
                
            {/* Botões Ação */}
            <div className="flex flex-col gap-2 mb-6">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={limparFiltros}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpar
                </Button>
                <Button
                  onClick={handleAplicarFiltros}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Aplicar
                </Button>
            </div>
              {/* Toggle Mostrar Todas */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <Label htmlFor="mostrar-todas" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Mostrar Todas (Sem Filtro)
                  </Label>
          </div>
                <Switch
                  id="mostrar-todas"
                  checked={mostrarTodasLicitacoes}
                  onCheckedChange={(checked) => {
                    setMostrarTodasLicitacoes(checked)
                    if (checked) {
                      // NÃO invalidar queries - manter cache do banco
                      console.log('[Filtro] Modo "Mostrar Todas" ATIVADO - usando cache do banco')
                    } else {
                      // NÃO invalidar queries - usar cache semântico
                      console.log('[Filtro] Modo "Mostrar Todas" DESATIVADO - voltando ao cache semântico')
                    }
                  }}
                  className="data-[state=checked]:bg-blue-400"
                />
            </div>
          </div>

            {/* Busca Rápida (INCLUIR) */}
            <div className="mb-4">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-orange-500" />
                  Busca Rápida
                </Label>
              <Input
                placeholder="Buscar por objeto, órgão, número de controle ou modalidade... (separar múltiplas palavras por vírgula)"
                value={filtros.buscaObjeto}
                onChange={(e) => setFiltros({ ...filtros, buscaObjeto: e.target.value })}
                className="h-10"
              />
              {filtros.buscaObjeto && filtros.buscaObjeto.includes(',') && (
                <p className="text-xs text-gray-500 mt-1">
                  Buscando por qualquer uma das palavras: {filtros.buscaObjeto.split(',').map(t => t.trim()).filter(t => t).map((termo, idx, arr) => (
                    <span key={idx}>
                      <strong>"{termo}"</strong>
                      {idx < arr.length - 1 && ', '}
                </span>
                  ))}
                </p>
              )}
            </div>

            {/* Excluir Palavras (EXCLUIR) */}
            <div className="mb-4">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4 text-red-500" />
                Excluir Palavras
              </Label>
              <Input
                placeholder="Excluir licitações que contêm... (separar múltiplas palavras por vírgula)"
                value={filtros.excluirPalavras}
                onChange={(e) => setFiltros({ ...filtros, excluirPalavras: e.target.value })}
                className="h-10"
              />
              {filtros.excluirPalavras && (
                  <p className="text-xs text-gray-500 mt-1">
                  Mostrando apenas licitações que <strong>NÃO</strong> contêm: {filtros.excluirPalavras.split(',').map(t => t.trim()).filter(t => t).map((termo, idx, arr) => (
                    <span key={idx}>
                      <strong>"{termo}"</strong>
                      {idx < arr.length - 1 && ', '}
                    </span>
                  ))}
                </p>
                )}
              </div>
                
            {/* Accordion com Filtros */}
            <Accordion type="multiple" defaultValue={['filtros']}>
              
              {/* FILTROS - Todos os filtros consolidados */}
              <AccordionItem value="filtros">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-orange-500" />
                    Filtros
      </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-3">
                
                  {/* Data Publicação */}
                <div>
                    <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      Data Publicação
                  </Label>
                    <div className="flex gap-2 mb-2">
                  <Input
                        type="date"
                        value={filtros.dataPublicacaoInicio}
                        onChange={(e) => setFiltros({ ...filtros, dataPublicacaoInicio: e.target.value })}
                        className="h-9 text-xs"
                      />
                      <Input
                        type="date"
                        value={filtros.dataPublicacaoFim}
                        onChange={(e) => setFiltros({ ...filtros, dataPublicacaoFim: e.target.value })}
                        className="h-9 text-xs"
                      />
          </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Deixe vazio para mostrar apenas os últimos 7 dias
                    </p>
                </div>
                
                  {/* UF */}
                <div>
                    <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      Estado (UF)
                    </Label>
                    <Select value={filtros.uf || "TODOS"} onValueChange={(value) => setFiltros({ ...filtros, uf: value === "TODOS" ? "" : value })}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="TODOS">Todos os Estados</SelectItem>
                        {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Modalidade */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                    Modalidade
                  </Label>
                    <Select value={filtros.modalidade || "TODAS"} onValueChange={(value) => setFiltros({ ...filtros, modalidade: value === "TODAS" ? "" : value })}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione a modalidade" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="TODAS">Todas as Modalidades</SelectItem>
                        <SelectItem value="Pregão Eletrônico">Pregão Eletrônico</SelectItem>
                        <SelectItem value="Pregão Presencial">Pregão Presencial</SelectItem>
                        <SelectItem value="Concorrência Eletrônica">Concorrência Eletrônica</SelectItem>
                        <SelectItem value="Concorrência">Concorrência</SelectItem>
                        <SelectItem value="Dispensa Eletrônica">Dispensa Eletrônica</SelectItem>
                        <SelectItem value="Dispensa de Licitação">Dispensa de Licitação</SelectItem>
                        <SelectItem value="Inexigibilidade">Inexigibilidade</SelectItem>
                        <SelectItem value="Leilão">Leilão</SelectItem>
                        <SelectItem value="Leilão - Eletrônico">Leilão - Eletrônico</SelectItem>
                        <SelectItem value="Tomada de Preços">Tomada de Preços</SelectItem>
                        <SelectItem value="Convite">Convite</SelectItem>
                        <SelectItem value="Concurso">Concurso</SelectItem>
                        <SelectItem value="Diálogo Competitivo">Diálogo Competitivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status do Edital */}
                <div>
                    <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      Status do Edital
                    </Label>
                    <Select value={filtros.statusEdital || "TODOS"} onValueChange={(value) => setFiltros({ ...filtros, statusEdital: value === "TODOS" ? "" : value })}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos os Status</SelectItem>
                        <SelectItem value="proximo">Próximo (Ainda não abriu)</SelectItem>
                        <SelectItem value="andamento">Em Andamento</SelectItem>
                        <SelectItem value="encerrando">Encerrando (≤ 3 dias)</SelectItem>
                        <SelectItem value="encerrado">Encerrado</SelectItem>
                        <SelectItem value="urgente">Urgente (≤ 7 dias)</SelectItem>
                      </SelectContent>
                  </Select>
                </div>

                  {/* Valor Estimado */}
                <div>
                    <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      Valor Estimado
                  </Label>
                    <div className="flex gap-2">
                  <Input
                        type="number"
                        placeholder="Mínimo"
                        value={filtros.valorMin}
                        onChange={(e) => setFiltros({ ...filtros, valorMin: e.target.value })}
                        className="h-9 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Máximo"
                        value={filtros.valorMax}
                        onChange={(e) => setFiltros({ ...filtros, valorMax: e.target.value })}
                        className="h-9 text-xs"
                  />
                </div>
          </div>

                  {/* Checkboxes */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="comDocumentos"
                        checked={filtros.comDocumentos}
                        onCheckedChange={(checked) => setFiltros({ ...filtros, comDocumentos: checked })}
                      />
                      <Label htmlFor="comDocumentos" className="text-xs cursor-pointer flex items-center gap-2">
                        <Download className="w-3 h-3 text-gray-500" />
                        Com Documentos
                      </Label>
            </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="comItens"
                        checked={filtros.comItens}
                        onCheckedChange={(checked) => setFiltros({ ...filtros, comItens: checked })}
                      />
                      <Label htmlFor="comItens" className="text-xs cursor-pointer flex items-center gap-2">
                        <FileText className="w-3 h-3 text-gray-500" />
                        Com Itens
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="comValor"
                        checked={filtros.comValor}
                        onCheckedChange={(checked) => setFiltros({ ...filtros, comValor: checked })}
                      />
                      <Label htmlFor="comValor" className="text-xs cursor-pointer flex items-center gap-2">
                        <DollarSign className="w-3 h-3 text-gray-500" />
                        Com Valor Estimado
                      </Label>
                    </div>
                  </div>


              </AccordionContent>
            </AccordionItem>

          </Accordion>

              </div>
        </aside>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {dataFiltro ? `Licitações de ${format(new Date(dataFiltro), "dd/MM/yyyy", { locale: ptBR })}` : 'Todas as Licitações'}
              </h1>
              <p className="text-gray-600">
                {dataFiltro 
                  ? 'Licitações publicadas nesta data' 
                  : 'Visualize todas as licitações públicas do Brasil'
                }
              </p>
            </div>
          </div>

          {/* Badges de Filtros Ativos */}
          {contarFiltrosAtivos() > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {filtros.buscaObjeto && (
                  <Badge variant="secondary" className="gap-1">
                    Busca: {filtros.buscaObjeto}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, buscaObjeto: '' })} />
                  </Badge>
                )}
                {filtros.excluirPalavras && (
                  <Badge variant="secondary" className="gap-1 bg-red-50 text-red-700 border-red-200">
                    Excluir: {filtros.excluirPalavras}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, excluirPalavras: '' })} />
                  </Badge>
                )}
                {filtros.uf && (
                  <Badge variant="secondary" className="gap-1">
                    UF: {filtros.uf}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, uf: '' })} />
                  </Badge>
                )}
                {filtros.modalidade && (
                  <Badge variant="secondary" className="gap-1">
                    Modalidade: {filtros.modalidade}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, modalidade: '' })} />
                  </Badge>
                )}
                {filtros.statusEdital && (
                  <Badge variant="secondary" className="gap-1">
                    Status: {
                      filtros.statusEdital === 'proximo' ? 'Próximo' :
                      filtros.statusEdital === 'andamento' ? 'Em Andamento' :
                      filtros.statusEdital === 'encerrando' ? 'Encerrando' :
                      filtros.statusEdital === 'urgente' ? 'Urgente' :
                      'Encerrado'
                    }
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, statusEdital: '' })} />
                  </Badge>
                )}
                {(filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim) && (
                  <Badge variant="secondary" className="gap-1">
                    Data: {filtros.dataPublicacaoInicio ? formatarData(filtros.dataPublicacaoInicio) : '...'} - {filtros.dataPublicacaoFim ? formatarData(filtros.dataPublicacaoFim) : '...'}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, dataPublicacaoInicio: '', dataPublicacaoFim: '' })} />
                  </Badge>
                )}
                {(filtros.valorMin || filtros.valorMax) && (
                  <Badge variant="secondary" className="gap-1">
                    Valor: R$ {filtros.valorMin || '0'} - {filtros.valorMax || '∞'}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, valorMin: '', valorMax: '' })} />
                  </Badge>
                )}
                {dataFiltro && (
                  <Badge variant="secondary" className="gap-1 bg-orange-100">
                    Data: {format(new Date(dataFiltro), "dd/MM/yyyy", { locale: ptBR })}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => {
                      setDataFiltro('')
                      window.history.pushState({}, '', '/licitacoes')
                    }} />
                  </Badge>
                              )}
                            </div>
            )}
                        </div>

          {/* Loading / Filtro em andamento – apenas skeleton cards */}
          {(isLoading || (processandoFiltro && licitacoesFinais.length === 0)) && (
            <LicitacaoCardSkeletonList count={processandoFiltro ? 12 : 8} />
          )}

          {/* Error */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-900">Erro ao carregar licitações</h3>
                    <p className="text-sm text-red-700 mt-1">{error.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resultados - Mostrar mesmo durante processamento final */}
          {!isLoading && !error && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {licitacoesFinais.length} {licitacoesFinais.length === 1 ? 'licitação encontrada' : 'licitações encontradas'}
                {perfilUsuario?.setores_atividades?.length > 0 && (
                  <span className="text-xs text-gray-500 ml-2">
                    (filtradas por setores e estados cadastrados)
                  </span>
                )}
              </p>
              {(filtros.buscaObjeto || filtros.excluirPalavras || filtros.uf || filtros.modalidade || filtros.statusEdital || 
                filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim || filtros.valorMin || 
                filtros.valorMax || filtros.comDocumentos || 
                filtros.comItens || filtros.comValor || dataFiltro) && licitacoesFinais.length > 100 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Muitos resultados encontrados ({licitacoesFinais.length}). Considere adicionar mais filtros para refinar a busca.
                </p>
              )}
            </div>
          )}

          {/* Cards de Licitações */}
          {!isLoading && !(processandoFiltro && licitacoesFinais.length === 0) && (
              <div className="space-y-4">
              {licitacoesFinais.length > 0 ? (
                licitacoesFinais.map((licitacao) => {
                  return (
            <Card 
              key={licitacao.id} 
              className="rounded-xl border border-gray-100 border-l-4 border-l-orange-500 bg-white shadow-sm hover:shadow-xl hover:bg-orange-50/20 transition-all duration-200"
            >
              <CardContent className="p-6">
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center">
                      <FileText className="w-4 h-4 text-gray-600" />
                              </div>
                    <button
                      onClick={(e) => handleFavoritar(e, licitacao)}
                      className="hover:scale-110 transition-transform"
                      title={favoritos.has(licitacao.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <Star 
                        className={`w-5 h-5 transition-colors ${
                          favoritos.has(licitacao.id) 
                            ? 'text-green-500 fill-green-500' 
                            : 'text-gray-400 hover:text-yellow-500 hover:fill-yellow-500'
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => toggleCardExpandido(e, licitacao.id, licitacao)}
                      className="hover:scale-110 transition-transform relative"
                      title={cardsExpandidos.has(licitacao.id) ? "Ocultar detalhes" : "Ver detalhes"}
                    >
                      <Eye className={`w-5 h-5 transition-colors ${
                        cardsExpandidos.has(licitacao.id)
                          ? 'text-blue-600 fill-blue-100'
                          : 'text-blue-500 hover:text-blue-600'
                      }`} />
                      {/* Indicador de conteúdo disponível */}
                      {(() => {
                        const documentos = getDocumentos(licitacao)
                        const itens = getItens(licitacao)
                        return (documentos.length > 0 || itens.length > 0) && 
                        !cardsExpandidos.has(licitacao.id) && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white"></span>
                        )
                      })()}
                    </button>
                    
                    {/* Badges de indicadores (quando não expandido) */}
                    {!cardsExpandidos.has(licitacao.id) && (() => {
                      const documentos = getDocumentos(licitacao)
                      const itens = getItens(licitacao)
                      
                      return (
                        <>
                          {documentos.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              baixarDocumentosComoZip(licitacao)
                            }}
                            disabled={baixandoDocumentos.has(licitacao.id || licitacao.numero_controle_pncp)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Baixar todos os documentos em ZIP"
                          >
                            {baixandoDocumentos.has(licitacao.id || licitacao.numero_controle_pncp) ? (
                              <>
                                <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                Compactando...
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                              {documentos.length} doc{documentos.length > 1 ? 's' : ''}
                              </>
                            )}
                          </button>
                        )}
                          {itens.length > 0 && (
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 transition-colors"
                            title={`${itens.length} ${itens.length > 1 ? 'itens' : 'item'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText className="w-3 h-3" />
                              {itens.length} {itens.length > 1 ? 'itens' : 'item'}
                          </button>
                        )}
                      </>
                      )
                    })()}
                            </div>
                  
                  {/* Badges de Status e Datas */}
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {/* Badge URGENTE */}
                    {isUrgente(licitacao) && (
                      <Badge variant="destructive" className="bg-red-500 animate-pulse text-xs font-semibold">
                        ⚠️ URGENTE
                      </Badge>
                    )}
                    
                    {/* Badges de Data de Abertura e Encerramento */}
                    {(() => {
                      // PRIORIDADE 1: Tentar buscar de diferentes lugares na estrutura JSONB
                      let dataAbertura = licitacao.dados_completos?.dataAberturaProposta || 
                                          licitacao.dados_completos?.data_abertura_proposta ||
                                          licitacao.dados_completos?.dataAberturaPropostaData
                      
                      let dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta || 
                                               licitacao.dados_completos?.data_encerramento_proposta ||
                                               licitacao.dados_completos?.dataEncerramentoPropostaData
                      
                      // PRIORIDADE 2: Se não encontrou no JSONB, usar data_publicacao_pncp como fallback para mostrar algo
                      // Usar data de publicação como referência quando não tem datas específicas
                      if (!dataAbertura && !dataEncerramento && licitacao.data_publicacao_pncp) {
                        // Se só tem data de publicação, usar ela como data de referência
                        // Não criar badges de abertura/encerramento falsos, apenas mostrar data de publicação
                        return (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs font-medium">
                            📅 Publicado em: {formatarData(licitacao.data_publicacao_pncp)}
                          </Badge>
                        )
                      }
                      
                      // Se encontrou pelo menos uma data específica, mostrar os badges
                      return (
                        <>
                          {dataAbertura && (
                            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs font-medium">
                              📅 Abertura: {formatarData(dataAbertura)}
                            </Badge>
                          )}
                          {dataEncerramento && (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs font-medium">
                              ⏰ Encerramento: {formatarData(dataEncerramento)}
                            </Badge>
                          )}
                          {/* Se tem data de publicação mas não tem as outras datas, mostrar também */}
                          {licitacao.data_publicacao_pncp && (!dataAbertura || !dataEncerramento) && (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs font-medium">
                              📅 Publicado: {formatarData(licitacao.data_publicacao_pncp)}
                            </Badge>
                          )}
                        </>
                      )
                    })()}
                    
                    {/* Badge de Status (Próximo / Em Andamento / Encerrando / Encerrado) */}
                    {(() => {
                      const status = getStatusEdital(licitacao)
                      
                      // Se não tem status específico mas tem data de publicação recente, mostrar como ativa
                      if (!status && licitacao.data_publicacao_pncp) {
                        const hoje = new Date()
                        const publicacao = new Date(licitacao.data_publicacao_pncp)
                        const diasDesdePublicacao = Math.ceil((hoje - publicacao) / (1000 * 60 * 60 * 24))
                        
                        if (diasDesdePublicacao <= 30 && diasDesdePublicacao >= 0) {
                          return (
                            <Badge className="bg-blue-500 text-white text-xs font-semibold">
                              ✅ Ativa
                            </Badge>
                          )
                        }
                        return null
                      }
                      
                      // Badge baseado no status retornado
                      switch (status) {
                        case 'proximo':
                          return (
                            <Badge className="bg-purple-500 text-white text-xs font-semibold">
                              🔜 Próximo
                            </Badge>
                          )
                        case 'andamento':
                          return (
                            <Badge className="bg-blue-500 text-white text-xs font-semibold">
                              ✅ Em Andamento
                            </Badge>
                          )
                        case 'encerrando':
                          // Calcular dias restantes para mostrar no badge
                      const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta || 
                                               licitacao.dados_completos?.data_encerramento_proposta ||
                                               licitacao.dados_completos?.dataEncerramentoPropostaData
                      if (dataEncerramento) {
                        const hoje = new Date()
                        const encerramento = new Date(dataEncerramento)
                        const diasRestantes = Math.ceil((encerramento - hoje) / (1000 * 60 * 60 * 24))
                          return (
                              <Badge className="bg-yellow-500 text-white text-xs font-semibold animate-pulse">
                                ⚠️ Encerrando em {diasRestantes}d
                            </Badge>
                          )
                        }
                          return (
                            <Badge className="bg-yellow-500 text-white text-xs font-semibold animate-pulse">
                              ⚠️ Encerrando
                            </Badge>
                          )
                        case 'encerrado':
                            return (
                            <Badge className="bg-red-500 text-white text-xs font-semibold">
                              ❌ Encerrado
                              </Badge>
                            )
                        default:
                      return null
                      }
                    })()}
                        </div>
                        </div>

                {/* Objeto */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Objeto:</h3>
                  <p className="text-gray-900 leading-relaxed">
                    {licitacao.objeto_compra || 'Objeto não informado'}
                  </p>
                        </div>

                <hr className="my-4" />

                {/* Detalhes em 3 colunas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-2 py-2">
                  {/* Campo 1: Data de Publicação */}
                              <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Publicação:</p>
                      <p className="text-sm text-gray-600">
                        {formatarData(licitacao.data_publicacao_pncp)}
                      </p>
                              </div>
                              </div>

                  {/* Campo 2: UF/Cidade */}
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">UF:</p>
                      <p className="text-sm text-gray-600">{licitacao.uf_sigla || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Campo 3: Modalidade */}
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-orange-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Modalidade:</p>
                      <Badge variant="outline" className="mt-1">{licitacao.modalidade_nome || 'N/A'}</Badge>
                    </div>
                  </div>

                  {/* Campo 4: Valor Estimado */}
                  {licitacao.valor_total_estimado && (
                    <div className="flex items-start gap-2">
                      <DollarSign className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Valor Estimado:</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatarValor(licitacao.valor_total_estimado)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Campo 5: Órgão */}
                  <div className="flex items-start gap-2 md:col-span-2">
                    <Building2 className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Órgão:</p>
                      <p className="text-sm text-gray-600">
                        {licitacao.orgao_razao_social || 'Não informado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {licitacao.data_inclusao && (
                      <span>Incluída em: {formatarData(licitacao.data_inclusao)}</span>
                    )}
                            </div>
                  <div className="text-sm text-gray-500">
                    Atualizada em: {formatarData(licitacao.data_atualizacao)}
                        </div>
                      </div>

                {/* Seção Expansível com Detalhes (quando clica no olho) */}
                {cardsExpandidos.has(licitacao.id) && (
                  <div className="mt-6 pt-6 border-t space-y-6 animate-in slide-in-from-top-2">
                    {/* Anexos/Documentos */}
                    {licitacao.anexos && licitacao.anexos.length > 0 && (
                      <div>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="documentos" className="border-0">
                            <AccordionPrimitive.Header className="flex">
                              <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-3 font-medium transition-all hover:no-underline w-full">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <Download className="w-5 h-5 text-blue-500" />
                                  Documentos ({licitacao.anexos.length})
                                </h4>
                                <Eye className="h-5 w-5 shrink-0 text-blue-600 transition-colors" />
                              </AccordionPrimitive.Trigger>
                            </AccordionPrimitive.Header>
                            <AccordionContent>
                              <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                          {licitacao.anexos.map((anexo, index) => {
                            const anexoKey = `${licitacao.id}-${index}`
                            const anexoUrl = anexo.url || anexo.urlDocumento || anexo.linkDocumento || anexo.link
                            const anexoNome = anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || anexo.tipoDocumentoNome || `Documento ${index + 1}`
                            const isZip = isZipFile(anexoUrl, anexoNome)
                            const zipData = arquivosZipDescompactados[anexoKey]
                            
                            // Função para descompactar ZIP
                            const handleDescompactarZip = async () => {
                              if (!anexoUrl) return
                              
                              setArquivosZipDescompactados(prev => ({
                                ...prev,
                                [anexoKey]: { loading: true, arquivos: [], erro: null }
                              }))
                              
                              try {
                                const arquivos = await descompactarZip(anexoUrl, anexoNome)
                                setArquivosZipDescompactados(prev => ({
                                  ...prev,
                                  [anexoKey]: { loading: false, arquivos, erro: null }
                                }))
                              } catch (error) {
                                console.error('❌ Erro ao descompactar ZIP:', error)
                                setArquivosZipDescompactados(prev => ({
                                  ...prev,
                                  [anexoKey]: { loading: false, arquivos: [], erro: error.message }
                                }))
                              }
                            }
                            
                            return (
                              <div key={index} className="space-y-2">
                                {/* Card do Anexo Principal */}
                                <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all group">
                                  {/* Nome do Documento */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                                      {anexoNome}
                                      {isZip && (
                                        <Badge variant="secondary" className="text-xs">
                                          ZIP
                                        </Badge>
                                      )}
                                    </p>
                                    {anexo.tipo && (
                                      <p className="text-xs text-gray-500 truncate">{anexo.tipo}</p>
                                    )}
                                  </div>
                                  
                                  {/* Badges Circulares de Ação */}
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {/* Badge Download */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (anexoUrl) {
                                          const link = document.createElement('a')
                                          link.href = anexoUrl
                                          link.download = anexoNome
                                          link.target = '_blank'
                                          link.click()
                                        }
                                      }}
                                      className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                                      title="Baixar documento"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    {/* Badge Visualizar Documento (só se não for ZIP) */}
                                    {!isZip && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (anexoUrl) {
                                            setDocumentoVisualizacao({
                                              url: anexoUrl,
                                              nome: anexoNome,
                                              licitacaoId: licitacao.id
                                            })
                                            setVisualizadorAberto(true)
                                          }
                                        }}
                                        className="w-6 h-6 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors"
                                        title="Visualizar documento"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    
                                    {/* Badge Descompactar ZIP ou Chat IA */}
                                    {isZip ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (!zipData) {
                                            handleDescompactarZip()
                                          }
                                        }}
                                        disabled={zipData?.loading}
                                        className="w-6 h-6 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center transition-colors disabled:opacity-50"
                                        title={zipData?.loading ? "Descompactando..." : zipData?.arquivos?.length > 0 ? "Arquivos descompactados" : "Descompactar arquivo ZIP"}
                                      >
                                        {zipData?.loading ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Download className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                                
                                {/* Arquivos Descompactados do ZIP */}
                                {isZip && zipData && (
                                  <div className="ml-4 space-y-2">
                                    {zipData.loading && (
                                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Descompactando arquivo ZIP...
                                      </div>
                                    )}
                                    
                                    {zipData.erro && (
                                      <div className="p-2 bg-red-50 rounded text-sm text-red-700">
                                        ❌ Erro: {zipData.erro}
                                      </div>
                                    )}
                                    
                                    {zipData.arquivos && zipData.arquivos.length > 0 && (
                                      <div className="space-y-2">
                                        <p className="text-xs font-medium text-gray-600">
                                          Arquivos descompactados ({zipData.arquivos.length}):
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {zipData.arquivos.map((arquivo, arquivoIndex) => (
                                            <Badge
                                              key={arquivoIndex}
                                              variant="outline"
                                              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => {
                                                // Se for PDF, abrir no visualizador
                                                if (arquivo.extensao === 'pdf') {
                                                  setDocumentoVisualizacao({
                                                    url: arquivo.url,
                                                    nome: arquivo.nome
                                                  })
                                                  setVisualizadorAberto(true)
                                                } else {
                                                  // Para outros tipos, abrir em nova aba
                                                  window.open(arquivo.url, '_blank')
                                                }
                                              }}
                                            >
                                              <FileText className="w-3 h-3" />
                                              <span className="text-xs">{arquivo.nome}</span>
                                              <span className="text-xs text-gray-500">({arquivo.tipo})</span>
                                            </Badge>
                ))}
              </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}

                    {/* Itens */}
                    {licitacao.itens && licitacao.itens.length > 0 && (
                      <div>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="itens" className="border-0">
                            <AccordionPrimitive.Header className="flex">
                              <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-3 font-medium transition-all hover:no-underline w-full">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-green-500" />
                                  Itens da Licitação ({licitacao.itens.length})
                                </h4>
                                <Eye className="h-5 w-5 shrink-0 text-green-600 transition-colors" />
                              </AccordionPrimitive.Trigger>
                            </AccordionPrimitive.Header>
                            <AccordionContent>
                              <div className="max-h-96 overflow-y-auto pr-2 space-y-4">
                                {licitacao.itens.map((item, index) => (
                                  <div key={index} className="bg-white border border-green-200 rounded-lg p-4 hover:border-green-400 hover:shadow-sm transition-all">
                              {/* Header do Item */}
                              <div className="mb-3">
                                {/* Badges no topo */}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                  <Badge className="bg-green-600 text-white font-bold">
                                    Item #{item.numeroItem || item.numero || index + 1}
                                  </Badge>
                                  {item.materialOuServicoNome && (
                                    <Badge variant={item.materialOuServicoNome === 'Serviço' ? 'default' : 'secondary'}>
                                      {item.materialOuServicoNome}
                                    </Badge>
                                  )}
                                  {item.situacaoCompraItemNome && (
                                    <Badge variant="outline">
                                      {item.situacaoCompraItemNome}
                                    </Badge>
          )}
        </div>
                                {/* Descrição - Título do Item */}
                                <h5 className="text-base font-bold text-gray-900 leading-relaxed mt-2">
                                  {item.descricao || item.descricaoDetalhada || item.descricao_item || item.descricaoItem || 'Sem descrição'}
                                </h5>
                              </div>

                              {/* Informações Detalhadas - 3 colunas como na imagem */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                {/* Coluna 1 */}
                                <div className="space-y-3">
                                  {/* Quantidade */}
                                  {item.quantidade && (
                                    <div>
                                      <span className="text-xs text-gray-500 block mb-1">Quantidade:</span>
                                      <span className="text-sm font-semibold text-gray-900">
                                        {item.quantidade} {item.unidadeMedida || item.unidade || item.unidade_fornecimento || item.unidadeFornecimento || ''}
                                      </span>
                  </div>
                                  )}
                                  
                                  {/* Critério */}
                                  {(item.criterioJulgamentoNome || item.criterio_julgamento) && (
                                    <div>
                                      <span className="text-xs text-gray-500 block mb-1">Critério:</span>
                                      <span className="text-sm font-medium text-gray-900">
                                        {item.criterioJulgamentoNome || item.criterio_julgamento}
                                      </span>
                </div>
              )}
                                </div>

                                {/* Coluna 2 */}
                                <div className="space-y-3">
                                  {/* Valor Unitário */}
                                  {(item.valorUnitarioEstimado || item.valorUnitario || item.valor_unitario) && (
                                    <div>
                                      <span className="text-xs text-gray-500 block mb-1">Valor Unitário:</span>
                                      <span className="text-sm font-semibold text-green-600">
                                        {formatarValor(item.valorUnitarioEstimado || item.valorUnitario || item.valor_unitario)}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Categoria */}
                                  {(item.itemCategoriaNome || item.categoria_item || item.categoriaItem) && (
                                    <div>
                                      <span className="text-xs text-gray-500 block mb-1">Categoria:</span>
                                      <span className="text-sm font-medium text-gray-900">
                                        {item.itemCategoriaNome || item.categoria_item || item.categoriaItem || 'Não se aplica'}
                                      </span>
        </div>
                                  )}
                                </div>

                                {/* Coluna 3 */}
                                <div className="space-y-3">
                                  {/* Valor Total */}
                                  {(item.valorTotal || item.valor_total || item.valorTotalEstimado) && (
                                    <div>
                                      <span className="text-xs text-gray-500 block mb-1">Valor Total:</span>
                                      <span className="text-sm font-semibold text-green-600">
                                        {formatarValor(item.valorTotal || item.valor_total || item.valorTotalEstimado)}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Benefício */}
                                  {(item.tipoBeneficioNome || item.tipo_beneficio) && (
                                    <div>
                                      <span className="text-xs text-gray-500 block mb-1">Benefício:</span>
                                      <span className="text-sm font-medium text-gray-900">
                                        {item.tipoBeneficioNome || item.tipo_beneficio}
                                      </span>
    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* NCM/NBS - abaixo das 3 colunas se existir */}
                              {item.ncmNbsDescricao && (
                                <div className="mt-3 pt-3 border-t">
                                  <span className="text-xs text-gray-500 block mb-1">NCM/NBS:</span>
                                  <span className="text-sm font-medium text-gray-900">
                                    {item.ncmNbsCodigo ? `${item.ncmNbsCodigo} - ` : ''}{item.ncmNbsDescricao}
                                  </span>
                                </div>
                              )}

                              {/* Informação Complementar */}
                              {item.informacaoComplementar && (
                                <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                                  <span className="text-xs font-medium text-blue-700 block mb-1">Informação Complementar:</span>
                                  <p className="text-xs text-blue-900">{item.informacaoComplementar}</p>
                                </div>
                              )}

                              {/* Indicadores de Benefícios/Margens */}
                              <div className="flex flex-wrap gap-2 mt-3">
                                {item.incentivoProdutivoBasico && (
                                  <Badge variant="secondary" className="text-xs">
                                    Incentivo Produtivo Básico
                                  </Badge>
                                )}
                                {item.aplicabilidadeMargemPreferenciaNormal && (
                                  <Badge variant="secondary" className="text-xs">
                                    Margem Preferência Normal {item.percentualMargemPreferenciaNormal ? `(${item.percentualMargemPreferenciaNormal}%)` : ''}
                                  </Badge>
                                )}
                                {item.aplicabilidadeMargemPreferenciaAdicional && (
                                  <Badge variant="secondary" className="text-xs">
                                    Margem Preferência Adicional {item.percentualMargemPreferenciaAdicional ? `(${item.percentualMargemPreferenciaAdicional}%)` : ''}
                                  </Badge>
                                )}
                                {item.exigenciaConteudoNacional && (
                                  <Badge variant="secondary" className="text-xs">
                                    Exigência Conteúdo Nacional
                                  </Badge>
                                )}
                                {item.orcamentoSigiloso && (
                                  <Badge variant="destructive" className="text-xs">
                                    Orçamento Sigiloso
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    )}
                  </div>
                )}
                    </CardContent>
                  </Card>
                  )
                })
              ) : (
                !processandoFiltro && (
                  <Card className="rounded-xl border border-gray-100 bg-white shadow-sm">
                    <CardContent className="py-12 text-center">
                      <FileText className="w-16 h-16 text-orange-200 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Nenhuma licitação encontrada
                      </h3>
                      <p className="text-sm text-gray-600">
                        Tente ajustar os filtros ou verifique se há licitações disponíveis.
                      </p>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          )}

          {/* Botão Carregar Mais (apenas sem filtros) */}
          {!isLoading && !error && !processandoFiltro && licitacoesFinais.length >= limitePagina && 
           !(filtros.buscaObjeto || filtros.excluirPalavras || filtros.uf || filtros.modalidade || filtros.statusEdital || 
             filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim || filtros.valorMin || 
             filtros.valorMax || filtros.comDocumentos || 
             filtros.comItens || filtros.comValor || dataFiltro) && (
            <div className="text-center mt-8">
              <Button
                onClick={() => setLimitePagina(prev => prev + 50)}
                className="bg-orange-500 hover:bg-orange-600"
                size="lg"
              >
                Carregar Mais Licitações
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Mostrando {licitacoesFinais.length} licitações
              </p>
            </div>
          )}
              
        </div>
      </div>

      {/* Visualizador de Documento com Chat Integrado */}
      <VisualizadorDocumento
        open={visualizadorAberto}
        onOpenChange={setVisualizadorAberto}
        urlDocumento={documentoVisualizacao?.url}
        nomeArquivo={documentoVisualizacao?.nome}
        licitacaoId={documentoVisualizacao?.licitacaoId}
      />


    </AppLayout>
  )
}

export function BoletimDiaPage() {
  return (
    <ProtectedRoute>
      <LicitacoesContent />
    </ProtectedRoute>
  )
}
