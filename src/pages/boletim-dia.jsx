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
  Brain
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
import { ChatDocumento } from '@/components/ChatDocumento'
import { VisualizadorDocumento } from '@/components/VisualizadorDocumento'
import { useFiltrosSalvos } from '@/hooks/useFiltrosSalvos'
import { useNotifications } from '@/hooks/useNotifications'
import { Save, FolderOpen, Trash2, Plus } from 'lucide-react'
import { obterNomeAtividadeCnae, obterListaCompletaCnaes, resumirNomeAtividade } from '@/lib/cnae'

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
  const [mostrarDialogSalvarFiltro, setMostrarDialogSalvarFiltro] = useState(false)
  const [nomeFiltroSalvo, setNomeFiltroSalvo] = useState('')
  
  // Hook para gerenciar filtros salvos
  const { filtrosSalvos, salvarFiltro, deletarFiltro, carregarFiltro } = useFiltrosSalvos()
  
  // Hook para notificações customizadas
  const { success, error: showError, warning, confirm } = useNotifications()

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
    excluirUfs: [], // Array de UFs para excluir
    excluirModalidades: [], // Array de modalidades para excluir
    excluirOrgaos: [], // Array de órgãos para excluir
    excluirSetores: [], // Array de setores/ramos para excluir (baseado em dados_completos)
    
    // Atividades Econômicas (CNAEs)
    atividadesCnaes: [], // Array de CNAEs selecionados
    
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
      console.log(`📅 Filtrando licitações do dia: ${dataFormatada}`)
        } else {
      setDataFiltro('')
      console.log('📋 Mostrando todas as licitações')
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
    const dataAbertura = licitacao.dados_completos?.dataAberturaProposta
    const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta
    
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
    queryKey: ['licitacoes', filtrosDebounced, dataFiltro, limitePagina],
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

      // FILTROS DE EXCLUSÃO (o que NÃO quer ver)
      // Nota: Supabase não suporta NOT IN diretamente, então filtramos após buscar
      
      // As exclusões serão aplicadas no useMemo após a query

      // Excluir Modalidades
      if (filtrosDebounced.excluirModalidades && filtrosDebounced.excluirModalidades.length > 0) {
        filtrosDebounced.excluirModalidades.forEach(modalidade => {
          query = query.not('modalidade_nome', 'ilike', `%${modalidade}%`)
        })
      }

      // Excluir Órgãos
      if (filtrosDebounced.excluirOrgaos && filtrosDebounced.excluirOrgaos.length > 0) {
        filtrosDebounced.excluirOrgaos.forEach(orgao => {
          query = query.not('orgao_razao_social', 'ilike', `%${orgao}%`)
        })
      }

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

      // Aplicar limite: 50 sem filtros, 500 com filtros (para performance)
      if (!temFiltrosAtivos) {
        query = query.limit(limitePagina)
      } else {
        // Com filtros, limitar a 500 para não sobrecarregar
        query = query.limit(500)
      }

      const { data, error } = await query

      if (error) throw error
      
      return data || []
    }
  })

  // Filtrar por status do edital e exclusões (memoizado)
  const licitacoesFiltradas = useMemo(() => {
    let resultado = licitacoes

    // Filtrar por status do edital
    if (filtros.statusEdital) {
      resultado = resultado.filter(licitacao => {
        const status = getStatusEdital(licitacao)
        return status === filtros.statusEdital
      })
    }

    // Aplicar exclusões
    if (filtros.excluirUfs && filtros.excluirUfs.length > 0) {
      const ufsExcluidas = filtros.excluirUfs.map(uf => uf.toUpperCase())
      resultado = resultado.filter(licitacao => 
        !ufsExcluidas.includes(licitacao.uf_sigla?.toUpperCase())
      )
    }

    if (filtros.excluirModalidades && filtros.excluirModalidades.length > 0) {
      resultado = resultado.filter(licitacao => {
        const modalidade = licitacao.modalidade_nome?.toLowerCase() || ''
        return !filtros.excluirModalidades.some(excluir => 
          modalidade.includes(excluir.toLowerCase())
        )
      })
    }

    if (filtros.excluirOrgaos && filtros.excluirOrgaos.length > 0) {
      resultado = resultado.filter(licitacao => {
        const orgao = licitacao.orgao_razao_social?.toLowerCase() || ''
        return !filtros.excluirOrgaos.some(excluir => 
          orgao.includes(excluir.toLowerCase())
        )
      })
    }

        return resultado
  }, [licitacoes, filtros.statusEdital, filtros.excluirUfs, filtros.excluirModalidades, filtros.excluirOrgaos, getStatusEdital])

  // Licitações finais (sem filtro de distância)
  const licitacoesFinais = licitacoesFiltradas

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
    if (!licitacao.dados_completos?.dataAberturaProposta && !licitacao.dados_completos?.dataEncerramentoProposta) {
      return false
        }
        
    const dataAbertura = licitacao.dados_completos?.dataAberturaProposta
    const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta
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
          console.error('❌ Erro ao remover:', error)
          throw error
        }
        console.log('✅ Removido dos favoritos')
      } else {
        // Verificar se já existe (evitar 409)
        console.log('🔍 Verificando se já existe...')
        const { data: existente } = await supabase
        .from('licitacoes_favoritas')
        .select('id')
        .eq('usuario_id', user.id)
          .eq('licitacao_id', licitacao.id)
        .maybeSingle()

        if (existente) {
          console.log('⚠️ Já existe nos favoritos')
          return { licitacaoId: licitacao.id, isFavorito: false }
        }

        // Adicionar
        console.log('⭐ Adicionando aos favoritos...')
        const { error } = await supabase
          .from('licitacoes_favoritas')
          .insert({
            usuario_id: user.id,
            licitacao_id: licitacao.id,
            data_adicao: new Date().toISOString()
          })

        if (error) {
          console.error('❌ Erro ao adicionar:', error)
          throw error
        }
        console.log('✅ Adicionado aos favoritos')
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
    
    // CNAE Principal
    if (user.cnae_principal) {
      cnaes.push({
        codigo: user.cnae_principal,
        tipo: 'principal'
      })
    }
    
    // CNAEs Secundários
    try {
      if (user.cnaes_secundarios) {
        const cnaesSecundarios = Array.isArray(user.cnaes_secundarios) 
          ? user.cnaes_secundarios 
          : JSON.parse(user.cnaes_secundarios)
        
        cnaesSecundarios.forEach(cnae => {
          if (cnae && !cnaes.find(c => c.codigo === cnae)) {
            cnaes.push({
              codigo: cnae,
              tipo: 'secundario'
            })
          }
        })
      }
    } catch (e) {
      console.warn('Erro ao parsear CNAEs secundários:', e)
    }
    
    return cnaes
  }, [user])

  // Lista completa de CNAEs disponíveis (empresa + comuns)
  const listaCompletaCnaes = useMemo(() => {
    try {
      return obterListaCompletaCnaes(cnaesEmpresa)
    } catch (error) {
      console.error('Erro ao obter lista de CNAEs:', error)
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
      excluirModalidades: [],
      excluirOrgaos: [],
      excluirSetores: [],
      atividadesCnaes: []
    })
    setDataFiltro('')
    window.history.pushState({}, '', '/licitacoes')
  }

  // Salvar filtro atual
  const handleSalvarFiltro = async () => {
    if (!nomeFiltroSalvo.trim()) {
      warning('Por favor, digite um nome para o filtro')
      return
    }

    try {
      // Separar filtros de inclusão e exclusão
      const filtrosInclusao = {
        buscaObjeto: filtros.buscaObjeto,
        uf: filtros.uf,
        modalidade: filtros.modalidade,
        dataPublicacaoInicio: filtros.dataPublicacaoInicio,
        dataPublicacaoFim: filtros.dataPublicacaoFim,
        valorMin: filtros.valorMin,
        valorMax: filtros.valorMax,
        statusEdital: filtros.statusEdital,
        orgao: filtros.orgao,
        numeroEdital: filtros.numeroEdital,
        comDocumentos: filtros.comDocumentos,
        comItens: filtros.comItens,
        comValor: filtros.comValor,
        situacao: filtros.situacao,
        esfera: filtros.esfera,
        modoDisputa: filtros.modoDisputa,
        amparoLegal: filtros.amparoLegal,
      }

      const filtrosExclusao = {
        excluirUfs: filtros.excluirUfs || [],
        excluirModalidades: filtros.excluirModalidades || [],
        excluirOrgaos: filtros.excluirOrgaos || [],
        excluirSetores: filtros.excluirSetores || [],
      }

      const filtrosCnaes = {
        atividadesCnaes: filtros.atividadesCnaes || [],
      }

      await salvarFiltro.mutateAsync({
        nome: nomeFiltroSalvo,
        descricao: '',
        filtrosInclusao,
        filtrosExclusao,
        filtrosCnaes,
      })

      setMostrarDialogSalvarFiltro(false)
      setNomeFiltroSalvo('')
      success('Filtro salvo com sucesso!')
    } catch (err) {
      console.error('Erro ao salvar filtro:', err)
      showError('Erro ao salvar filtro: ' + (err.message || 'Erro desconhecido'))
    }
  }

  // Carregar filtro salvo
  const handleCarregarFiltro = async (filtroId) => {
    try {
      const filtroSalvo = await carregarFiltro(filtroId)
      
      if (filtroSalvo) {
        // Aplicar filtros de inclusão
        const inclusao = filtroSalvo.filtros_inclusao || {}
        const exclusao = filtroSalvo.filtros_exclusao || {}
        
        const cnaes = filtroSalvo.filtros_cnaes || {}
        setFiltros({
          ...filtros,
          ...inclusao,
          excluirUfs: exclusao.excluirUfs || [],
          excluirModalidades: exclusao.excluirModalidades || [],
          excluirOrgaos: exclusao.excluirOrgaos || [],
          excluirSetores: exclusao.excluirSetores || [],
          atividadesCnaes: cnaes.atividadesCnaes || [],
        })

        // Aplicar filtros
        queryClient.invalidateQueries(['licitacoes'])
        success(`Filtro "${filtroSalvo.nome}" carregado com sucesso!`)
      }
    } catch (error) {
      console.error('Erro ao carregar filtro:', error)
      showError('Erro ao carregar filtro: ' + error.message)
    }
  }

  // Deletar filtro salvo
  const handleDeletarFiltro = async (filtroId, e) => {
    e.stopPropagation()
    
    const confirmed = await confirm('Tem certeza que deseja excluir este filtro?', {
      title: 'Excluir filtro',
      description: 'Esta ação não pode ser desfeita.',
      variant: 'destructive',
    })
    
    if (!confirmed) {
      return
    }

    try {
      await deletarFiltro.mutateAsync(filtroId)
      success('Filtro excluído com sucesso!')
    } catch (error) {
      console.error('Erro ao deletar filtro:', error)
      showError('Erro ao deletar filtro: ' + error.message)
    }
  }

  const aplicarFiltros = () => {
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
            <div className="flex gap-2 mb-6">
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

                {/* Atividades Econômicas (CNAEs) */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    Atividades Econômicas (CNAEs)
                  </Label>
                  <Select
                    onValueChange={(value) => {
                      if (value && !filtros.atividadesCnaes?.includes(value)) {
                        setFiltros({
                          ...filtros,
                          atividadesCnaes: [...(filtros.atividadesCnaes || []), value]
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione atividade econômica" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {listaCompletaCnaes.length > 0 ? (
                        listaCompletaCnaes.map((cnae) => {
                          const nomeResumido = resumirNomeAtividade(cnae.nome, 55)
                          const jaSelecionado = filtros.atividadesCnaes?.includes(cnae.codigo)
                          return (
                            <SelectItem 
                              key={cnae.codigo} 
                              value={cnae.codigo}
                              disabled={jaSelecionado}
                              className={cnae.tipo === 'principal' ? 'bg-blue-50 font-semibold' : cnae.tipo === 'secundario' ? 'bg-blue-25' : ''}
                            >
                              <div className="flex items-center gap-2">
                                {cnae.tipo === 'principal' && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                {cnae.tipo === 'secundario' && <Star className="w-3 h-3 text-gray-400" />}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate">{nomeResumido}</div>
                                  <div className="text-[10px] text-gray-500">{cnae.codigo}</div>
                                </div>
                              </div>
                            </SelectItem>
                          )
                        })
                      ) : (
                        <SelectItem value="" disabled>Carregando CNAEs...</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {filtros.atividadesCnaes && filtros.atividadesCnaes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {filtros.atividadesCnaes.map(codigoCnae => {
                        const cnaeInfo = listaCompletaCnaes.find(c => c.codigo === codigoCnae)
                        const nomeCompleto = cnaeInfo?.nome || obterNomeAtividadeCnae(codigoCnae) || codigoCnae
                        const nomeResumido = resumirNomeAtividade(nomeCompleto, 50)
                        return (
                          <Badge 
                            key={codigoCnae} 
                            variant="secondary" 
                            className="text-xs max-w-[220px] px-2 py-1"
                            title={nomeCompleto}
                          >
                            <span className="truncate">{nomeResumido}</span>
                            <X 
                              className="w-3 h-3 ml-1 cursor-pointer flex-shrink-0 hover:text-red-500" 
                              onClick={() => setFiltros({
                                ...filtros,
                                atividadesCnaes: filtros.atividadesCnaes.filter(c => c !== codigoCnae)
                              })}
                            />
                          </Badge>
                        )
                      })}
              </div>
                  )}
                </div>

                {/* Seção: Exclusões */}
                <div className="space-y-3 pt-3 border-t">
                  <Label className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <X className="w-4 h-4 text-red-500" />
                    Excluir (não mostrar)
                  </Label>
                  
                  {/* Excluir UFs */}
                <div>
                    <Label className="text-xs font-medium text-gray-600 mb-1 block">
                      Estados (UF)
                  </Label>
                  <Select
                      onValueChange={(value) => {
                        if (value && !filtros.excluirUfs?.includes(value)) {
                          setFiltros({
                            ...filtros,
                            excluirUfs: [...(filtros.excluirUfs || []), value]
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecione UF para excluir" />
                    </SelectTrigger>
                      <SelectContent>
                        {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                          <SelectItem key={uf} value={uf} disabled={filtros.excluirUfs?.includes(uf)}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                    {filtros.excluirUfs && filtros.excluirUfs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {filtros.excluirUfs.map(uf => (
                          <Badge key={uf} variant="destructive" className="text-xs">
                            {uf}
                            <X 
                              className="w-3 h-3 ml-1 cursor-pointer" 
                              onClick={() => setFiltros({
                                ...filtros,
                                excluirUfs: filtros.excluirUfs.filter(u => u !== uf)
                              })}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                </div>

                  {/* Excluir Modalidades */}
                <div>
                    <Label className="text-xs font-medium text-gray-600 mb-1 block">
                      Modalidades
                  </Label>
                  <Input
                      placeholder="Digite modalidade para excluir"
                      defaultValue=""
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          const modalidade = e.target.value.trim()
                          if (!filtros.excluirModalidades?.includes(modalidade)) {
                            setFiltros({
                              ...filtros,
                              excluirModalidades: [...(filtros.excluirModalidades || []), modalidade]
                            })
                            e.target.value = ''
                          }
                        }
                      }}
                      className="h-9 text-xs"
                    />
                    {filtros.excluirModalidades && filtros.excluirModalidades.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {filtros.excluirModalidades.map(modalidade => (
                          <Badge key={modalidade} variant="destructive" className="text-xs">
                            {modalidade}
                            <X 
                              className="w-3 h-3 ml-1 cursor-pointer" 
                              onClick={() => setFiltros({
                                ...filtros,
                                excluirModalidades: filtros.excluirModalidades.filter(m => m !== modalidade)
                              })}
                            />
                          </Badge>
                        ))}
                </div>
                  )}
              </div>

                {/* Excluir Órgãos */}
                <div>
                    <Label className="text-xs font-medium text-gray-600 mb-1 block">
                      Órgãos
                    </Label>
                    <Input
                      placeholder="Digite órgão para excluir"
                      defaultValue=""
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          const orgao = e.target.value.trim()
                          if (!filtros.excluirOrgaos?.includes(orgao)) {
                            setFiltros({
                              ...filtros,
                              excluirOrgaos: [...(filtros.excluirOrgaos || []), orgao]
                            })
                            e.target.value = ''
                          }
                        }
                      }}
                      className="h-9 text-xs"
                    />
                    {filtros.excluirOrgaos && filtros.excluirOrgaos.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {filtros.excluirOrgaos.map(orgao => (
                          <Badge key={orgao} variant="destructive" className="text-xs max-w-[200px] truncate">
                            {orgao}
                            <X 
                              className="w-3 h-3 ml-1 cursor-pointer" 
                              onClick={() => setFiltros({
                                ...filtros,
                                excluirOrgaos: filtros.excluirOrgaos.filter(o => o !== orgao)
                              })}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
            </div>
          </div>

                {/* Botão Salvar Filtro */}
                <div className="pt-3 border-t">
                  {mostrarDialogSalvarFiltro ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome do filtro"
                        value={nomeFiltroSalvo}
                        onChange={(e) => setNomeFiltroSalvo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSalvarFiltro()
                          } else if (e.key === 'Escape') {
                            setMostrarDialogSalvarFiltro(false)
                            setNomeFiltroSalvo('')
                          }
                        }}
                        className="h-9 text-xs flex-1"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSalvarFiltro}
                        disabled={salvarFiltro.isPending}
                        className="h-9 px-3"
                      >
                        {salvarFiltro.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setMostrarDialogSalvarFiltro(false)
                          setNomeFiltroSalvo('')
                        }}
                        className="h-9 px-3"
                      >
                        <X className="w-4 h-4" />
                      </Button>
            </div>
          ) : (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setMostrarDialogSalvarFiltro(true)}
                      className="h-9 w-full text-xs"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Filtro Atual
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

              {/* MEUS FILTROS - Apenas filtros salvos */}
              <AccordionItem value="meus-filtros">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-blue-500" />
                    Meus Filtros
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-3">
                  {filtrosSalvos.length === 0 ? (
                    <div className="text-center py-6">
                      <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 italic">
                        Nenhum filtro salvo
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtrosSalvos.map((filtro) => (
                        <Card
                          key={filtro.id}
                          className="cursor-pointer transition-all hover:shadow-sm border-gray-200 hover:border-blue-300 group"
                          onClick={() => handleCarregarFiltro(filtro.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Filter className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                  <h4 className="font-medium text-sm text-gray-900 truncate">
                                    {filtro.nome}
                                  </h4>
                                </div>
                                {filtro.descricao && (
                                  <p className="text-xs text-gray-600 line-clamp-1 mb-1">
                                    {filtro.descricao}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {filtro.filtros_inclusao?.uf && (
                                    <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                      {filtro.filtros_inclusao.uf}
                                    </span>
                                  )}
                                  {filtro.filtros_inclusao?.modalidade && (
                                    <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                                      {filtro.filtros_inclusao.modalidade}
                                    </span>
                                  )}
                                  {filtro.filtros_cnaes && Object.keys(filtro.filtros_cnaes).length > 0 && (
                                    <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                                      CNAEs
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeletarFiltro(filtro.id, e)
                                }}
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-red-500 flex-shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
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

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-4" />
              <p className="text-gray-600">Carregando licitações...</p>
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

          {/* Resultados */}
          {!isLoading && !error && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {licitacoesFinais.length} {licitacoesFinais.length === 1 ? 'licitação encontrada' : 'licitações encontradas'}
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

          {/* Cards de Licitações */}
              <div className="space-y-4">
                {licitacoesFinais.map((licitacao) => (
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
                      <Badge variant="destructive" className="bg-red-500 animate-pulse">
                        URGENTE
                      </Badge>
                    )}
                    
                    {/* Badges de Data de Abertura e Encerramento */}
                    {licitacao.dados_completos?.dataAberturaProposta && (
                      <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                        Abertura: {formatarData(licitacao.dados_completos.dataAberturaProposta)}
                      </Badge>
                    )}
                    {licitacao.dados_completos?.dataEncerramentoProposta && (
                      <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                        Encerramento: {formatarData(licitacao.dados_completos.dataEncerramentoProposta)}
                      </Badge>
                    )}
                    
                    {/* Badge de Status (Em Andamento / Encerrando / Encerrado) */}
                    {(() => {
                      const dataAbertura = licitacao.dados_completos?.dataAberturaProposta
                      const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta
                      
                      if (dataEncerramento) {
                        const hoje = new Date()
                        const encerramento = new Date(dataEncerramento)
                        const diasRestantes = Math.ceil((encerramento - hoje) / (1000 * 60 * 60 * 24))
                        
                        // Encerrado
                        if (diasRestantes < 0) {
                          return (
                            <Badge className="bg-red-500 text-white text-xs">
                              Encerrado
                            </Badge>
                          )
                        }
                        
                        // Encerrando em breve (menos de 3 dias)
                        if (diasRestantes <= 3 && diasRestantes > 0) {
                          return (
                            <Badge className="bg-yellow-500 text-white text-xs animate-pulse">
                              Encerrando em {diasRestantes}d
                            </Badge>
                          )
                        }
                        
                        // Em andamento
                        if (dataAbertura) {
                          const abertura = new Date(dataAbertura)
                          if (hoje >= abertura && hoje <= encerramento) {
                            return (
                              <Badge className="bg-blue-500 text-white text-xs">
                                Em Andamento
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
                ))}
              </div>

          {/* Botão Carregar Mais (apenas sem filtros) */}
          {!isLoading && !error && licitacoesFinais.length >= limitePagina && 
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
              
          {/* Empty State */}
          {!isLoading && !error && licitacoesFinais.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhuma licitação encontrada
                </h3>
                <p className="text-gray-600">
                  Tente ajustar os filtros para ver mais resultados
                </p>
              </CardContent>
            </Card>
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
