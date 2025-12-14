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
  MessageSquare,
  Loader2,
  Brain,
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
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { ChatDocumento } from '@/components/ChatDocumento'
import { VisualizadorDocumento } from '@/components/VisualizadorDocumento'
import { useNotifications } from '@/hooks/useNotifications'
import { obterNomeAtividadeCnae, obterListaCompletaCnaes, resumirNomeAtividade } from '@/lib/cnae'
import { useFiltrosPermanentes } from '@/hooks/useFiltrosPermanentes'
import { FiltrosPermanentes } from '@/components/FiltrosPermanentes'
import { 
  extrairPalavrasChaveDosSetores, 
  correspondeAtividadesHibrido,
  obterObjetoCompleto,
  registrarMetricaIA
} from '@/lib/filtroSemantico'
import { useFiltroContext } from '@/contexts/FiltroContext'

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
  const [chatAberto, setChatAberto] = useState(false)
  const [documentoSelecionado, setDocumentoSelecionado] = useState(null)
  const [visualizadorAberto, setVisualizadorAberto] = useState(false)
  const [documentoVisualizacao, setDocumentoVisualizacao] = useState(null)
  const [limitePagina, setLimitePagina] = useState(50)
  const [resumosIA, setResumosIA] = useState({}) // { licitacaoId: { loading, resumo, erro } }
  // Estados para processamento do filtro (compartilhado via contexto)
  const { 
    processandoFiltro, 
    setProcessandoFiltro, 
    mensagemProgresso, 
    setMensagemProgresso,
    setProgressoPercentual
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
  // Hook para filtros permanentes
  const { aplicarFiltrosPermanentes, filtrosAtivos: filtrosPermanentesAtivos, filtrosPermanentes } = useFiltrosPermanentes()
  
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
      
      // Se erro for coluna não existe (42703), tentar sem sinônimos personalizados
      if (error && error.code === '42703') {
        console.log('ℹ️ Coluna sinonimos_personalizados não existe, buscando sem ela...')
        const { data: dataSemSinonimos, error: errorSemSinonimos } = await supabase
          .from('profiles')
          .select('setores_atividades, estados_interesse')
          .eq('id', user.id)
          .maybeSingle()
        
        if (errorSemSinonimos) {
          console.warn('⚠️ Erro ao buscar perfil:', errorSemSinonimos)
          return null
        }
        
        // Adicionar sinonimos_personalizados como objeto vazio
        return { ...dataSemSinonimos, sinonimos_personalizados: {} }
      }
      
      if (error) {
        console.warn('⚠️ Erro ao buscar perfil:', error)
        return null
      }
      
      // Garantir que sinonimos_personalizados existe (mesmo que vazio)
      return { ...data, sinonimos_personalizados: data?.sinonimos_personalizados || {} }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60, // Cache por 1 hora
  })

  // API Key do Mistral (opcional - pode estar em variável de ambiente)
  const mistralApiKey = import.meta.env.VITE_MISTRAL_API_KEY || null

  // Estados dos Filtros
  const [filtros, setFiltros] = useState({
    // Essenciais
    buscaObjeto: '',
    uf: '',
    modalidade: '',
    dataPublicacaoInicio: '',
    dataPublicacaoFim: '',
    valorMin: '',
    valorMax: '',
    statusEdital: '', // Em Andamento, Encerrando, Encerrado
    
    // Úteis
    orgao: '',
    numeroEdital: '',
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

  // Resetar limite quando mudar filtros
  useEffect(() => {
    setLimitePagina(50)
  }, [filtros, dataFiltro])

  // Debounce para filtros de texto (melhorar performance)
  const [filtrosDebounced, setFiltrosDebounced] = useState(filtros)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltrosDebounced(filtros)
    }, 300) // 300ms de delay

    return () => clearTimeout(timer)
  }, [filtros])

  // Determinar status do edital (definido antes do useMemo)
  const getStatusEdital = useCallback((licitacao) => {
    // Tentar buscar de diferentes lugares na estrutura JSONB
    const dataAbertura = licitacao.dados_completos?.dataAberturaProposta || 
                        licitacao.dados_completos?.data_abertura_proposta ||
                        licitacao.dados_completos?.dataAberturaPropostaData
    const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta || 
                             licitacao.dados_completos?.data_encerramento_proposta ||
                             licitacao.dados_completos?.dataEncerramentoPropostaData
    
    if (!dataEncerramento) return null
    
    const hoje = new Date()
    const encerramento = new Date(dataEncerramento)
    const diasRestantes = Math.ceil((encerramento - hoje) / (1000 * 60 * 60 * 24))
    
    // Encerrado
    if (diasRestantes < 0) return 'encerrado'
    
    // Encerrando (3 dias ou menos)
    if (diasRestantes <= 3 && diasRestantes > 0) return 'encerrando'
    
    // Em andamento
    if (dataAbertura) {
      const abertura = new Date(dataAbertura)
      if (hoje >= abertura && hoje <= encerramento) {
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

  // Buscar licitações do banco com TODOS os filtros (usar filtrosDebounced para campos de texto)
  const { data: licitacoes = [], isLoading, error } = useQuery({
    queryKey: ['licitacoes', filtrosDebounced, dataFiltro, limitePagina, perfilUsuario?.estados_interesse, perfilUsuario?.setores_atividades],
    queryFn: async () => {
      let query = supabase
            .from('licitacoes')
        .select(`
          id,
          numero_controle_pncp,
          objeto_compra,
          data_publicacao_pncp,
          data_atualizacao,
          uf_sigla,
          modalidade_nome,
          orgao_razao_social,
          valor_total_estimado,
          dados_completos,
          anexos,
          itens
        `)
        .order('data_publicacao_pncp', { ascending: false })

      // FILTROS ESSENCIAIS
      
      // Busca por Objeto (usar filtrosDebounced para campos de texto)
      if (filtrosDebounced.buscaObjeto) {
        query = query.ilike('objeto_compra', `%${filtrosDebounced.buscaObjeto}%`)
  }

      // UF
      if (filtrosDebounced.uf) {
        query = query.eq('uf_sigla', filtrosDebounced.uf.toUpperCase())
      }

      // Modalidade
      if (filtrosDebounced.modalidade) {
        query = query.ilike('modalidade_nome', `%${filtrosDebounced.modalidade}%`)
      }

      // Data Publicação
      if (filtrosDebounced.dataPublicacaoInicio) {
        query = query.gte('data_publicacao_pncp', filtrosDebounced.dataPublicacaoInicio)
      }
      if (filtrosDebounced.dataPublicacaoFim) {
        query = query.lte('data_publicacao_pncp', filtrosDebounced.dataPublicacaoFim)
      }

      // Valor Estimado
      if (filtrosDebounced.valorMin) {
        query = query.gte('valor_total_estimado', parseFloat(filtrosDebounced.valorMin))
      }
      if (filtrosDebounced.valorMax) {
        query = query.lte('valor_total_estimado', parseFloat(filtrosDebounced.valorMax))
      }

      // FILTROS ÚTEIS

      // Órgão
      if (filtrosDebounced.orgao) {
        query = query.ilike('orgao_razao_social', `%${filtrosDebounced.orgao}%`)
      }

      // Número Edital
      if (filtrosDebounced.numeroEdital) {
        query = query.ilike('numero_controle_pncp', `%${filtrosDebounced.numeroEdital}%`)
      }

      // Com Documentos
      if (filtrosDebounced.comDocumentos) {
        query = query.neq('anexos', '[]')
      }

      // Com Itens
      if (filtrosDebounced.comItens) {
        query = query.neq('itens', '[]')
      }

      // Com Valor
      if (filtrosDebounced.comValor) {
        query = query.not('valor_total_estimado', 'is', null)
      }

      // FILTROS DE EXCLUSÃO serão aplicados no useMemo após a query
      // (não aplicamos aqui porque precisamos filtrar por palavras no objeto)

      // Filtro de data do calendário (prioritário)
      if (dataFiltro) {
        query = query.eq('data_publicacao_pncp', dataFiltro)
      }

      // Verificar se há filtros ativos (usar filtrosDebounced)
      const temFiltrosAtivos = !!(
        filtrosDebounced.buscaObjeto ||
        filtrosDebounced.uf ||
        filtrosDebounced.modalidade ||
        filtrosDebounced.statusEdital ||
        filtrosDebounced.dataPublicacaoInicio ||
        filtrosDebounced.dataPublicacaoFim ||
        filtrosDebounced.valorMin ||
        filtrosDebounced.valorMax ||
        filtrosDebounced.orgao ||
        filtrosDebounced.numeroEdital ||
        filtrosDebounced.comDocumentos ||
        filtrosDebounced.comItens ||
        filtrosDebounced.comValor ||
        dataFiltro
      )

      // Verificar se há perfil configurado (estados ou setores)
      // Se houver, precisamos buscar mais licitações para aplicar o filtro depois
      const temPerfilConfigurado = perfilUsuario && (
        (perfilUsuario.estados_interesse && perfilUsuario.estados_interesse.length > 0) ||
        (perfilUsuario.setores_atividades && perfilUsuario.setores_atividades.length > 0)
      )

      // Aplicar limite: 
      // - 50 sem filtros e sem perfil
      // - 2000 com perfil configurado (para ter mais dados para filtrar)
      // - 500 com filtros manuais
      if (temPerfilConfigurado && !temFiltrosAtivos) {
        // Com perfil, buscar mais para ter dados suficientes após filtrar
        query = query.limit(2000)
      } else if (!temFiltrosAtivos) {
        query = query.limit(limitePagina)
      } else {
        // Com filtros manuais, limitar a 500 para não sobrecarregar
        query = query.limit(500)
      }

      const { data, error } = await query

      if (error) throw error
      
      return data || []
    }
  })

  // Estado para licitações filtradas (precisa ser assíncrono para IA)
  const [licitacoesFiltradas, setLicitacoesFiltradas] = useState([])
  
  // Estado para desativar filtro semântico e mostrar todas as licitações
  const [mostrarTodasLicitacoes, setMostrarTodasLicitacoes] = useState(false)
  
  // Filtrar por status do edital, perfil da empresa e exclusões (assíncrono para IA)
  useEffect(() => {
    const aplicarFiltros = async () => {
      // Se não tem licitações, não processar
      if (!licitacoes || licitacoes.length === 0) {
        setLicitacoesFiltradas([])
        setProcessandoFiltro(false)
        setProgressoPercentual(0)
        return
      }
      
      // Verificar cache primeiro (mas não usar se estiver no modo "mostrar todas")
      if (!mostrarTodasLicitacoes) {
        const cacheKey = getCacheKey()
        if (cacheKey) {
          try {
            const cached = localStorage.getItem(cacheKey)
            if (cached) {
              const { resultado, timestamp } = JSON.parse(cached)
              // Cache válido por 5 minutos
              if (Date.now() - timestamp < 5 * 60 * 1000) {
                console.log('✅ [Cache] Usando resultado em cache')
                setLicitacoesFiltradas(resultado)
                setProcessandoFiltro(false)
                setProgressoPercentual(0)
                return
              }
            }
          } catch (e) {
            console.warn('⚠️ Erro ao ler cache:', e)
          }
        }
      }
      
      // Iniciar processamento
      setProcessandoFiltro(true)
      setProgressoPercentual(10)
      setMensagemProgresso('Iniciando filtro semântico...')
      
      let resultado = licitacoes
      
      setProgressoPercentual(20)
      setMensagemProgresso('Carregando perfil da empresa...')

    // Se o botão "Mostrar Todas" foi clicado, pular filtro semântico
    if (mostrarTodasLicitacoes) {
      console.log('📋 [Filtro] Modo "Mostrar Todas" ativo - pulando filtro semântico')
      resultado = licitacoes
      setProgressoPercentual(100)
      setMensagemProgresso('Mostrando todas as licitações')
    } else {
    // FILTRO AUTOMÁTICO BASEADO NO PERFIL DA EMPRESA
    if (perfilUsuario) {
      const estadosInteresse = perfilUsuario.estados_interesse || []
      const setoresAtividades = perfilUsuario.setores_atividades || []

      // Filtrar por estados de interesse
      if (estadosInteresse.length > 0) {
        // Se tem "Nacional", não filtrar por estado
        const temNacional = estadosInteresse.some(e => 
          typeof e === 'string' ? e === 'Nacional' : e === 'Nacional'
        )
        
        if (!temNacional) {
          setProgressoPercentual(30)
          setMensagemProgresso(`Filtrando por estados: ${estadosInteresse.join(', ')}...`)
          
          resultado = resultado.filter(licitacao => {
            const uf = licitacao.uf_sigla?.toUpperCase()
            return estadosInteresse.some(estado => {
              const estadoUpper = typeof estado === 'string' ? estado.toUpperCase() : estado
              return estadoUpper === uf
            })
          })
          
          setProgressoPercentual(40)
          setMensagemProgresso(`${resultado.length} licitações encontradas nos estados selecionados`)
        }
      }

      // FILTRO OBRIGATÓRIO E RESTRITIVO: Se tem setores cadastrados, DEVE filtrar rigorosamente
      if (setoresAtividades.length > 0) {
        // Obter sinônimos personalizados do perfil (se existirem) - apenas do profile
        const sinonimosPersonalizados = perfilUsuario?.sinonimos_personalizados || {}
        
        // Extrair palavras-chave dos setores (SEM usar tabelas de sinônimos)
        // Retorna { principais, secundarias, todas }
        const palavrasChave = extrairPalavrasChaveDosSetores(setoresAtividades, sinonimosPersonalizados)
        
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
        console.log(`🔍 [Filtro] IA configurada:`, mistralApiKey ? 'Sim' : 'Não (usando filtro semântico apenas)')
        
        const antesFiltro = resultado.length
        
        setProgressoPercentual(50)
        setMensagemProgresso(`Processando ${antesFiltro} licitações...`)
        
        // Filtrar usando IA (se disponível) ou filtro semântico
        // Processar em lotes para não sobrecarregar a API
        const TAMANHO_LOTE = mistralApiKey ? 10 : 50 // Se tem IA, processar em lotes menores
        const resultadosFiltrados = []
        const totalLotes = Math.ceil(resultado.length / TAMANHO_LOTE)
        
        for (let i = 0; i < resultado.length; i += TAMANHO_LOTE) {
          const lote = resultado.slice(i, i + TAMANHO_LOTE)
          const loteAtual = Math.floor(i / TAMANHO_LOTE) + 1
          
          // Atualizar progresso baseado no lote atual (50% a 90%)
          const progressoLote = 50 + Math.floor((loteAtual / totalLotes) * 40)
          setProgressoPercentual(progressoLote)
          
          // Atualizar mensagem de progresso
          setMensagemProgresso(
            `Processando: ${loteAtual}/${totalLotes} lotes (${i + lote.length}/${antesFiltro} licitações)...`
          )
          
          const resultadosLote = await Promise.all(
            lote.map(async (licitacao) => {
              // Usar filtro híbrido: semântico + IA
              const corresponde = await correspondeAtividadesHibrido(
                licitacao,
                palavrasChave,
                setoresAtividades, // Passar setores completos para IA
                mistralApiKey,
                {
                  usarIAParaTodas: !!mistralApiKey, // Se tem API key, usar IA para todas
                  usarIAParaDuvidosos: false // Já estamos usando para todas se tiver API key
                }
              )
              
              // Registrar métrica
              registrarMetricaIA('filtro_semantico', { mostrou: corresponde })
              
              // Log detalhado para debug
              if (!corresponde && licitacao.objeto_compra) {
                console.log(`🚫 [Filtro] Licitação filtrada:`, {
                  objeto: licitacao.objeto_compra.substring(0, 100),
                  palavrasPrincipais: palavrasChave.principais.slice(0, 3)
                })
              }
              
              return corresponde ? licitacao : null
            })
          )
          
          resultadosFiltrados.push(...resultadosLote.filter(Boolean))
        }
        
        resultado = resultadosFiltrados
        
        setProgressoPercentual(90)
        setMensagemProgresso(`Filtro concluído! ${resultado.length} licitações encontradas.`)
        
        const depoisFiltro = resultado.length
        const percentualRemovido = antesFiltro > 0 ? ((1 - depoisFiltro/antesFiltro) * 100).toFixed(1) : 0
        console.log(`✅ [Filtro] Filtrado: ${antesFiltro} → ${depoisFiltro} licitações (${percentualRemovido}% removidas)`)
      } else {
        // Se NÃO tem setores cadastrados, NÃO MOSTRAR NADA (muito restritivo)
        console.warn('⚠️ Empresa sem setores cadastrados. NÃO MOSTRANDO licitações até configurar setores.')
        setProgressoPercentual(100)
        setMensagemProgresso('⚠️ Configure setores e estados no seu perfil')
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
    if (filtros.statusEdital) {
      resultado = resultado.filter(licitacao => {
        const status = getStatusEdital(licitacao)
        return status === filtros.statusEdital
      })
    }

    // Filtros de exclusão removidos temporariamente - será repensado

    // Aplicar filtros finais
    if (processandoFiltro) {
      setMensagemProgresso('Aplicando filtros finais...')
    }

    // Salvar no cache
    const cacheKeyFinal = getCacheKey()
    if (cacheKeyFinal) {
      try {
        localStorage.setItem(cacheKeyFinal, JSON.stringify({
          resultado,
          timestamp: Date.now()
        }))
        console.log('✅ [Cache] Resultado salvo no cache')
      } catch (e) {
        console.warn('⚠️ Erro ao salvar cache:', e)
      }
    }

    setLicitacoesFiltradas(resultado)
    
    // Finalizar processamento
    if (processandoFiltro) {
      setProgressoPercentual(100)
      setMensagemProgresso(`✅ ${resultado.length} licitação${resultado.length !== 1 ? 'ões' : ''} encontrada${resultado.length !== 1 ? 's' : ''}`)
      
      // Aguardar um momento para mostrar mensagem de sucesso, depois esconder
      setTimeout(() => {
        setProcessandoFiltro(false)
        setMensagemProgresso('')
        setProgressoPercentual(0)
      }, 1500)
    }
  }
    
    aplicarFiltros()
  }, [licitacoes, filtros.statusEdital, perfilUsuario, mistralApiKey, mostrarTodasLicitacoes])

  // Aplicar filtros permanentes - SEMPRE APLICAR PRIMEIRO
  const { licitacoesFiltradas: licitacoesAposPermanentes, totalExcluido, totalIncluido } = useMemo(() => {
    return aplicarFiltrosPermanentes(licitacoesFiltradas)
  }, [licitacoesFiltradas, filtrosPermanentesAtivos, aplicarFiltrosPermanentes])

  // Licitações finais (após filtros permanentes)
  const licitacoesFinais = licitacoesAposPermanentes

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
          aposFiltrosPermanentes: licitacoesFinais.length
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
    // Tentar buscar de diferentes lugares na estrutura JSONB
    const dataAbertura = licitacao.dados_completos?.dataAberturaProposta || 
                        licitacao.dados_completos?.data_abertura_proposta ||
                        licitacao.dados_completos?.dataAberturaPropostaData
    const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta || 
                             licitacao.dados_completos?.data_encerramento_proposta ||
                             licitacao.dados_completos?.dataEncerramentoPropostaData
    
    if (!dataAbertura && !dataEncerramento) {
      return false
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
    
    // Se está expandindo E não tem resumo ainda, gerar
    if (!estaExpandido && !resumosIA[licitacaoId]) {
      gerarResumo(licitacaoId, licitacao)
    }
  }

  const gerarResumo = async (licitacaoId, licitacao) => {
    // Marcar como loading
    setResumosIA(prev => ({
      ...prev,
      [licitacaoId]: { loading: true, resumo: null, erro: null }
    }))

    try {
      const mistralApiKey = import.meta.env.VITE_MISTRAL_API_KEY

      if (!mistralApiKey) {
        throw new Error('Chave da API Mistral não configurada')
      }

      // Preparar contexto da licitação
      const contextoLicitacao = `
EDITAL: ${licitacao.numero_controle_pncp}
OBJETO: ${licitacao.objeto_compra}
ÓRGÃO: ${licitacao.orgao_razao_social} (${licitacao.uf_sigla})
MODALIDADE: ${licitacao.modalidade_nome}
VALOR: R$ ${licitacao.valor_total_estimado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'Não informado'}
PUBLICAÇÃO: ${formatarData(licitacao.data_publicacao_pncp)}
${licitacao.dados_completos?.dataAberturaProposta ? `ABERTURA: ${formatarData(licitacao.dados_completos.dataAberturaProposta)}` : ''}
${licitacao.dados_completos?.dataEncerramentoProposta ? `ENCERRAMENTO: ${formatarData(licitacao.dados_completos.dataEncerramentoProposta)}` : ''}
ITENS: ${licitacao.itens?.length || 0}
DOCUMENTOS: ${licitacao.anexos?.length || 0}
      `.trim()

      // Preparar contexto da empresa logada
      let cnaesSecundarios = []
      try {
        if (user?.cnaes_secundarios) {
          cnaesSecundarios = Array.isArray(user.cnaes_secundarios) 
            ? user.cnaes_secundarios 
            : JSON.parse(user.cnaes_secundarios)
        }
      } catch (e) {
        console.warn('Erro ao parsear CNAEs:', e)
        cnaesSecundarios = []
      }
      
      const perfilEmpresa = user ? `
EMPRESA LOGADA:
Razão Social: ${user.razao_social || 'Não informado'}
CNPJ: ${user.cnpj || 'Não informado'}
CNAE Principal: ${user.cnae_principal || 'Não informado'}
CNAEs Secundários: ${cnaesSecundarios.length > 0 ? cnaesSecundarios.join(', ') : 'Nenhum'}
Porte: ${user.porte_empresa || 'Não informado'}
UF: ${user.uf || 'Não informado'}
      `.trim() : ''

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mistralApiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente especializado em análise de licitações públicas brasileiras. Seja objetivo, técnico e preciso. NUNCA use emojis.'
            },
            {
              role: 'user',
              content: `Analise esta licitação e crie um resumo executivo profissional em UM ÚNICO PARÁGRAFO (máximo 120 palavras).

ESTRUTURA OBRIGATÓRIA:
1. Inicie com "Edital [NÚMERO] - [MODALIDADE]"
2. Descreva o objeto resumidamente
3. Informe valor e prazo de encerramento
4. Avalie a compatibilidade da empresa com base nos CNAEs (use ALTA/MÉDIA/BAIXA em NEGRITO)
5. Finalize com recomendação clara (PARTICIPAR ou NÃO PARTICIPAR em NEGRITO)

${contextoLicitacao}

${perfilEmpresa}

REGRAS CRÍTICAS:
- UM ÚNICO PARÁGRAFO, texto corrido
- Use **negrito** para destacar: COMPATIBILIDADE, VALOR, PRAZO e RECOMENDAÇÃO
- SEM emojis, SEM quebras de linha, SEM listas
- Linguagem técnica e objetiva
- Foque na análise de aderência aos CNAEs da empresa`
            }
          ],
          temperature: 0.2,
          max_tokens: 300
        })
      })

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`)
      }

      const data = await response.json()
      const resumo = data.choices[0].message.content

      // Salvar resumo
      setResumosIA(prev => ({
        ...prev,
        [licitacaoId]: { loading: false, resumo, erro: null }
      }))

    } catch (error) {
      console.error('❌ Erro ao gerar resumo:', error)
      setResumosIA(prev => ({
        ...prev,
        [licitacaoId]: { 
          loading: false, 
          resumo: null, 
          erro: error.message 
        }
      }))
    }
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
    setFiltros({
      buscaObjeto: '',
      uf: '',
      modalidade: '',
      statusEdital: '',
      dataPublicacaoInicio: '',
      dataPublicacaoFim: '',
      valorMin: '',
      valorMax: '',
      orgao: '',
      numeroEdital: '',
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
    })
    setDataFiltro('')
    setMostrarTodasLicitacoes(false) // Desativar modo "mostrar todas"
    window.history.pushState({}, '', '/licitacoes')
  }

  const aplicarFiltros = () => {
    // Desativar modo "mostrar todas" quando aplicar filtros
    setMostrarTodasLicitacoes(false)
    queryClient.invalidateQueries(['licitacoes'])
    console.log('🔍 Filtros aplicados:', filtros)
  }

  const contarFiltrosAtivos = () => {
    let count = 0
    if (filtros.buscaObjeto) count++
    if (filtros.uf) count++
    if (filtros.modalidade) count++
    if (filtros.statusEdital) count++
    if (filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim) count++
    if (filtros.valorMin || filtros.valorMax) count++
    if (filtros.orgao) count++
    if (filtros.numeroEdital) count++
    if (filtros.comDocumentos) count++
    if (filtros.comItens) count++
    if (filtros.comValor) count++
    if (dataFiltro) count++
    return count
  }

  const atalhoHoje = () => {
    const hoje = new Date().toISOString().split('T')[0]
    setFiltros({ ...filtros, dataPublicacaoInicio: hoje, dataPublicacaoFim: hoje })
  }

  const atalhoOntem = () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    setFiltros({ ...filtros, dataPublicacaoInicio: ontem, dataPublicacaoFim: ontem })
  }

  const atalhoUltimaSemana = () => {
    const hoje = new Date().toISOString().split('T')[0]
    const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    setFiltros({ ...filtros, dataPublicacaoInicio: semanaAtras, dataPublicacaoFim: hoje })
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
                  onClick={aplicarFiltros}
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
                      // Limpar cache quando ativar
                      const cacheKey = getCacheKey()
                      if (cacheKey) {
                        localStorage.removeItem(cacheKey)
                      }
                      queryClient.invalidateQueries(['licitacoes'])
                      console.log('📋 [Filtro] Modo "Mostrar Todas" ATIVADO')
                    } else {
                      // Limpar cache quando desativar para reaplicar filtro
                      const cacheKey = getCacheKey()
                      if (cacheKey) {
                        localStorage.removeItem(cacheKey)
                      }
                      queryClient.invalidateQueries(['licitacoes'])
                      console.log('📋 [Filtro] Modo "Mostrar Todas" DESATIVADO - voltando ao filtro semântico')
                    }
                  }}
                  className="data-[state=checked]:bg-blue-400"
                />
              </div>
            </div>

            {/* Busca Rápida */}
            <div className="mb-4">
              <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Filter className="w-4 h-4 text-orange-500" />
                Busca Rápida
              </Label>
              <Input
                placeholder="Buscar por objeto..."
                value={filtros.buscaObjeto}
                onChange={(e) => setFiltros({ ...filtros, buscaObjeto: e.target.value })}
                className="h-10"
              />
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
                
                  {/* Busca por Objeto */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      Busca por Objeto
                    </Label>
                    <Input
                      placeholder="Buscar por objeto..."
                      value={filtros.buscaObjeto}
                      onChange={(e) => setFiltros({ ...filtros, buscaObjeto: e.target.value })}
                      className="h-9 text-xs"
                    />
            </div>

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
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={atalhoHoje} className="text-xs h-7 px-2 flex-1">Hoje</Button>
                      <Button variant="ghost" size="sm" onClick={atalhoOntem} className="text-xs h-7 px-2 flex-1">Ontem</Button>
                      <Button variant="ghost" size="sm" onClick={atalhoUltimaSemana} className="text-xs h-7 px-2 flex-1">7 dias</Button>
      </div>
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
                        <SelectItem value="andamento">Em Andamento</SelectItem>
                        <SelectItem value="encerrando">Encerrando (≤ 3 dias)</SelectItem>
                        <SelectItem value="encerrado">Encerrado</SelectItem>
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

                  {/* Órgão */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      Órgão
                    </Label>
                    <Input
                      placeholder="Nome do órgão"
                      value={filtros.orgao}
                      onChange={(e) => setFiltros({ ...filtros, orgao: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                
                  {/* N° Edital */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      N° Edital
                    </Label>
                    <Input
                      placeholder="Número do edital"
                      value={filtros.numeroEdital}
                      onChange={(e) => setFiltros({ ...filtros, numeroEdital: e.target.value })}
                      className="h-9 text-xs"
                    />
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

              {/* SEÇÃO FILTROS PERMANENTES */}
              <AccordionItem value="filtros-permanentes">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-orange-500" />
                    Filtros Permanentes
                    {filtrosPermanentes && filtrosPermanentes.length > 0 && (
                      <Badge className="bg-orange-500 text-white text-xs ml-2">
                        {filtrosPermanentes.length}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-3">
                  <FiltrosPermanentes />
                  
                  {/* Contadores */}
                  {filtrosPermanentesAtivos && filtrosPermanentesAtivos.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {totalIncluido > 0 && (
                        <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-xs text-green-700">
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                            {totalIncluido} edital{totalIncluido > 1 ? 'is' : ''} incluído{totalIncluido > 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                      {totalExcluido > 0 && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-xs text-blue-700">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            {totalExcluido} edital{totalExcluido > 1 ? 'is' : ''} excluído{totalExcluido > 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
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
                    Objeto: {filtros.buscaObjeto}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, buscaObjeto: '' })} />
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
                      filtros.statusEdital === 'andamento' ? 'Em Andamento' :
                      filtros.statusEdital === 'encerrando' ? 'Encerrando' :
                      'Encerrado'
                    }
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, statusEdital: '' })} />
                  </Badge>
                )}
                {(filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim) && (
                  <Badge variant="secondary" className="gap-1">
                    Data: {filtros.dataPublicacaoInicio || '...'} - {filtros.dataPublicacaoFim || '...'}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, dataPublicacaoInicio: '', dataPublicacaoFim: '' })} />
                  </Badge>
                )}
                {(filtros.valorMin || filtros.valorMax) && (
                  <Badge variant="secondary" className="gap-1">
                    Valor: R$ {filtros.valorMin || '0'} - {filtros.valorMax || '∞'}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, valorMin: '', valorMax: '' })} />
                  </Badge>
                )}
                {filtros.orgao && (
                  <Badge variant="secondary" className="gap-1">
                    Órgão: {filtros.orgao}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFiltros({ ...filtros, orgao: '' })} />
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

          {/* Loading - Mostrar apenas enquanto carrega do banco */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
              <p className="text-gray-600 text-lg font-medium">
                Carregando licitações do banco de dados...
              </p>
            </div>
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
              {(filtros.buscaObjeto || filtros.uf || filtros.modalidade || filtros.statusEdital || 
                filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim || filtros.valorMin || 
                filtros.valorMax || filtros.orgao || filtros.numeroEdital || filtros.comDocumentos || 
                filtros.comItens || filtros.comValor || dataFiltro) && licitacoesFinais.length > 100 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Muitos resultados encontrados ({licitacoesFinais.length}). Considere adicionar mais filtros para refinar a busca.
                </p>
              )}
            </div>
          )}

          {/* Cards de Licitações - Mostrar quando não estiver carregando do banco */}
          {!isLoading && (
            <div className="space-y-4">
              {licitacoesFinais.length > 0 ? (
                licitacoesFinais.map((licitacao) => {
                  return (
            <Card 
              key={licitacao.id} 
              className="hover:shadow-lg transition-shadow border-l-4 border-l-orange-500"
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
                      {((licitacao.anexos && licitacao.anexos.length > 0) || 
                        (licitacao.itens && licitacao.itens.length > 0)) && 
                        !cardsExpandidos.has(licitacao.id) && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white"></span>
                      )}
                    </button>
                    
                    {/* Badges de indicadores (quando não expandido) */}
                    {!cardsExpandidos.has(licitacao.id) && (
                      <>
                        {licitacao.anexos && licitacao.anexos.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Download className="w-3 h-3 mr-1" />
                            {licitacao.anexos.length} doc{licitacao.anexos.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {licitacao.itens && licitacao.itens.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            {licitacao.itens.length} {licitacao.itens.length > 1 ? 'itens' : 'item'}
                          </Badge>
                        )}
                      </>
                              )}
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
                      // Tentar buscar de diferentes lugares na estrutura JSONB
                      const dataAbertura = licitacao.dados_completos?.dataAberturaProposta || 
                                          licitacao.dados_completos?.data_abertura_proposta ||
                                          licitacao.dados_completos?.dataAberturaPropostaData
                      const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta || 
                                               licitacao.dados_completos?.data_encerramento_proposta ||
                                               licitacao.dados_completos?.dataEncerramentoPropostaData
                      
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
                        </>
                      )
                    })()}
                    
                    {/* Badge de Status (Em Andamento / Encerrando / Encerrado) */}
                    {(() => {
                      // Tentar buscar de diferentes lugares na estrutura JSONB
                      const dataAbertura = licitacao.dados_completos?.dataAberturaProposta || 
                                          licitacao.dados_completos?.data_abertura_proposta ||
                                          licitacao.dados_completos?.dataAberturaPropostaData
                      const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta || 
                                               licitacao.dados_completos?.data_encerramento_proposta ||
                                               licitacao.dados_completos?.dataEncerramentoPropostaData
                      
                      if (dataEncerramento) {
                        const hoje = new Date()
                        const encerramento = new Date(dataEncerramento)
                        const diasRestantes = Math.ceil((encerramento - hoje) / (1000 * 60 * 60 * 24))
                        
                        // Encerrado
                        if (diasRestantes < 0) {
                          return (
                            <Badge className="bg-red-500 text-white text-xs font-semibold">
                              ❌ Encerrado
                            </Badge>
                          )
                        }
                        
                        // Encerrando em breve (menos de 3 dias)
                        if (diasRestantes <= 3 && diasRestantes > 0) {
                          return (
                            <Badge className="bg-yellow-500 text-white text-xs font-semibold animate-pulse">
                              ⚠️ Encerrando em {diasRestantes}d
                            </Badge>
                          )
                        }
                        
                        // Em andamento
                        if (dataAbertura) {
                          const abertura = new Date(dataAbertura)
                          if (hoje >= abertura && hoje <= encerramento) {
                            return (
                              <Badge className="bg-blue-500 text-white text-xs font-semibold">
                                ✅ Em Andamento
                              </Badge>
                            )
                          }
                        }
                      }
                      return null
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                  {/* Campo 4: Órgão */}
                  <div className="flex items-start gap-2 md:col-span-2">
                    <Building2 className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Órgão:</p>
                      <p className="text-sm text-gray-600">
                        {licitacao.orgao_razao_social || 'Não informado'}
                      </p>
                    </div>
                  </div>

                  {/* Campo 5: Edital */}
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Edital:</p>
                      <p className="text-sm text-gray-600 font-mono text-xs">
                        {licitacao.numero_controle_pncp}
                      </p>
                    </div>
                  </div>
                </div>

                <hr className="my-4" />

                {/* Valor */}
                {licitacao.valor_total_estimado && (
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Valor Estimado:</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatarValor(licitacao.valor_total_estimado)}
                      </p>
                            </div>
                                </div>
                              )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Nº Licitação: {licitacao.numero_controle_pncp}</span>
                            </div>
                  <div className="text-sm text-gray-500">
                    Atualizada em: {formatarData(licitacao.data_atualizacao)}
                        </div>
                      </div>

                {/* Seção Expansível com Detalhes (quando clica no olho) */}
                {cardsExpandidos.has(licitacao.id) && (
                  <div className="mt-6 pt-6 border-t space-y-6 animate-in slide-in-from-top-2">
                    {/* Resumo IA */}
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-purple-600" />
                        Resumo Inteligente (IA)
                        <Badge className="bg-purple-600 text-white text-xs">Mistral AI</Badge>
                      </h4>
                      
                      {/* Loading */}
                      {resumosIA[licitacao.id]?.loading && (
                        <div className="flex items-center gap-3 py-6">
                          <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                          <p className="text-sm text-gray-600">Gerando resumo inteligente...</p>
                        </div>
                      )}
                      
                      {/* Erro */}
                      {resumosIA[licitacao.id]?.erro && (
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                          <p className="text-sm text-red-700">
                            ⚠️ {resumosIA[licitacao.id].erro}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => gerarResumo(licitacao.id, licitacao)}
                            className="mt-2 text-xs"
                          >
                            Tentar novamente
                          </Button>
                        </div>
                      )}
                      
                      {/* Resumo */}
                      {resumosIA[licitacao.id]?.resumo && (
                        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                          <div 
                            className="text-sm text-gray-800 leading-loose text-justify"
                            dangerouslySetInnerHTML={{
                              __html: resumosIA[licitacao.id].resumo
                                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                            }}
                          />
                          
                          {/* Rodapé com info */}
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              Análise gerada por IA
                            </p>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(resumosIA[licitacao.id].resumo)
                                // TODO: Mostrar toast de sucesso
                              }}
                              className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                            >
                              Copiar resumo
                            </button>
                      </div>
                        </div>
                      )}
                        </div>

                    {/* Anexos/Documentos */}
                    {licitacao.anexos && licitacao.anexos.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Download className="w-5 h-5 text-blue-500" />
                          Documentos ({licitacao.anexos.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {licitacao.anexos.map((anexo, index) => (
                            <div 
                              key={index} 
                              className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all group"
                            >
                              {/* Nome do Documento */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || anexo.tipoDocumentoNome || `Documento ${index + 1}`}
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
                                    if (anexo.url) {
                                      const link = document.createElement('a')
                                      link.href = anexo.url
                                      link.download = anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || `documento-${index + 1}.pdf`
                                      link.target = '_blank'
                                      link.click()
                                    }
                                  }}
                                  className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                                  title="Baixar documento"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                
                                {/* Badge Visualizar Documento */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (anexo.url) {
                                      setDocumentoVisualizacao({
                                        url: anexo.url,
                                        nome: anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || `Documento ${index + 1}`
                                      })
                                      setVisualizadorAberto(true)
                                    }
                                  }}
                                  className="w-6 h-6 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors"
                                  title="Visualizar documento"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                
                                {/* Badge Chat IA */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDocumentoSelecionado({
                                      url: anexo.url,
                                      nome: anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || `Documento ${index + 1}`,
                                      licitacaoId: licitacao.id
                                    })
                                    setChatAberto(true)
                                  }}
                                  className="w-6 h-6 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-600 flex items-center justify-center transition-colors"
                                  title="Conversar com IA sobre este documento"
                                >
                                  <Brain className="w-3.5 h-3.5" />
                                </button>
                      </div>
                            </div>
                ))}
              </div>
                      </div>
                    )}

                    {/* Itens */}
                    {licitacao.itens && licitacao.itens.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-green-500" />
                          Itens da Licitação ({licitacao.itens.length})
                        </h4>
                        <div className="space-y-4">
                          {licitacao.itens.map((item, index) => (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
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
                                {/* Descrição */}
                                <p className="text-sm font-medium text-gray-900 leading-relaxed">
                                  {item.descricao || item.descricaoDetalhada || item.descricao_item || 'Sem descrição'}
                    </p>
                  </div>

                              {/* Informações Detalhadas */}
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-gray-50 p-3 rounded">
                                {/* Quantidade e Unidade */}
                                {item.quantidade && (
                                  <div>
                                    <span className="text-gray-500 block">Quantidade:</span>
                                    <span className="font-semibold text-gray-900">
                                      {item.quantidade} {item.unidadeMedida || item.unidade || ''}
                                    </span>
                </div>
              )}
                                
                                {/* Valor Unitário */}
                                {(item.valorUnitarioEstimado || item.valorUnitario) && (
                                  <div>
                                    <span className="text-gray-500 block">Valor Unitário:</span>
                                    <span className="font-semibold text-green-600">
                                      {formatarValor(item.valorUnitarioEstimado || item.valorUnitario)}
                                    </span>
    </div>
          )}
                                
                                {/* Valor Total */}
                                {item.valorTotal && (
                                  <div>
                                    <span className="text-gray-500 block">Valor Total:</span>
                                    <span className="font-semibold text-green-700 text-sm">
                                      {formatarValor(item.valorTotal)}
                                    </span>
        </div>
                                )}

                                {/* Critério de Julgamento */}
                                {item.criterioJulgamentoNome && (
                                  <div>
                                    <span className="text-gray-500 block">Critério:</span>
                                    <span className="font-medium text-gray-900">{item.criterioJulgamentoNome}</span>
                                  </div>
                                )}

                                {/* Categoria */}
                                {item.itemCategoriaNome && (
                                  <div>
                                    <span className="text-gray-500 block">Categoria:</span>
                                    <span className="font-medium text-gray-900">{item.itemCategoriaNome}</span>
    </div>
                                )}

                                {/* Tipo de Benefício */}
                                {item.tipoBeneficioNome && (
                                  <div>
                                    <span className="text-gray-500 block">Benefício:</span>
                                    <span className="font-medium text-gray-900">{item.tipoBeneficioNome}</span>
                                  </div>
                                )}

                                {/* NCM/NBS */}
                                {item.ncmNbsDescricao && (
                                  <div className="col-span-2">
                                    <span className="text-gray-500 block">NCM/NBS:</span>
                                    <span className="font-medium text-gray-900">
                                      {item.ncmNbsCodigo ? `${item.ncmNbsCodigo} - ` : ''}{item.ncmNbsDescricao}
                                    </span>
                                  </div>
                                )}
                              </div>

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
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
           !(filtros.buscaObjeto || filtros.uf || filtros.modalidade || filtros.statusEdital || 
             filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim || filtros.valorMin || 
             filtros.valorMax || filtros.orgao || filtros.numeroEdital || filtros.comDocumentos || 
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

      {/* Chat com Documento IA */}
      <ChatDocumento
        aberto={chatAberto}
        onFechar={() => {
          setChatAberto(false)
          setDocumentoSelecionado(null)
        }}
        documento={documentoSelecionado}
        licitacaoId={documentoSelecionado?.licitacaoId}
      />

      {/* Visualizador de Documento */}
      <VisualizadorDocumento
        open={visualizadorAberto}
        onOpenChange={setVisualizadorAberto}
        urlDocumento={documentoVisualizacao?.url}
        nomeArquivo={documentoVisualizacao?.nome}
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
