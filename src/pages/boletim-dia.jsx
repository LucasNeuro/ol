import { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react'
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
  Trash2,
  MessageCircle,
  Send,
  Phone,
  Search,
  SlidersHorizontal,
  Mail
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
import { useWhatsAppRateLimit } from '@/hooks/useWhatsAppRateLimit'
import { usePalavrasFortes } from '@/hooks/usePalavrasFortes'
import { usePalavrasIncompatibilidade } from '@/hooks/usePalavrasIncompatibilidade'
import { obterNomeAtividadeCnae, obterListaCompletaCnaes, resumirNomeAtividade } from '@/lib/cnae'
import { 
  extrairPalavrasChaveDosSetores, 
  obterObjetoCompleto,
  normalizarTexto,
  calcularScoreAderencia
} from '@/lib/filtroSemantico'
import { filtrarLicitacoesPorBusca, buscarEmLicitacao } from '@/lib/buscaFuzzy'
import { useFiltroContext } from '@/contexts/FiltroContext'
import { isZipFile, descompactarZip, limparBlobUrls } from '@/lib/zipService'
import { LicitacaoCardSkeletonList } from '@/components/LicitacaoCardSkeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// Ícone WhatsApp (logo preta)
function IconWhatsApp({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// Máscara de telefone: (11) 99999-9999
function maskTelefone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

// Modal com estado local para não travar ao digitar (evita re-render do pai a cada tecla)
function ModalEnviarWhatsApp({ open, licitacao, onClose, onEnviar, enviando }) {
  const [localNumero, setLocalNumero] = useState('')
  useEffect(() => {
    if (open) setLocalNumero('')
  }, [open])
  const handleChange = (e) => setLocalNumero(maskTelefone(e.target.value))
  const rawNumero = localNumero.replace(/\D/g, '')
  const valido = rawNumero.length >= 10
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm p-5">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold">Enviar para WhatsApp</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Número com DDD. Os dados do edital serão enviados para esse número.
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <Input
            type="tel"
            placeholder="(11) 99999-9999"
            value={localNumero}
            onChange={handleChange}
            className="h-10 text-base"
            disabled={enviando}
            aria-label="Número WhatsApp"
            maxLength={16}
          />
          {licitacao && (
            <p className="text-xs text-muted-foreground mt-2 truncate" title={licitacao.objeto_licitacao || licitacao.numero_controle_pncp}>
              {licitacao.objeto_licitacao?.slice(0, 50) || licitacao.numero_controle_pncp || '—'}
              {(licitacao.objeto_licitacao?.length || 0) > 50 ? '…' : ''}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button size="sm" onClick={() => onEnviar(localNumero)} disabled={enviando || !valido} className="bg-green-600 hover:bg-green-700">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {enviando ? 'Enviando…' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
  const MAX_LICITACOES_EXIBIR = 200 // evita travar a UI com milhares de cards
  const [arquivosZipDescompactados, setArquivosZipDescompactados] = useState({}) // { anexoKey: { loading, arquivos, erro } }
  const [baixandoDocumentos, setBaixandoDocumentos] = useState(new Set()) // IDs de licitações sendo processadas
  const [whatsAppModalLicitacao, setWhatsAppModalLicitacao] = useState(null)
  const [whatsAppNumero, setWhatsAppNumero] = useState('')
  const [whatsAppEnviando, setWhatsAppEnviando] = useState(false)
  // Lista dinâmica de números WhatsApp (até 3): adicionar por um campo, minilista abaixo com opção de excluir
  const [listaNumerosWhatsApp, setListaNumerosWhatsApp] = useState([])
  const [whatsAppNovoNumero, setWhatsAppNovoNumero] = useState('')
  const [whatsAppNovoLabel, setWhatsAppNovoLabel] = useState('')
  const [whatsAppSlotsSaving, setWhatsAppSlotsSaving] = useState(false)
  const [alertaEmailAtivo, setAlertaEmailAtivo] = useState(false)
  const [alertaEmailHorario, setAlertaEmailHorario] = useState('08:00')
  const [alertaResumoSemanalAtivo, setAlertaResumoSemanalAtivo] = useState(false)
  // Quando o usuário clica em um card "Recomendadas", exibe só esse edital na tela
  const [recomendadaSelecionada, setRecomendadaSelecionada] = useState(null)
  const [alertaEmailDestino, setAlertaEmailDestino] = useState('')
  const [alertaEmailSaving, setAlertaEmailSaving] = useState(false)

  // Buscar alerta E-mail do usuário (tipo email)
  const { data: alertaEmail } = useQuery({
    queryKey: ['alerta-email', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from('alertas_usuario')
        .select('id, ativo, horario_verificacao, filtros, email_notificacao, resumo_semanal_ativo')
        .eq('usuario_id', user.id)
        .eq('tipo', 'email')
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (alertaEmail) {
      setAlertaEmailAtivo(!!alertaEmail.ativo)
      const t = alertaEmail.horario_verificacao
      if (t) setAlertaEmailHorario(String(t).slice(0, 5))
      setAlertaEmailDestino(alertaEmail.email_notificacao ?? '')
      setAlertaResumoSemanalAtivo(!!alertaEmail.resumo_semanal_ativo)
    }
  }, [alertaEmail])

  // Números WhatsApp cadastrados (sidebar – até 3)
  const { data: numerosWhatsApp = [], refetch: refetchNumerosWhatsApp } = useQuery({
    queryKey: ['usuario-whatsapp-numeros', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('usuario_whatsapp_numeros')
        .select('id, numero_telefone, label, ordem')
        .eq('usuario_id', user.id)
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!user?.id,
  })

  // Sincronizar lista de números com os já salvos no banco
  useEffect(() => {
    if (!Array.isArray(numerosWhatsApp)) return
    const list = numerosWhatsApp
      .filter((n) => (n.numero_telefone || '').replace(/\D/g, '').length >= 10)
      .map((n) => ({
        numero_telefone: n.numero_telefone,
        label: n.label || '',
      }))
    setListaNumerosWhatsApp(list)
  }, [numerosWhatsApp])

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

  // Hook para rate limiting de WhatsApp
  const { checkRateLimit, registerSend, LIMITE_POR_HORA } = useWhatsAppRateLimit()

  // Buscar perfil do usuário (setores e estados — essenciais para trazer licitações já filtradas do banco)
  const { data: perfilUsuario } = useQuery({
    queryKey: ['perfil-usuario', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data, error } = await supabase
          .from('profiles')
          .select('setores_atividades, estados_interesse, email')
          .eq('id', user.id)
          .maybeSingle()
      if (error) {
        return null
      }
      return data ? { ...data, sinonimos_personalizados: {} } : null
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

      return sinonimosFormatados
    },
    enabled: !!perfilUsuario?.setores_atividades && perfilUsuario.setores_atividades.length > 0,
    staleTime: 1000 * 60 * 60, // Cache por 1 hora
  })

  // Palavras fortes e incompatíveis por setor (do banco: setores_palavras_fortes, setores_palavras_incompatibilidade)
  const { data: palavrasFortesPorSetor = {} } = usePalavrasFortes()
  const { data: palavrasIncompatibilidadePorSetor = {} } = usePalavrasIncompatibilidade()

  // Atividades (subsetores) com IDs para o filtro "Excluir atividades"
  const { data: atividadesComIds = [] } = useQuery({
    queryKey: ['atividades-com-ids', perfilUsuario?.setores_atividades],
    queryFn: async () => {
      const { resolverSubsetoresComIds } = await import('@/lib/collections/licitacoesStore')
      return resolverSubsetoresComIds(perfilUsuario?.setores_atividades || [])
    },
    enabled: !!perfilUsuario?.setores_atividades?.length,
    staleTime: 1000 * 60 * 60,
  })

  // Valores padrão dos filtros (reutilizado para restauração)
  const filtrosDefaults = {
    buscaObjeto: '',
    excluirPalavras: '',
    uf: '',
    dataPublicacaoInicio: '',
    dataPublicacaoFim: '',
    valorMin: '',
    valorMax: '',
    statusEdital: '',
    comDocumentos: false,
    comItens: false,
    comValor: false,
    situacao: '',
    esfera: '',
    modoDisputa: '',
    amparoLegal: '',
    filtrosExclusaoAtivo: false,
    excluirUfs: [],
    excluirPalavrasObjeto: [],
    excluirAtividadesIds: [],
  }

  // Estados dos Filtros – restaura do localStorage ao recarregar
  const [filtros, setFiltros] = useState(filtrosDefaults)
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtros)
  const ultimoUsuarioRestaurado = useRef(null)
  const pulouPrimeiroSaveRef = useRef(false)

  const [dataFiltro, setDataFiltro] = useState('')

  // Restaurar filtros do localStorage ao carregar (persiste entre reloads)
  useEffect(() => {
    if (!user?.id) {
      ultimoUsuarioRestaurado.current = null
      return
    }
    if (ultimoUsuarioRestaurado.current === user.id) return
    ultimoUsuarioRestaurado.current = user.id
    try {
      const key = `licitacoes_filtros_${user.id}`
      const s = localStorage.getItem(key)
      if (s) {
        const parsed = JSON.parse(s)
        const restored = { ...filtrosDefaults, ...parsed }
        setFiltros(restored)
        setFiltrosAplicados(restored)
      }
    } catch (e) { /* ignore */ }
  }, [user?.id])

  // Salvar filtros no localStorage quando aplicados (debounced, pula 1ª execução para não sobrescrever antes do restore)
  useEffect(() => {
    if (!user?.id) return
    if (!pulouPrimeiroSaveRef.current) {
      pulouPrimeiroSaveRef.current = true
      return
    }
    const t = setTimeout(() => {
      try {
        const key = `licitacoes_filtros_${user.id}`
        const toSave = { ...filtrosAplicados }
        delete toSave.excluirUfs
        delete toSave.excluirPalavrasObjeto
        localStorage.setItem(key, JSON.stringify(toSave))
      } catch (e) { /* quota ou indisponível */ }
    }, 500)
    return () => clearTimeout(t)
  }, [user?.id, filtrosAplicados])

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
        } else {
      setDataFiltro('')
    }
  }, [location])
  
  useEffect(() => {
    setLimitePagina(50)
  }, [filtrosAplicados, dataFiltro])

  
  useEffect(() => {
    setFiltrosAplicados(prev => ({
      ...prev,
      // Manter buscaObjeto, excluirPalavras, dataPublicacaoInicio e dataPublicacaoFim como estão (só mudam ao clicar em "Aplicar")
      // Atualizar apenas filtros não-texto e não-data
      uf: filtros.uf,
      statusEdital: filtros.statusEdital,
      excluirAtividadesIds: filtros.excluirAtividadesIds || [],
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
    filtros.statusEdital, 
    filtros.excluirAtividadesIds,
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


      if (result.documentosErros > 0) {
        success(`Download concluído! ${result.documentosBaixados} documentos baixados com sucesso, ${result.documentosErros} documentos não puderam ser baixados.`)
      }
      
      setBaixandoDocumentos(prev => {
        const novo = new Set(prev)
        novo.delete(licitacaoId)
        return novo
      })
    } catch (error) {
      showError(`Erro ao baixar documentos: ${error.message}`)
      setBaixandoDocumentos(prev => {
        const novo = new Set(prev)
        novo.delete(licitacao.id || licitacao.numero_controle_pncp)
        return novo
      })
    }
  }, [success, showError])

  const enviarParaWhatsApp = useCallback(async (numeroOverride = null, licitacaoOverride = null) => {
    const licitacao = licitacaoOverride ?? whatsAppModalLicitacao
    const valor = numeroOverride ?? whatsAppNumero
    if (!licitacao || !valor?.trim()) return
    if (!supabase) {
      warning('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
      return
    }
    const numero = String(valor).replace(/\D/g, '')
    if (numero.length < 10) {
      warning('Informe um número válido com DDD (ex: 11999999999)')
      return
    }

    // Verificar rate limit (fail-open: se erro, permite envio)
    const rateCheck = await checkRateLimit()
    
    // Se houver warning (rate limit não configurado), mostrar mas continuar
    if (rateCheck.warning) {
    }
    
    // Só bloquear se realmente excedeu limite (não em caso de erro)
    if (!rateCheck.canSend && rateCheck.error && !rateCheck.warning) {
      warning(rateCheck.error)
      return
    }

    const isEnvioEmLote = !!licitacaoOverride
    if (!isEnvioEmLote) setWhatsAppEnviando(true)
    try {
      const dataAbertura = licitacao.dados_completos?.dataAberturaProposta || licitacao.dados_completos?.data_abertura_proposta || ''
      const dataEncerramento = licitacao.dados_completos?.dataEncerramentoProposta || licitacao.dados_completos?.data_encerramento_proposta || ''
      const valorTotal = licitacao.valor_total_estimado ?? null
      const objetoEdital = licitacao.objeto_compra
        || licitacao.dados_completos?.objetoCompra
        || licitacao.dados_completos?.objeto_compra
        || licitacao.objeto_licitacao
        || licitacao.resumo
        || 'Não informado'
      const payload = {
        telefone: numero.startsWith('55') ? numero : `55${numero}`,
        objeto_licitacao: objetoEdital,
        objeto: objetoEdital,
        orgao: licitacao.orgao_razao_social || 'Não informado',
        modalidade: licitacao.modalidade_nome || 'Não informado',
        valor_estimado: valorTotal,
        valor_total: valorTotal,
        valor_total_formatado: valorTotal != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal) : null,
        uf: licitacao.uf_sigla || '',
        numero_controle: licitacao.numero_controle_pncp || licitacao.id,
        data_publicacao: licitacao.data_publicacao_pncp || null,
        data_abertura: dataAbertura || null,
        data_encerramento: dataEncerramento || null,
        link_pncp: licitacao.link_licitacao_pncp || licitacao.url_detalhes || licitacao.dados_completos?.linkPnacp || null,
        municipio: licitacao.municipio_nome || licitacao.dados_completos?.municipio || null,
        unidade: licitacao.unidade_nome || licitacao.dados_completos?.unidadeCompradora || null,
      }
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp-uazapi', { body: payload })
      if (error) throw new Error(error.message || 'Edge Function falhou')
      if (data?.error) throw new Error(data.error)
      
      // Registrar envio bem-sucedido para rate limiting (se configurado)
      try {
        await registerSend(
          payload.telefone, 
          licitacao.numero_controle_pncp || licitacao.id,
          'success'
        )
      } catch (regError) {
      }
      
      if (!licitacaoOverride) {
        setWhatsAppModalLicitacao(null)
        setWhatsAppNumero('')
      }
      // Mensagem de sucesso (em lote o caller mostra um único resumo)
      if (!licitacaoOverride) {
        if (rateCheck.warning) success('Mensagem enviada com sucesso!')
        else {
          const remaining = Math.max(0, rateCheck.remaining - 1)
          success(`Mensagem enviada! Você tem ${remaining} envios restantes nesta hora.`)
        }
      }
    } catch (err) {
      
      // Registrar falha para auditoria (não conta no limite)
      try {
        await registerSend(
          numero.startsWith('55') ? numero : `55${numero}`,
          licitacao.numero_controle_pncp || licitacao.id,
          'failed'
        )
      } catch (regError) {
      }
      
      showError(`Erro ao enviar: ${err.message}`)
    } finally {
      if (!isEnvioEmLote) setWhatsAppEnviando(false)
    }
  }, [whatsAppModalLicitacao, success, showError, warning, checkRateLimit, registerSend, LIMITE_POR_HORA])

  const enviarParaTodosNumerosCadastrados = useCallback(async (licitacao) => {
    if (!numerosWhatsApp?.length || !licitacao) return
    setWhatsAppEnviando(true)
    let enviados = 0
    let erros = 0
    for (const n of numerosWhatsApp) {
      const num = (n.numero_telefone || '').replace(/\D/g, '')
      if (num.length < 10) continue
      try {
        await enviarParaWhatsApp(n.numero_telefone.startsWith('55') ? n.numero_telefone : `55${n.numero_telefone}`, licitacao)
        enviados++
      } catch {
        erros++
      }
    }
    setWhatsAppEnviando(false)
    if (enviados > 0) success(`Enviado para ${enviados} número(s)${erros > 0 ? `. ${erros} falha(s).` : '.'}`)
    if (erros > 0 && enviados === 0) showError('Falha ao enviar para os números cadastrados.')
  }, [numerosWhatsApp, enviarParaWhatsApp, success, showError])

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
  
  const { data: licitacoes = [], isLoading, isFetching, error } = useQuery({
    queryKey: ['licitacoes-sessao-completa', user?.id, 'por-setor-v2'],
    queryFn: async () => {
      if (!user?.id) {
        return []
      }
      const {
        buscarLicitacoesDoBanco,
        salvarCacheLicitacoes,
        carregarCacheLicitacoes,
        carregarCacheParcialLicitacoes,
        salvarCacheParcialLicitacoes,
        removerCacheParcialLicitacoes,
        limparCacheLicitacoes,
        limparCacheSemantico,
      } = await import('@/lib/collections/licitacoesStore')
      const mudouUsuario = ultimoUserId && ultimoUserId !== user.id
      if (mudouUsuario) {
        await limparCacheLicitacoes(ultimoUserId)
      }
      setUltimoUserId(user.id)
      
      // Perfil primeiro: se usuário tem setores, SÓ trazemos do banco as licitações que batem com setores (zero processamento no front)
      const { data: perfil } = await supabase
        .from('profiles')
        .select('setores_atividades, estados_interesse')
        .eq('id', user.id)
        .maybeSingle()

      if (perfil?.setores_atividades?.length) {
        const { buscarLicitacoesPorClassificacaoPrincipal, setLastLoadWasPreFiltered, setLastLoadWasFallbackAll, hashSetoresAtividades } = await import('@/lib/collections/licitacoesStore')
        setLastLoadWasFallbackAll(false)
        const setoresHashAtual = hashSetoresAtividades(perfil.setores_atividades)
        const cached = await carregarCacheLicitacoes(user.id)
        if (cached?.licitacoes?.length && cached.carregadoPorSetor && (cached.setoresHash || '') === setoresHashAtual) {
          setLastLoadWasPreFiltered(true)
          setProcessandoFiltro(false)
          setProgressoPercentual(0)
          setMensagemProgresso('')
          addLogFiltro(`${cached.licitacoes.length} licitações do seu setor (cache, mesmo perfil de setores)`)
          return cached.licitacoes
        }
        if (cached?.licitacoes?.length && cached.carregadoPorSetor && (cached.setoresHash || '') !== setoresHashAtual) {
      await limparCacheLicitacoes(user.id)
        }
        if (cached?.licitacoes?.length && !cached.carregadoPorSetor) {
          await limparCacheLicitacoes(user.id)
          await removerCacheParcialLicitacoes(user.id)
        }
        setProgressoPercentual(20)
        setProcessandoFiltro(true)
        setMensagemProgresso('Carregando licitações do seu setor...')
        addLogFiltro('Buscando no banco só licitações dos seus setores/atividades...')
        setProgressoPercentual(50)
        let list = []
        try {
          list = await buscarLicitacoesPorClassificacaoPrincipal(perfil)
        } catch (err) {
        }
        setProgressoPercentual(100)
        if (list.length > 0) {
          setLastLoadWasPreFiltered(true)
          setProcessandoFiltro(false)
          setProgressoPercentual(0)
          setMensagemProgresso('')
          await salvarCacheLicitacoes(list, user.id, true, setoresHashAtual)
          await salvarCacheSemantico(list, user.id, list.length, hashSetoresAtividades(perfil.setores_atividades))
          addLogFiltro(`${list.length} licitações do seu setor (veio do banco, sem processamento no front)`)
          return list
        }
        setLastLoadWasPreFiltered(false)
        setProcessandoFiltro(false)
        setProgressoPercentual(0)
        setMensagemProgresso('')
        addLogFiltro('Nenhuma licitação classificada para seu setor no momento. A classificação é feita no backend.')
        return []
      } else {
        const { setLastLoadWasPreFiltered, setLastLoadWasFallbackAll } = await import('@/lib/collections/licitacoesStore')
        setLastLoadWasPreFiltered(false)
        setLastLoadWasFallbackAll(false)
        const cached = await carregarCacheLicitacoes(user.id)
        if (cached?.licitacoes?.length) {
          const LIMITE_RECENTES = 10000
          const licitacoesLimitadas = cached.licitacoes.length > LIMITE_RECENTES ? cached.licitacoes.slice(0, LIMITE_RECENTES) : cached.licitacoes
          addLogFiltro(`Cache reutilizado: ${licitacoesLimitadas.length} licitações`)
          return licitacoesLimitadas
        }
      }

      setProcessandoFiltro(true)
      const { setLastLoadWasPreFiltered, setLastLoadWasFallbackAll } = await import('@/lib/collections/licitacoesStore')
      if (!perfil?.setores_atividades?.length) {
        setLastLoadWasPreFiltered(false)
        setLastLoadWasFallbackAll(false)
      }
      const parcial = await carregarCacheParcialLicitacoes(user.id)
      const mensagemInicial = parcial?.licitacoes?.length
        ? `Retomando busca: ${parcial.licitacoes.length} já carregadas...`
        : 'Carregando licitações do banco...'
      setMensagemProgresso(mensagemInicial)
      addLogFiltro(mensagemInicial)
      let ultimoLogBanco = parcial?.licitacoes?.length || 0
      const LIMITE_BANCO = 10000
      const todasLicitacoes = await buscarLicitacoesDoBanco(
        (buscados, total) => {
          setMensagemProgresso(`Carregando do banco: ${buscados.toLocaleString()} licitações...`)
          if (buscados - ultimoLogBanco >= 5000 || buscados === total) {
            addLogFiltro(`Carregando do banco: ${buscados.toLocaleString()} licitações...`)
            ultimoLogBanco = buscados
          }
        },
        LIMITE_BANCO,
        {
          licitacoesIniciais: parcial?.licitacoes || [],
          onSavePartial: (arr) => salvarCacheParcialLicitacoes(arr, user.id),
        }
      )
      addLogFiltro(`✅ ${todasLicitacoes.length.toLocaleString()} licitações carregadas do banco`)
      await removerCacheParcialLicitacoes(user.id)
      await salvarCacheLicitacoes(todasLicitacoes, user.id)
      await limparCacheSemantico(user.id)
      return todasLicitacoes
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: false,
  })

  // Estado para licitações filtradas (filtro semântico síncrono)
  const [licitacoesFiltradas, setLicitacoesFiltradas] = useState([])
  
  // Estado para desativar filtro semântico e mostrar todas as licitações (só usado quando usuário NÃO tem setores)
  const [mostrarTodasLicitacoes, setMostrarTodasLicitacoes] = useState(false)
  
  // Quem tem setores sempre vê só editais classificados; desligar "Mostrar Todas" se estiver ON
  useEffect(() => {
    if (perfilUsuario?.setores_atividades?.length && mostrarTodasLicitacoes) {
      setMostrarTodasLicitacoes(false)
    }
  }, [perfilUsuario?.setores_atividades?.length, mostrarTodasLicitacoes])
  
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
      
      // Lista veio do banco já por setor (classificação no backend): aplicar UF do perfil e depois os filtros do painel
      let resultado = licitacoes
      let pularFiltroSemantico = false
      const { getLastLoadWasPreFiltered, setLastLoadWasPreFiltered } = await import('@/lib/collections/licitacoesStore')
      if (getLastLoadWasPreFiltered()) {
        setLastLoadWasPreFiltered(false)
        if (perfilUsuario?.estados_interesse?.length) {
          const temNacional = perfilUsuario.estados_interesse.some(e => String(e).toUpperCase() === 'NACIONAL')
          if (!temNacional) {
            resultado = licitacoes.filter(lic => {
              const uf = lic.uf_sigla?.toUpperCase()
              return perfilUsuario.estados_interesse.some(estado => String(estado).toUpperCase() === uf)
            })
          }
        }
        pularFiltroSemantico = true
        setProcessandoFiltro(false)
        setProgressoPercentual(0)
        setMensagemProgresso('')
        addLogFiltro(resultado.length ? `Base do setor (banco): ${resultado.length} licitações — aplicando filtros do painel` : 'Nenhuma licitação do seu setor no momento.')
      }

      // Usuário tem setores: base já veio do banco (setor/subsetor); aplicar UF do perfil e depois os filtros do painel
      if (!pularFiltroSemantico && perfilUsuario?.setores_atividades?.length) {
        resultado = licitacoes || []
        if (resultado.length > 0 && perfilUsuario.estados_interesse?.length) {
          const temNacional = perfilUsuario.estados_interesse.some(e => String(e).toUpperCase() === 'NACIONAL')
          if (!temNacional) {
            resultado = resultado.filter(lic => {
              const uf = lic.uf_sigla?.toUpperCase()
              return perfilUsuario.estados_interesse.some(estado => String(estado).toUpperCase() === uf)
            })
          }
        }
        pularFiltroSemantico = true
        setProcessandoFiltro(false)
        setProgressoPercentual(0)
        setMensagemProgresso('')
        addLogFiltro(resultado.length ? `Base do setor (banco): ${resultado.length} licitações — aplicando filtros do painel` : 'Nenhuma licitação do seu setor no momento.')
      }

      try {
      if (!pularFiltroSemantico) {
      // Prioridade: reutilizar resultado final do IndexedDB ao recarregar/navegar (sem refazer busca nem filtro)
      if (user?.id) {
        try {
          const { carregarResultadoFinal, hashFiltrosAplicados } = await import('@/lib/collections/licitacoesStore')
          const hash = hashFiltrosAplicados(filtrosAplicados, mostrarTodasLicitacoes, perfilUsuario?.setores_atividades)
          const cached = await carregarResultadoFinal(user.id, hash)
          if (cached?.licitacoes) {
            setLicitacoesFiltradas(cached.licitacoes)
            setProcessandoFiltro(false)
            setProgressoPercentual(0)
            setMensagemProgresso('')
            addLogFiltro(`Resultado restaurado do cache: ${cached.licitacoes.length} licitações (sem refazer busca/filtro)`)
            return
          }
        } catch (e) {
        }
      }

      // Reusar cache semântico do IndexedDB ao recarregar ou voltar de outra página (evita reprocessar)
      if (!mostrarTodasLicitacoes && user?.id) {
        try {
          const { carregarCacheSemantico, hashSetoresAtividades } = await import('@/lib/collections/licitacoesStore')
          const setoresHash = hashSetoresAtividades(perfilUsuario?.setores_atividades)
          const cached = await carregarCacheSemantico(user.id, setoresHash)
          const totalRaw = Number(licitacoes.length)
          const totalCache = cached?.licitacoesTotalLength != null ? Number(cached.licitacoesTotalLength) : 0
          // Aceitar cache se a base de licitações é a mesma (mesmo total) ou compatível (ex.: raw foi limitado a 10k)
          const baseCompativel = totalCache === totalRaw || (totalRaw >= totalCache && totalCache > 0)
          if (cached?.licitacoes && Array.isArray(cached.licitacoes) && baseCompativel) {
            setLicitacoesFiltradas(cached.licitacoes)
            setProcessandoFiltro(false)
            setProgressoPercentual(0)
            setMensagemProgresso('')
            addLogFiltro(`Cache IndexedDB reutilizado: ${cached.licitacoes.length} licitações do interesse do usuário (sem reprocessar)`)
            return
          }
        } catch (e) {
        }
      }

      // Ao recarregar: não mostrar as 10k se o perfil ainda não carregou — esperar perfil para aplicar filtro ou usar cache
      if (!mostrarTodasLicitacoes && !perfilUsuario && licitacoes.length > 0) {
        setProcessandoFiltro(true)
        setMensagemProgresso('Carregando perfil para aplicar filtro...')
        addLogFiltro('Aguardando perfil da empresa para aplicar filtro por atividades')
        return
      }
      
      resultado = licitacoes
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
      resultado = licitacoes
      setProgressoPercentual(100)
      setMensagemProgresso('Exibindo lista (modo "Mostrar Todas", sem filtro por setor)')
      addLogFiltro('Modo "Mostrar Todas": exibindo lista sem filtro por setor')
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
          setLicitacoesFiltradas([]) // MUITO RESTRITIVO: Não mostra nada se não conseguiu extrair palavras
          return
        }
        
        // FILTRO OBRIGATÓRIO: Filtrar TODAS as licitações que não correspondem
        // Usando IA para validação precisa
        
        const antesFiltro = resultado.length
        
        setProgressoPercentual(50)
        setMensagemProgresso(`Processando ${antesFiltro} licitações...`)
        addLogFiltro(`Processando ${antesFiltro} licitações (filtro por palavras)`)
        
        // Filtro semântico em Web Worker para não travar a UI
        const worker = new Worker(
          new URL('@/workers/filtroSemantico.worker.js', import.meta.url),
          { type: 'module' }
        )
        const { aprovados: resultadosWorkerAprovados, duvidosos: resultadosWorkerDuvidosos } = await new Promise((resolve, reject) => {
          const onMessage = (ev) => {
            const { type, processados, total, percent, aprovados, duvidosos } = ev.data || {}
            if (type === 'progress') {
              const progressoLote = 50 + Math.floor((percent || 0) * 0.4)
              setProgressoPercentual(progressoLote)
              setMensagemProgresso(`Processando: ${processados}/${total} licitações (${percent}%)...`)
              if (percent > 0 && (percent % 25 === 0 || percent === 100)) {
                addLogFiltro(`Processando: ${processados}/${total} licitações (${percent}%)`)
              }
            } else if (type === 'done') {
              worker.removeEventListener('message', onMessage)
              worker.removeEventListener('error', onError)
              worker.terminate()
              resolve({ aprovados: aprovados || [], duvidosos: duvidosos || [] })
            }
          }
          const onError = (err) => {
            worker.removeEventListener('message', onMessage)
            worker.removeEventListener('error', onError)
            worker.terminate()
            reject(err)
          }
          worker.addEventListener('message', onMessage)
          worker.addEventListener('error', onError)
          worker.postMessage({
            type: 'filter',
            payload: {
              licitacoes: resultado,
              palavrasChave,
              sinonimosPersonalizados,
              sinonimosBancoFormatados,
              setoresAtividades,
              palavrasFortesPorSetor,
              palavrasIncompatibilidadePorSetor,
            },
          })
        })

        resultado = [...resultadosWorkerAprovados]
        // Validar com IA os casos duvidosos (limitado para não travar: máx 30)
        const MAX_DUVIDOSOS_IA = 30
        const duvidososParaIA = (resultadosWorkerDuvidosos?.length > 0)
          ? resultadosWorkerDuvidosos.slice(0, MAX_DUVIDOSOS_IA)
          : []
        if (duvidososParaIA.length > 0) {
          if ((resultadosWorkerDuvidosos?.length || 0) > MAX_DUVIDOSOS_IA) {
            addLogFiltro(`Validando até ${MAX_DUVIDOSOS_IA} casos duvidosos (${resultadosWorkerDuvidosos.length} no total)`)
          }
          setProgressoPercentual(91)
          setMensagemProgresso(`Validando ${duvidososParaIA.length} casos duvidosos com IA...`)
          addLogFiltro(`Validando ${duvidososParaIA.length} casos duvidosos com IA`)
          const estadosParaIA = (perfilUsuario?.estados_interesse && !perfilUsuario.estados_interesse.some(e => String(e).toUpperCase() === 'NACIONAL'))
            ? perfilUsuario.estados_interesse
            : null
                    try {
                      const { validarCorrespondenciaIAEdgeFunction } = await import('@/lib/validacaoIA')
            for (const licitacao of duvidososParaIA) {
              const objetoCompleto = obterObjetoCompleto(licitacao)
              if (!objetoCompleto) continue
              try {
                      const validacaoIA = await validarCorrespondenciaIAEdgeFunction(
                        objetoCompleto,
                        setoresAtividades,
                  user?.id,
                  estadosParaIA
                      )
                      if (validacaoIA === true) {
                  resultado.push(licitacao)
                }
              } catch (_) { /* ignorar erro por item */ }
            }
          } catch (err) {
          }
        }

        // Filtro semântico por IA: validar por significado (com timeout para sempre concluir)
        const MAX_SEGUNDOS_IA = 120 // após 2 min usa resultado do filtro semântico e finaliza
        if (resultado.length > 0 && setoresAtividades?.length > 0) {
          const totalParaIA = resultado.length
          const resultadoAntesIA = [...resultado]
          if (totalParaIA > 100) {
            setMensagemProgresso(`Validando ${totalParaIA} licitações com IA (máx ${MAX_SEGUNDOS_IA}s)...`)
            addLogFiltro(`Validando ${totalParaIA} licitações com IA (máx ${MAX_SEGUNDOS_IA}s)`)
          } else {
            setMensagemProgresso('Validando com IA (semântico)...')
            addLogFiltro('Validando com IA (semântico)...')
          }
          let ultimoPercentIA = -1
          const runIABatch = async () => {
            const { validarCorrespondenciaIABatch } = await import('@/lib/validacaoIA')
            const estadosParaIA = (perfilUsuario?.estados_interesse && perfilUsuario.estados_interesse.length > 0 &&
              !perfilUsuario.estados_interesse.some(e => String(e).toUpperCase() === 'NACIONAL'))
              ? perfilUsuario.estados_interesse
              : null
            return validarCorrespondenciaIABatch(
              resultado,
              setoresAtividades,
              obterObjetoCompleto,
              (validados, total) => {
                const percent = Math.round((validados / total) * 100)
                setMensagemProgresso(`Validando com IA: ${validados}/${total} (${percent}%)`)
                setProgressoPercentual(90 + Math.round((validados / total) * 10))
                if (percent >= ultimoPercentIA + 25 || percent === 100) {
                  addLogFiltro(`Validando com IA: ${validados}/${total} (${percent}%)`)
                  ultimoPercentIA = percent
                }
              },
              estadosParaIA
            )
          }
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT_IA')), MAX_SEGUNDOS_IA * 1000)
          })
          try {
            const idsAprovados = await Promise.race([runIABatch(), timeoutPromise])
            if (idsAprovados && idsAprovados.size > 0) {
              resultado = resultado.filter(lic => idsAprovados.has(lic.id))
              addLogFiltro(`✅ IA aprovou ${idsAprovados.size} licitações por significado`)
            } else {
              resultado = resultadoAntesIA
              addLogFiltro('⚠️ IA indisponível (ex.: RATE_LIMIT); mantendo resultado do filtro semântico', 'warn')
            }
          } catch (err) {
            if (err?.message === 'TIMEOUT_IA') {
              addLogFiltro(`⚠️ Tempo limite de ${MAX_SEGUNDOS_IA}s na IA; mantendo resultado do filtro semântico`, 'warn')
            } else {
              addLogFiltro('⚠️ Erro ao validar com IA; mantendo resultado do filtro semântico', 'warn')
            }
            resultado = resultadoAntesIA
          }
        }
        
        // Salvar resultado no cache para reutilizar ao voltar de outra aba (evita reprocessar)
        if (user?.id) {
          const { salvarCacheSemantico, hashSetoresAtividades } = await import('@/lib/collections/licitacoesStore')
          await salvarCacheSemantico(resultado, user.id, licitacoes.length, hashSetoresAtividades(perfilUsuario?.setores_atividades))
        }
        
        setProgressoPercentual(100)
        setMensagemProgresso(`Filtro concluído! ${resultado.length} licitações encontradas.`)
        addLogFiltro(`Filtro concluído! ${resultado.length} licitações encontradas.`)
        // Encerrar spinner logo após o semântico (editais já estão disponíveis); evita ficar em 90% sem terminar
        setTimeout(() => {
          setProcessandoFiltro(false)
          setMensagemProgresso('')
          setProgressoPercentual(0)
        }, 1200)
        
        const depoisFiltro = resultado.length
        const percentualRemovido = antesFiltro > 0 ? ((1 - depoisFiltro/antesFiltro) * 100).toFixed(1) : 0
      } else {
        // Se NÃO tem setores cadastrados, NÃO MOSTRAR NADA (muito restritivo)
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

      } // Fim do if (!pularFiltroSemantico)

    // Filtrar por status do edital (sempre: aplica filtros do painel sobre a base em cache)
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
    }

    // Filtrar por UF
    if (filtrosAplicados.uf && filtrosAplicados.uf.trim()) {
      const antesUF = resultado.length
      resultado = resultado.filter(licitacao => {
        return licitacao.uf_sigla?.toUpperCase() === filtrosAplicados.uf.toUpperCase()
      })
    }

    // Excluir atividades: editais cuja atividade (subsetor) foi desmarcada pelo usuário
    const excluirIds = filtrosAplicados.excluirAtividadesIds || []
    if (excluirIds.length > 0) {
      const excluirSet = new Set(excluirIds.map(id => String(id).toLowerCase()))
      const antesAtiv = resultado.length
      const amostraSubIds = resultado.slice(0, 5).map(l => l.subsetor_principal_id)
      resultado = resultado.filter(lic => {
        const subId = lic.subsetor_principal_id ?? lic.dados_completos?.subsetor_principal_id
        if (!subId) return true // manter se não tem classificação
        return !excluirSet.has(String(subId).toLowerCase())
      })
      const removidas = antesAtiv - resultado.length
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
    }

    // Filtrar por documentos (deve ter documentos)
    if (filtrosAplicados.comDocumentos) {
      const antesDocs = resultado.length
      resultado = resultado.filter(licitacao => {
        const docs = getDocumentos(licitacao)
        return docs && docs.length > 0
      })
    }

    // Filtrar por itens (deve ter itens)
    if (filtrosAplicados.comItens) {
      const antesItens = resultado.length
      resultado = resultado.filter(licitacao => {
        return licitacao.itens && Array.isArray(licitacao.itens) && licitacao.itens.length > 0
      })
    }

    // Filtrar por valor (deve ter valor)
    if (filtrosAplicados.comValor) {
      const antesComValor = resultado.length
      resultado = resultado.filter(licitacao => {
        const valor = licitacao.valor_total_estimado
        return valor && valor > 0
      })
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
      }
    }

    // Filtros de exclusão removidos temporariamente - será repensado

    // Filtro por data: só aplica quando o usuário preenche Data Publicação na sidebar.
    // Vazio = sem filtro por data (mostra tudo que já veio do banco).
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
    
    // Só filtrar por data quando o usuário preencheu Data Publicação na sidebar (ferramenta de filtro na interface).
    // Vazio = não aplicar filtro por data; mostra tudo que já veio do banco.
    const temDataManual = filtrosAplicados.dataPublicacaoInicio || filtrosAplicados.dataPublicacaoFim
    
    let dataInicioNormalizada = null
    let dataFimNormalizada = null
    
    if (temDataManual) {
      dataInicioNormalizada = filtrosAplicados.dataPublicacaoInicio 
        ? normalizarData(filtrosAplicados.dataPublicacaoInicio)
        : null
      dataFimNormalizada = filtrosAplicados.dataPublicacaoFim
        ? normalizarData(filtrosAplicados.dataPublicacaoFim)
        : null
    }
    // Se temDataManual é false: não setar dataInicio/Fim (vazio = sem filtro por data)
    
    if (temDataManual && (dataInicioNormalizada || dataFimNormalizada)) {
      // Debug: Log para entender o problema
      
      // Debug: Verificar amostras de datas ANTES do filtro
      const amostrasAntes = resultado.slice(0, Math.min(5, antesData))
      
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
      const periodo = `${filtrosAplicados.dataPublicacaoInicio || 'início'} a ${filtrosAplicados.dataPublicacaoFim || 'fim'}`
      
      // Debug: Verificar amostras DEPOIS do filtro
      if (depoisData > 0) {
        const amostrasDepois = resultado.slice(0, Math.min(3, depoisData))
      }
    } else if (temDataManual) {
    }

    // Aplicar filtros finais
    if (processandoFiltro) {
      setMensagemProgresso('Aplicando filtros finais...')
      addLogFiltro('Aplicando filtros finais...')
    }

    startTransition(() => setLicitacoesFiltradas(resultado))

    // Salvar resultado final no IndexedDB para ao recarregar/navegar não refazer busca nem filtro
    if (user?.id && resultado) {
      try {
        const { salvarResultadoFinal, hashFiltrosAplicados } = await import('@/lib/collections/licitacoesStore')
        await salvarResultadoFinal(resultado, user.id, hashFiltrosAplicados(filtrosAplicados, mostrarTodasLicitacoes, perfilUsuario?.setores_atividades))
      } catch (e) {
      }
    }
    
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
        addLogFiltro('Erro ao aplicar filtros. Exibindo resultado parcial.', 'warn')
        startTransition(() => {
          setLicitacoesFiltradas(resultado ?? [])
          setProcessandoFiltro(false)
          setProgressoPercentual(0)
          setMensagemProgresso('')
        })
    }
  }
    
    aplicarFiltros()
    // palavrasFortesPorSetor e palavrasIncompatibilidadePorSetor omitidos de propósito: são objetos
    // que mudam de referência a cada render e causariam loop (Maximum update depth). Usados dentro do effect.
  }, [
    licitacoes, 
    filtrosAplicados,
    perfilUsuario, 
    mostrarTodasLicitacoes,
    sinonimosBanco,
    dataFiltro,
  ])

  // Licitações finais (sem filtros permanentes)
  const licitacoesFinais = licitacoesFiltradas

  // Lista sem duplicatas por id (evita "two children with the same key" e cards repetidos)
  const licitacoesParaExibir = useMemo(() => {
    const seen = new Set()
    return licitacoesFinais.filter(lic => {
      const id = lic.id ?? lic.numero_controle_pncp
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [licitacoesFinais])

  // Apenas as licitações da “página” atual (evita renderizar milhares de cards e travar a UI)
  const licitacoesPagina = useMemo(
    () => licitacoesParaExibir.slice(0, limitePagina),
    [licitacoesParaExibir, limitePagina]
  )
  // Se um card "Recomendadas" foi clicado, a lista mostra só esse edital
  const licitacoesNaTela = recomendadaSelecionada ? [recomendadaSelecionada] : licitacoesPagina

  // Palavras-chave do perfil para cálculo de score de aderência (Recomendadas + badge)
  const palavrasChaveParaScore = useMemo(() => {
    const setores = perfilUsuario?.setores_atividades
    if (!setores?.length) return { principais: [], secundarias: [], todas: [] }
    return extrairPalavrasChaveDosSetores(
      setores,
      perfilUsuario?.sinonimos_personalizados || {},
      sinonimosBanco || {}
    )
  }, [perfilUsuario?.setores_atividades, perfilUsuario?.sinonimos_personalizados, sinonimosBanco])

  // Palavras-chave dos CNAEs da empresa (para incluir no score de aderência)
  const palavrasChaveCnae = useMemo(() => {
    if (!user) return []
    const codigos = []
    if (user.cnae_principal) {
      const c = normalizarCodigoCnae(user.cnae_principal)
      if (c) codigos.push(c)
    }
    try {
      if (user.cnaes_secundarios) {
        const arr = typeof user.cnaes_secundarios === 'string' ? JSON.parse(user.cnaes_secundarios) : user.cnaes_secundarios
        if (Array.isArray(arr)) {
          arr.forEach(cnae => {
            const cod = typeof cnae === 'string' ? cnae : (cnae?.codigo ?? cnae)
            const c = normalizarCodigoCnae(cod)
            if (c && !codigos.includes(c)) codigos.push(c)
          })
        }
      }
    } catch (_) {}
    const palavras = new Set()
    codigos.forEach(cod => {
      const nome = obterNomeAtividadeCnae(cod)
      if (!nome || nome.startsWith('CNAE ')) return
      normalizarTexto(nome).split(/\s+/).filter(p => p.length >= 4).forEach(p => palavras.add(p))
    })
    return Array.from(palavras)
  }, [user?.id, user?.cnae_principal, user?.cnaes_secundarios])

  const temPerfilParaScore = (palavrasChaveParaScore?.todas?.length > 0) || palavrasChaveCnae.length > 0

  // Pool de licitações com score (para as 3 abas: Alta / Média / Baixa aderência)
  const recomendadas = useMemo(() => {
    if (!temPerfilParaScore || !licitacoesFiltradas.length) return []
    const setores = perfilUsuario?.setores_atividades || []
    const comScore = licitacoesFiltradas.map(lic => {
      const { score, label } = calcularScoreAderencia(
        lic,
        palavrasChaveParaScore || { principais: [], secundarias: [], todas: [] },
        perfilUsuario?.sinonimos_personalizados || {},
        sinonimosBanco || {},
        setores,
        palavrasChaveCnae
      )
      return { licitacao: lic, score, label }
    })
    return comScore
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
  }, [licitacoesFiltradas, palavrasChaveParaScore, palavrasChaveCnae, temPerfilParaScore, perfilUsuario?.sinonimos_personalizados, sinonimosBanco, perfilUsuario?.setores_atividades])

  // Aba selecionada na seção Recomendadas: alta | media | baixa
  const [abaAderencia, setAbaAderencia] = useState('alta')
  const recomendadasNaAba = useMemo(() => {
    const filtradas = recomendadas.filter(r => r.label === abaAderencia)
    return filtradas.slice(0, 8)
  }, [recomendadas, abaAderencia])
  const contagemPorAba = useMemo(() => ({
    alta: recomendadas.filter(r => r.label === 'alta').length,
    média: recomendadas.filter(r => r.label === 'média').length,
    baixa: recomendadas.filter(r => r.label === 'baixa').length
  }), [recomendadas])

  // Score de aderência por licitação (todas as da página atual; 0–100 para barra em todo card)
  const scorePorId = useMemo(() => {
    const map = new Map()
    if (!temPerfilParaScore || !licitacoesPagina.length) return map
    const setores = perfilUsuario?.setores_atividades || []
    licitacoesPagina.forEach(lic => {
      const { score, label } = calcularScoreAderencia(
        lic,
        palavrasChaveParaScore || { principais: [], secundarias: [], todas: [] },
        perfilUsuario?.sinonimos_personalizados || {},
        sinonimosBanco || {},
        setores,
        palavrasChaveCnae
      )
      map.set(lic.id ?? lic.numero_controle_pncp, { score, label })
    })
    return map
  }, [licitacoesPagina, palavrasChaveParaScore, palavrasChaveCnae, temPerfilParaScore, perfilUsuario?.sinonimos_personalizados, sinonimosBanco, perfilUsuario?.setores_atividades])

  // Log para debug do filtro automático baseado no perfil (após todas as declarações)
  useEffect(() => {
    if (perfilUsuario && licitacoes.length > 0) {
      const estados = perfilUsuario.estados_interesse || []
      const setores = perfilUsuario.setores_atividades || []
      if (estados.length > 0 || setores.length > 0) {
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

  // Statuses presentes nos editais carregados (para popular o dropdown dinamicamente)
  const statusesPresentesNosEditais = useMemo(() => {
    if (!licitacoes?.length) return []
    const set = new Set()
    licitacoes.forEach(lic => {
      const s = getStatusEdital(lic)
      if (s) set.add(s)
      if (isUrgente(lic)) set.add('urgente')
    })
    const ordem = ['proximo', 'andamento', 'encerrando', 'urgente', 'encerrado']
    return ordem.filter(s => set.has(s))
  }, [licitacoes, getStatusEdital])

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
        const { error } = await supabase
          .from('licitacoes_favoritas')
          .delete()
          .eq('usuario_id', user.id)
          .eq('licitacao_id', licitacao.id)
        
        if (error) {
          throw error
        }
      } else {
        // Verificar se já existe (evitar 409)
        const { data: existente } = await supabase
        .from('licitacoes_favoritas')
        .select('id')
        .eq('usuario_id', user.id)
          .eq('licitacao_id', licitacao.id)
        .maybeSingle()

        if (existente) {
          return { licitacaoId: licitacao.id, isFavorito: false }
        }

        // Adicionar
        const { error } = await supabase
          .from('licitacoes_favoritas')
          .insert({
            usuario_id: user.id,
            licitacao_id: licitacao.id,
            data_adicao: new Date().toISOString()
          })

        if (error) {
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
      excluirAtividadesIds: [],
      filtrosExclusaoAtivo: false
    }
    
    setFiltros(filtrosLimpos)
    // Também atualizar filtrosAplicados para aplicar imediatamente ao limpar
    setFiltrosAplicados(filtrosLimpos)
    setDataFiltro('')
    setMostrarTodasLicitacoes(false) // Desativar modo "mostrar todas"
    // Limpar filtros persistidos para não restaurar na próxima carga
    try {
      if (user?.id) localStorage.removeItem(`licitacoes_filtros_${user.id}`)
    } catch (e) { /* ignore */ }
    
    // REMOVIDO: Não precisa limpar cache de filtros no localStorage
    // O cache semântico está no IndexedDB e não precisa ser limpo ao limpar filtros
    // Os filtros agora funcionam diretamente no cache semântico
    
    // NÃO invalidar queries - manter cache do banco
    // NÃO fazer refetch - usar cache existente
    
    // O useEffect vai automaticamente reagir aos filtros limpos
    // e aplicar no cache semântico que já está carregado
    
    window.history.pushState({}, '', '/licitacoes')
  }

  const handleAplicarFiltros = () => {
    // Desativar modo "mostrar todas" quando aplicar filtros
    setMostrarTodasLicitacoes(false)
    
    // Aplicar TODOS os filtros (incluindo campos de texto) ao clicar no botão
    // Isso melhora muito a performance, processando apenas quando o usuário quiser
    setFiltrosAplicados(filtros)
    
    // NÃO invalidar queries - trabalhar apenas com cache
    // O useEffect vai automaticamente reagir e aplicar os filtros no cache
    
  }

  const contarFiltrosAtivos = () => {
    let count = 0
    if (filtros.buscaObjeto) count++
    if (filtros.excluirPalavras) count++
    if (filtros.uf) count++
    if (filtros.statusEdital) count++
    if (filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim) count++
    if (filtros.valorMin || filtros.valorMax) count++
    if (filtros.comDocumentos) count++
    if (filtros.comItens) count++
    if (filtros.comValor) count++
    if ((filtros.excluirAtividadesIds || []).length > 0) count++
    if (dataFiltro) count++
    return count
  }

  const salvarNumerosWhatsApp = async () => {
    if (!user?.id) return
    setWhatsAppSlotsSaving(true)
    try {
      const numeros = listaNumerosWhatsApp
        .map((s) => ({ ...s, numero_telefone: (s.numero_telefone || '').replace(/\D/g, '') }))
        .filter((s) => s.numero_telefone.length >= 10)
      await supabase.from('usuario_whatsapp_numeros').delete().eq('usuario_id', user.id)
      if (numeros.length > 0) {
        const rows = numeros.slice(0, 3).map((s, i) => ({
          usuario_id: user.id,
          numero_telefone: s.numero_telefone.startsWith('55') ? s.numero_telefone : `55${s.numero_telefone}`,
          label: (s.label || '').trim() || null,
          ordem: i + 1,
          ativo: true,
        }))
        const { error } = await supabase.from('usuario_whatsapp_numeros').insert(rows)
        if (error) throw error
      }
      await refetchNumerosWhatsApp()
      success('Números salvos.')
    } catch (err) {
      showError('Erro ao salvar números: ' + (err.message || err))
    } finally {
      setWhatsAppSlotsSaving(false)
    }
  }

  const adicionarNumeroWhatsApp = () => {
    const raw = whatsAppNovoNumero.replace(/\D/g, '')
    if (raw.length < 10 || listaNumerosWhatsApp.length >= 3) return
    const num = raw.startsWith('55') ? raw : `55${raw}`
    if (listaNumerosWhatsApp.some((n) => (n.numero_telefone || '').replace(/\D/g, '') === num.replace(/\D/g, ''))) return
    setListaNumerosWhatsApp((prev) => [...prev, { numero_telefone: num, label: whatsAppNovoLabel.trim() || '' }])
    setWhatsAppNovoNumero('')
    setWhatsAppNovoLabel('')
  }

  const removerNumeroWhatsApp = (index) => {
    setListaNumerosWhatsApp((prev) => prev.filter((_, i) => i !== index))
  }

  const salvarAlertaEmail = async () => {
    if (!user?.id) return
    const emailParaAlerta = alertaEmailDestino.trim() || perfilUsuario?.email
    if (alertaEmailAtivo && !emailParaAlerta) {
      warning('Informe um e-mail abaixo ou cadastre no seu perfil para ativar o envio automático.')
      return
    }
    setAlertaEmailSaving(true)
    try {
      const horario = alertaEmailHorario.trim() || '08:00'
      const horarioFull = horario.length === 5 ? `${horario}:00` : horario
      const payload = {
        usuario_id: user.id,
        nome_alerta: 'Envio E-mail',
        tipo: 'email',
        filtros: filtrosAplicados,
        horario_verificacao: horarioFull,
        ativo: alertaEmailAtivo,
        frequencia: 'diario',
        email_notificacao: emailParaAlerta || null,
        resumo_semanal_ativo: alertaResumoSemanalAtivo,
      }
      if (alertaEmail?.id) {
        const { error } = await supabase
          .from('alertas_usuario')
          .update({ ativo: payload.ativo, horario_verificacao: payload.horario_verificacao, filtros: payload.filtros, email_notificacao: payload.email_notificacao, resumo_semanal_ativo: payload.resumo_semanal_ativo, updated_at: new Date().toISOString() })
          .eq('id', alertaEmail.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('alertas_usuario').insert(payload)
        if (error) throw error
      }
      queryClient.invalidateQueries({ queryKey: ['alerta-email', user.id] })
      success('Alerta por e-mail salvo.')
    } catch (err) {
      showError('Erro ao salvar alerta: ' + (err.message || err))
    } finally {
      setAlertaEmailSaving(false)
    }
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
            flex-shrink-0 bg-gray-50/80 border-r border-border
            transition-all duration-300 ease-in-out
            overflow-hidden h-full shadow-sm
          `}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#e5e7eb transparent'
          }}
        >
          <div className="w-[420px] h-full overflow-y-auto p-4 space-y-3 filtros-sidebar">
            {/* Cabeçalho compacto */}
            <div className="sticky top-0 z-10 -mx-4 px-4 pt-4 pb-2 bg-gray-50/95 backdrop-blur-sm border-b border-border/60">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-sm font-semibold text-gray-900 tracking-tight">
                  Filtros
                </h2>
                {contarFiltrosAtivos() > 0 && (
                  <Badge variant="secondary" className="bg-orange-500/15 text-orange-700 border-0 text-xs">
                    {contarFiltrosAtivos()}
                  </Badge>
                )}
                </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={limparFiltros}
                  className="flex-1 rounded-lg border-border h-8 text-xs font-medium"
                >
                  Limpar
                </Button>
                <Button
                  onClick={handleAplicarFiltros}
                  className="flex-1 rounded-lg bg-orange-500 hover:bg-orange-600 h-8 text-xs font-medium shadow-sm"
                >
                  Aplicar
                </Button>
            </div>
          </div>

            {/* Toggle Mostrar Todas - só para quem NÃO tem setores; quem tem setores vê só editais classificados (rápido) */}
            {(!perfilUsuario?.setores_atividades?.length) && (
            <div className="rounded-lg bg-white border border-border/80 shadow-sm px-3 py-2.5 flex items-center gap-3 min-w-0">
              <Label htmlFor="mostrar-todas" title="Exibe todas as licitações do banco, sem filtro por setor" className="text-xs font-medium text-gray-800 cursor-pointer min-w-0 flex-1 truncate">
                Mostrar Todas (sem filtro por setor)
              </Label>
                <Switch
                  id="mostrar-todas"
                  checked={mostrarTodasLicitacoes}
                  onCheckedChange={(checked) => {
                    setMostrarTodasLicitacoes(checked)
                    if (checked) {
                    } else {
                    }
                  }}
                className="flex-shrink-0 data-[state=checked]:bg-orange-500"
                />
            </div>
            )}            {/* Accordion: Busca Rápida + Filtros avançados + Envio WhatsApp */}
            <Accordion type="multiple" defaultValue={['busca', 'filtros', 'whatsapp']} className="rounded-lg border border-border/80 bg-white shadow-sm overflow-hidden">
              <AccordionItem value="busca" className="border-0 border-b border-border/60">
                <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold text-gray-900 hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/70 hover:from-orange-100/80 hover:to-orange-100/60 [&[data-state=open]]:from-orange-50 [&[data-state=open]]:to-orange-100/70 flex items-center justify-between w-full">
                  <span className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <Search className="w-4 h-4 flex-shrink-0 text-black" />
                    <span className="truncate">Busca Rápida e Excluir palavras</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-1 space-y-2.5">
                  <div>
                    <Label className="text-[11px] font-medium text-gray-600 mb-1 block">Busca Rápida</Label>
              <Input
                      placeholder="Objeto, órgão, número... (vírgula = ou)"
                value={filtros.buscaObjeto}
                onChange={(e) => setFiltros({ ...filtros, buscaObjeto: e.target.value })}
                      className="h-8 rounded-md border-border/80 text-xs"
              />
              {filtros.buscaObjeto && filtros.buscaObjeto.includes(',') && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Qualquer uma: {filtros.buscaObjeto.split(',').map(t => t.trim()).filter(t => t).map((termo, idx, arr) => (
                          <span key={idx}><strong>"{termo}"</strong>{idx < arr.length - 1 && ', '}</span>
                  ))}
                </p>
              )}
            </div>
                  <div>
                    <Label className="text-[11px] font-medium text-gray-600 mb-1 block">Excluir palavras</Label>
              <Input
                      placeholder="Palavras que não devem aparecer (vírgula)"
                value={filtros.excluirPalavras}
                onChange={(e) => setFiltros({ ...filtros, excluirPalavras: e.target.value })}
                      className="h-8 rounded-md border-border/80 text-xs"
              />
              {filtros.excluirPalavras && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Ocultando: {filtros.excluirPalavras.split(',').map(t => t.trim()).filter(t => t).map((termo, idx, arr) => (
                          <span key={idx}><strong>"{termo}"</strong>{idx < arr.length - 1 && ', '}</span>
                  ))}
                </p>
                )}
              </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="filtros" className="border-0 border-b border-border/60">
                <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold text-gray-900 hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/70 hover:from-orange-100/80 hover:to-orange-100/60 [&[data-state=open]]:from-orange-50 [&[data-state=open]]:to-orange-100/70 flex items-center justify-between w-full">
                  <span className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <SlidersHorizontal className="w-4 h-4 flex-shrink-0 text-black" />
                    <span className="truncate">Data, UF e mais</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-1 space-y-3 border-t border-border/60">
                  {/* Data Publicação */}
                <div>
                    <Label className="text-[11px] font-medium text-gray-600 mb-1 block">Data Publicação</Label>
                    <div className="flex gap-1.5">
                  <Input
                        type="date"
                        value={filtros.dataPublicacaoInicio}
                        onChange={(e) => setFiltros({ ...filtros, dataPublicacaoInicio: e.target.value })}
                        className="h-8 rounded-md text-xs border-border/80"
                      />
                      <Input
                        type="date"
                        value={filtros.dataPublicacaoFim}
                        onChange={(e) => setFiltros({ ...filtros, dataPublicacaoFim: e.target.value })}
                        className="h-8 rounded-md text-xs border-border/80"
                      />
          </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Vazio = sem filtro por data (mostra todos)</p>
                </div>
                
                  {/* UF */}
                <div>
                    <Label className="text-[11px] font-medium text-gray-600 mb-1 block">Estado (UF)</Label>
                    <Select value={filtros.uf || "TODOS"} onValueChange={(value) => setFiltros({ ...filtros, uf: value === "TODOS" ? "" : value })}>
                      <SelectTrigger className="h-8 rounded-md text-xs border-border/80">
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

                  {/* Status do Edital — opções dinâmicas conforme statuses presentes nos editais */}
                  <div>
                    <Label className="text-[11px] font-medium text-gray-600 mb-1 block">Status do Edital</Label>
                    <Select value={filtros.statusEdital || "TODOS"} onValueChange={(value) => setFiltros({ ...filtros, statusEdital: value === "TODOS" ? "" : value })}>
                      <SelectTrigger className="h-8 rounded-md text-xs border-border/80">
                        <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos os Status</SelectItem>
                        {statusesPresentesNosEditais.map(s => (
                          <SelectItem key={s} value={s}>
                            {s === 'proximo' ? 'Próximo (Ainda não abriu)' :
                             s === 'andamento' ? 'Em Andamento' :
                             s === 'encerrando' ? 'Encerrando (≤ 3 dias)' :
                             s === 'encerrado' ? 'Encerrado' :
                             s === 'urgente' ? 'Urgente (≤ 7 dias)' : s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                </div>

                  {/* Valor Estimado */}
                <div>
                    <Label className="text-[11px] font-medium text-gray-600 mb-1 block">Valor Estimado</Label>
                    <div className="flex gap-1.5">
                  <Input
                        type="number"
                        placeholder="Mín"
                        value={filtros.valorMin}
                        onChange={(e) => setFiltros({ ...filtros, valorMin: e.target.value })}
                        className="h-8 rounded-md text-xs border-border/80"
                      />
                      <Input
                        type="number"
                        placeholder="Máx"
                        value={filtros.valorMax}
                        onChange={(e) => setFiltros({ ...filtros, valorMax: e.target.value })}
                        className="h-8 rounded-md text-xs border-border/80"
                  />
                </div>
          </div>

                  {/* Checkboxes */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="comDocumentos"
                        checked={filtros.comDocumentos}
                        onCheckedChange={(checked) => setFiltros({ ...filtros, comDocumentos: checked })}
                        className="rounded-md"
                      />
                      <Label htmlFor="comDocumentos" className="text-[11px] cursor-pointer text-gray-700">Com Documentos</Label>
            </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="comItens"
                        checked={filtros.comItens}
                        onCheckedChange={(checked) => setFiltros({ ...filtros, comItens: checked })}
                        className="rounded-md"
                      />
                      <Label htmlFor="comItens" className="text-[11px] cursor-pointer text-gray-700">Com Itens</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="comValor"
                        checked={filtros.comValor}
                        onCheckedChange={(checked) => setFiltros({ ...filtros, comValor: checked })}
                        className="rounded-md"
                      />
                      <Label htmlFor="comValor" className="text-[11px] cursor-pointer text-gray-700">Com Valor Estimado</Label>
                    </div>
                  </div>
              </AccordionContent>
            </AccordionItem>
            {atividadesComIds.length > 0 && (
              <AccordionItem value="atividades" className="border-0 border-b border-border/60">
                <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold text-gray-900 hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/70 hover:from-orange-100/80 hover:to-orange-100/60 [&[data-state=open]]:from-orange-50 [&[data-state=open]]:to-orange-100/70 flex items-center justify-between w-full">
                  <span className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <Filter className="w-4 h-4 flex-shrink-0 text-black" />
                    <span className="truncate">Excluir atividades</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-1 space-y-3 border-t border-border/60">
                  <p className="text-[11px] text-muted-foreground">
                    Desmarque as atividades que deseja excluir dos resultados. Editais dessas atividades não serão exibidos.
                  </p>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {(() => {
                      const porSetor = atividadesComIds.reduce((acc, a) => {
                        (acc[a.setor] = acc[a.setor] || []).push(a)
                        return acc
                      }, {})
                      const excluidos = filtros.excluirAtividadesIds || []
                      const toggleAtividade = (atividadeId, checked) => {
                        const next = checked
                          ? excluidos.filter(id => id !== atividadeId)
                          : [...excluidos, atividadeId]
                        setFiltros(prev => ({ ...prev, excluirAtividadesIds: next }))
                        setFiltrosAplicados(prev => ({ ...prev, excluirAtividadesIds: next }))
                      }
                      return Object.entries(porSetor).map(([setor, atividades]) => (
                        <div key={setor} className="space-y-1.5">
                          <p className="text-[11px] font-medium text-gray-700">{setor}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {atividades.map(a => (
                              <div key={a.id} className="flex items-center gap-1.5">
                                <Checkbox
                                  id={`atividade-${a.id}`}
                                  checked={!excluidos.includes(a.id)}
                                  onCheckedChange={(checked) => toggleAtividade(a.id, !!checked)}
                                  className="rounded-md"
                                />
                                <Label htmlFor={`atividade-${a.id}`} className="text-[11px] cursor-pointer text-gray-600 truncate max-w-[180px]">
                                  {a.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
              <AccordionItem value="whatsapp" className="border-0">
                <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold text-gray-900 hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/70 hover:from-orange-100/80 hover:to-orange-100/60 [&[data-state=open]]:from-orange-50 [&[data-state=open]]:to-orange-100/70 flex items-center justify-between w-full">
                  <span className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <IconWhatsApp className="w-4 h-4 flex-shrink-0 text-black" />
                    <span className="truncate">Envio para WhatsApp</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-1 space-y-2.5 border-t border-border/60">
                  <p className="text-[11px] text-muted-foreground">
                    Cadastre até 3 números. O botão Enviar em cada card envia <strong>somente aquela licitação</strong> para os números cadastrados (sem abrir modal).
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="DDD + celular"
                        value={whatsAppNovoNumero}
                        onChange={(e) => setWhatsAppNovoNumero(maskTelefone(e.target.value))}
                        className="h-8 rounded-md border-border/80 text-xs flex-1"
                        maxLength={16}
                      />
                      <Input
                        placeholder="Rótulo"
                        value={whatsAppNovoLabel}
                        onChange={(e) => setWhatsAppNovoLabel(e.target.value)}
                        className="h-8 rounded-md border-border/80 text-[11px] w-24"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-border text-xs shrink-0"
                        onClick={adicionarNumeroWhatsApp}
                        disabled={listaNumerosWhatsApp.length >= 3 || whatsAppNovoNumero.replace(/\D/g, '').length < 10}
                      >
                        Adicionar
                      </Button>
                    </div>
                    {listaNumerosWhatsApp.length > 0 && (
                      <ul className="space-y-1 mt-2">
                        {listaNumerosWhatsApp.map((item, index) => {
                          const num = (item.numero_telefone || '').replace(/\D/g, '')
                          const display = num.length >= 10 ? maskTelefone(item.numero_telefone) : item.numero_telefone
                          return (
                            <li key={index} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-gray-50 border border-border/60 text-[11px]">
                              <span className="truncate flex-1 min-w-0">
                                {item.label ? `${item.label}: ` : ''}{display}
                              </span>
                              <button
                                type="button"
                                onClick={() => removerNumeroWhatsApp(index)}
                                className="p-1 rounded hover:bg-red-100 text-red-600 shrink-0"
                                title="Remover número"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="w-full rounded-lg bg-green-600 hover:bg-green-700 h-8 text-xs"
                    onClick={salvarNumerosWhatsApp}
                    disabled={whatsAppSlotsSaving || listaNumerosWhatsApp.length === 0}
                  >
                    {whatsAppSlotsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar números'}
                  </Button>
                </AccordionContent>
              </AccordionItem>


              <AccordionItem value="email" className="border-0">
                <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold text-gray-900 hover:no-underline bg-gradient-to-r from-orange-50 to-orange-100/70 hover:from-orange-100/80 hover:to-orange-100/60 [&[data-state=open]]:from-orange-50 [&[data-state=open]]:to-orange-100/70 flex items-center justify-between w-full">
                  <span className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <Mail className="w-4 h-4 flex-shrink-0 text-gray-700" />
                    <span className="truncate">Envio por E-mail</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-1 space-y-2.5 border-t border-border/60">
                  <p className="text-[11px] text-muted-foreground">
                    Receba diariamente as licitações novas no horário configurado. Informe o e-mail abaixo ou use o cadastrado no perfil.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-medium text-gray-700">E-mail para receber os alertas</Label>
                    <Input
                      type="email"
                      placeholder="ex: seu@email.com (ou use o do perfil)"
                      value={alertaEmailDestino}
                      onChange={(e) => setAlertaEmailDestino(e.target.value)}
                      className="h-8 rounded-md border-border/80 text-xs"
                    />
                  </div>
                  <div className="border-t border-border/60 pt-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-[11px] font-medium text-gray-700">Enviar automaticamente no horário</Label>
                      <Switch
                        checked={alertaEmailAtivo}
                        onCheckedChange={setAlertaEmailAtivo}
                        className="data-[state=checked]:bg-green-600 flex-shrink-0"
                      />
                    </div>
                    {alertaEmailAtivo && (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="time"
                          value={alertaEmailHorario}
                          onChange={(e) => setAlertaEmailHorario(e.target.value || '08:00')}
                          className="h-8 rounded-md border-border/80 text-xs flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs rounded-lg border-border"
                          onClick={salvarAlertaEmail}
                          disabled={alertaEmailSaving}
                        >
                          {alertaEmailSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                        </Button>
                      </div>
                    )}
                    {alertaEmailAtivo && (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-[11px] font-medium text-gray-700">Receber também resumo semanal</Label>
                          <Switch
                            checked={alertaResumoSemanalAtivo}
                            onCheckedChange={setAlertaResumoSemanalAtivo}
                            className="data-[state=checked]:bg-orange-500 flex-shrink-0"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Um job roda no <strong>minuto configurado</strong>, usa os <strong>filtros salvos</strong> desta tela, busca licitações dos <strong>últimos 2 dias</strong> e envia um resumo para o seu e-mail.
                        </p>
                        {alertaResumoSemanalAtivo && (
                          <p className="text-[10px] text-orange-600">
                            Resumo semanal: envio com editais dos <strong>últimos 7 dias</strong> (geralmente às segundas).
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
          </Accordion>
              </div>
        </aside>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          {/* Marcadores de filtragem: filtros aplicados (remover pelo X aplica na hora) */}
          {contarFiltrosAtivos() > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {filtrosAplicados.buscaObjeto && (
                  <Badge variant="secondary" className="gap-1">
                    Busca: {filtrosAplicados.buscaObjeto}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, buscaObjeto: '' }; setFiltros(n); setFiltrosAplicados(n); }} />
                  </Badge>
                )}
                {filtrosAplicados.excluirPalavras && (
                  <Badge variant="secondary" className="gap-1 bg-red-50 text-red-700 border-red-200">
                    Excluir: {filtrosAplicados.excluirPalavras}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, excluirPalavras: '' }; setFiltros(n); setFiltrosAplicados(n); }} />
                  </Badge>
                )}
                {filtrosAplicados.uf && (
                  <Badge variant="secondary" className="gap-1">
                    UF: {filtrosAplicados.uf}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, uf: '' }; setFiltros(n); setFiltrosAplicados(n); }} />
                  </Badge>
                )}
                {(filtrosAplicados.excluirAtividadesIds || []).length > 0 && (
                  <Badge variant="secondary" className="gap-1 bg-amber-50 text-amber-800 border-amber-200">
                    {(filtrosAplicados.excluirAtividadesIds || []).length} atividade{(filtrosAplicados.excluirAtividadesIds || []).length > 1 ? 's' : ''} excluída{(filtrosAplicados.excluirAtividadesIds || []).length > 1 ? 's' : ''}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, excluirAtividadesIds: [] }; setFiltros(n); setFiltrosAplicados(n); }} />
                  </Badge>
                )}
                {filtrosAplicados.statusEdital && (
                  <Badge variant="secondary" className="gap-1">
                    Status: {
                      filtrosAplicados.statusEdital === 'proximo' ? 'Próximo' :
                      filtrosAplicados.statusEdital === 'andamento' ? 'Em Andamento' :
                      filtrosAplicados.statusEdital === 'encerrando' ? 'Encerrando' :
                      filtrosAplicados.statusEdital === 'urgente' ? 'Urgente' :
                      'Encerrado'
                    }
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, statusEdital: '' }; setFiltros(n); setFiltrosAplicados(n); }} />
                  </Badge>
                )}
                {(filtrosAplicados.dataPublicacaoInicio || filtrosAplicados.dataPublicacaoFim) && (
                  <Badge variant="secondary" className="gap-1">
                    Data: {filtrosAplicados.dataPublicacaoInicio ? formatarData(filtrosAplicados.dataPublicacaoInicio) : '...'} - {filtrosAplicados.dataPublicacaoFim ? formatarData(filtrosAplicados.dataPublicacaoFim) : '...'}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, dataPublicacaoInicio: '', dataPublicacaoFim: '' }; setFiltros(n); setFiltrosAplicados(n); }} />
                  </Badge>
                )}
                {(filtrosAplicados.valorMin || filtrosAplicados.valorMax) && (
                  <Badge variant="secondary" className="gap-1">
                    Valor: R$ {filtrosAplicados.valorMin || '0'} - {filtrosAplicados.valorMax || '∞'}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, valorMin: '', valorMax: '' }; setFiltros(n); setFiltrosAplicados(n); }} />
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
                {filtrosAplicados.comDocumentos && (
                  <Badge variant="secondary" className="gap-1">
                    Com documentos
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, comDocumentos: false }; setFiltros(n); setFiltrosAplicados(n); }} />
                  </Badge>
                )}
                {filtrosAplicados.comItens && (
                  <Badge variant="secondary" className="gap-1">
                    Com itens
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, comItens: false }; setFiltros(n); setFiltrosAplicados(n); }} />
                  </Badge>
                )}
                {filtrosAplicados.comValor && (
                  <Badge variant="secondary" className="gap-1">
                    Com valor
                    <X className="w-3 h-3 cursor-pointer" onClick={() => { const n = { ...filtrosAplicados, comValor: false }; setFiltros(n); setFiltrosAplicados(n); }} />
                  </Badge>
                              )}
                            </div>
            )}
                        </div>

          {/* Loading / Filtro em andamento – skeleton cards (garante visibilidade durante todo o carregamento) */}
          {((isLoading || isFetching || processandoFiltro) && licitacoesFinais.length === 0) && (
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

          {/* Marcadores de filtragem e contagem — feedback visual claro */}
          {!error && !((isLoading || isFetching || processandoFiltro) && licitacoesFinais.length === 0) && (
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-base font-semibold text-gray-800">
                  {recomendadaSelecionada
                    ? '1 edital recomendado'
                    : licitacoesParaExibir.length === 0
                    ? '0 editais encontrados'
                    : licitacoesParaExibir.length === 1
                    ? '1 edital encontrado'
                    : `${licitacoesParaExibir.length} editais encontrados`}
                </span>
                {!recomendadaSelecionada && licitacoesParaExibir.length !== licitacoesPagina.length && (
                  <span className="text-sm text-gray-500">
                    (exibindo {licitacoesPagina.length} de {licitacoesParaExibir.length})
                  </span>
                )}
                {perfilUsuario?.setores_atividades?.length > 0 && (
                  <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200 font-normal">
                    Do seu setor
                  </Badge>
                )}
              </div>
              {(filtros.buscaObjeto || filtros.excluirPalavras || filtros.uf || filtros.statusEdital || 
                filtros.dataPublicacaoInicio || filtros.dataPublicacaoFim || filtros.valorMin || 
                filtros.valorMax || filtros.comDocumentos || 
                filtros.comItens || filtros.comValor || dataFiltro) && licitacoesParaExibir.length > 100 && (
                <p className="text-xs text-orange-600">
                  ⚠️ Muitos resultados ({licitacoesParaExibir.length}). Use mais filtros na sidebar para refinar.
                </p>
              )}
            </div>
          )}

          {/* Recomendadas para você: 3 abas por aderência (Alta / Média / Baixa); clique no card mostra só o edital */}
          {!((isLoading || isFetching || processandoFiltro) && licitacoesFinais.length === 0) && recomendadas.length > 0 && !recomendadaSelecionada && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-orange-500">★</span> Recomendadas para você
              </h2>
              <p className="text-sm text-gray-500 mb-3">Filtre por aderência ao seu perfil (setores + CNAEs). Clique em um card para ver só esse edital.</p>

              {/* Abas: Alta / Média / Baixa aderência */}
              <div className="flex border-b border-gray-200 mb-4">
                {[
                  { id: 'alta', label: 'Alta aderência', desc: '27%+', count: contagemPorAba.alta, cor: 'green' },
                  { id: 'média', label: 'Média aderência', desc: '20–26%', count: contagemPorAba.média, cor: 'amber' },
                  { id: 'baixa', label: 'Baixa aderência', desc: 'abaixo de 20%', count: contagemPorAba.baixa, cor: 'gray' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAbaAderencia(tab.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      abaAderencia === tab.id
                        ? tab.cor === 'green'
                          ? 'border-green-600 text-green-700'
                          : tab.cor === 'amber'
                          ? 'border-amber-600 text-amber-700'
                          : 'border-gray-600 text-gray-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label} <span className="text-xs opacity-80">({tab.count})</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {recomendadasNaAba.length === 0 ? (
                  <p className="col-span-full text-sm text-gray-500 py-4">
                    Nenhuma licitação com {abaAderencia === 'alta' ? 'alta (27%+)' : abaAderencia === 'média' ? 'média (20–26%)' : 'baixa (abaixo de 20%)'} aderência nesta amostra.
                  </p>
                ) : (
                  recomendadasNaAba.map(({ licitacao, score, label }) => (
                    <Card
                      key={`rec-${licitacao.id ?? licitacao.numero_controle_pncp}`}
                      className="rounded-lg border border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => {
                        setRecomendadaSelecionada(licitacao)
                        setCardsExpandidos(prev => new Set([...prev, licitacao.id ?? licitacao.numero_controle_pncp]))
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-medium text-gray-500">Aderência</span>
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${score}%`,
                                backgroundColor: label === 'alta' ? '#16a34a' : label === 'média' ? '#d97706' : '#9ca3af'
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-gray-700 tabular-nums w-6">{score}%</span>
                        </div>
                        <span
                          className={
                            label === 'alta'
                              ? 'inline-block text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5'
                              : label === 'média'
                              ? 'inline-block text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5'
                              : 'inline-block text-[10px] font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5'
                          }
                          title={label === 'alta' ? 'Alta aderência (27%+)' : label === 'média' ? 'Média aderência (20–26%)' : 'Baixa aderência (abaixo de 20%)'}
                        >
                          {label === 'alta' ? 'Alta aderência' : label === 'média' ? 'Média aderência' : 'Baixa aderência'}
                        </span>
                        <p className="text-sm text-gray-900 line-clamp-2 mt-1">{licitacao.objeto_compra || licitacao.objeto_licitacao || '—'}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{licitacao.orgao_razao_social || '—'}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
          {/* Barra "Ver todos" quando um recomendado está selecionado */}
          {recomendadaSelecionada && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-2">
              <span className="text-sm font-medium text-gray-800">Exibindo 1 edital recomendado</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={() => setRecomendadaSelecionada(null)}
              >
                Ver todos os editais
              </Button>
            </div>
          )}

          {/* Cards de Licitações (ou só o edital recomendado selecionado) */}
          {!((isLoading || isFetching || processandoFiltro) && licitacoesFinais.length === 0) && (
              <div className="space-y-4">
              {licitacoesParaExibir.length > 0 || recomendadaSelecionada ? (
                licitacoesNaTela.map((licitacao) => {
                  const scoreInfo = scorePorId.get(licitacao.id ?? licitacao.numero_controle_pncp)
                  return (
            <Card 
              key={licitacao.id} 
              className="rounded-xl border border-gray-100 border-l-4 border-l-orange-500 bg-white shadow-sm hover:shadow-xl hover:bg-orange-50/20 transition-all duration-200"
            >
              <CardContent className="p-6">
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (numerosWhatsApp?.length > 0) {
                            enviarParaTodosNumerosCadastrados(licitacao)
                          } else {
                            setWhatsAppModalLicitacao(licitacao)
                            setWhatsAppNumero('')
                          }
                        }}
                        disabled={whatsAppEnviando}
                        className="w-8 h-8 rounded-full bg-white border flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
                        title={numerosWhatsApp?.length > 0 ? `Enviar só esta licitação para ${numerosWhatsApp.length} número(s) cadastrado(s)` : 'Enviar esta licitação para WhatsApp'}
                      >
                        {whatsAppEnviando ? <Loader2 className="w-4 h-4 animate-spin text-gray-600" /> : <Send className="w-4 h-4 text-gray-600" />}
                      </button>
                      {numerosWhatsApp?.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setWhatsAppModalLicitacao(licitacao); setWhatsAppNumero(''); }}
                          className="w-7 h-7 rounded-full bg-white border flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 transition-colors text-[10px] font-medium text-gray-500"
                          title="Enviar para outro número"
                        >
                          +1
                        </button>
                      )}
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
                  
                  {/* Barra de aderência (setores + CNAE) — em todos os cards */}
                  {temPerfilParaScore && (
                    <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[120px]">
                      <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">Aderência</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(scoreInfo?.score ?? 0)}%`,
                            backgroundColor: (scoreInfo?.label ?? 'baixa') === 'alta' ? '#16a34a' : (scoreInfo?.label === 'média' ? '#d97706' : '#9ca3af')
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-gray-700 tabular-nums w-7">{(scoreInfo?.score ?? 0)}%</span>
                    </div>
                  )}

                  {/* Badges de Status e Datas */}
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {/* Badge de aderência (filtro semântico) — opcional, complementa a barra */}
                    {scoreInfo && (scoreInfo.label === 'alta' || scoreInfo.label === 'média') && (
                      <Badge
                        variant="secondary"
                        className={
                          scoreInfo.label === 'alta'
                            ? 'bg-green-100 text-green-800 border-green-200 text-xs'
                            : 'bg-amber-100 text-amber-800 border-amber-200 text-xs'
                        }
                      >
                        {scoreInfo.label === 'alta' ? 'Alta aderência' : 'Média aderência'}
                      </Badge>
                    )}
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

          {/* Botão Carregar Mais: só renderiza até MAX_LICITACOES_EXIBIR para não travar a UI */}
          {!isLoading && !error && !processandoFiltro && licitacoesParaExibir.length > limitePagina && limitePagina < MAX_LICITACOES_EXIBIR && (
            <div className="text-center mt-8">
              <Button
                onClick={() => setLimitePagina(prev => Math.min(prev + 50, MAX_LICITACOES_EXIBIR))}
                className="bg-orange-500 hover:bg-orange-600"
                size="lg"
              >
                Carregar Mais Licitações
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Exibindo {licitacoesPagina.length} de {licitacoesParaExibir.length}. Use filtros para refinar.
              </p>
            </div>
          )}
          {!isLoading && !error && licitacoesParaExibir.length > MAX_LICITACOES_EXIBIR && limitePagina >= MAX_LICITACOES_EXIBIR && (
            <p className="text-center text-sm text-amber-700 mt-4">
              Limite de exibição ({MAX_LICITACOES_EXIBIR} licitações). Use os filtros ao lado para refinar a busca.
            </p>
          )}
              
        </div>
      </div>

      {/* Modal Enviar para WhatsApp (estado local = não trava ao digitar) */}
      <ModalEnviarWhatsApp
        open={!!whatsAppModalLicitacao}
        licitacao={whatsAppModalLicitacao}
        onClose={() => { setWhatsAppModalLicitacao(null); setWhatsAppNumero(''); }}
        onEnviar={enviarParaWhatsApp}
        enviando={whatsAppEnviando}
      />

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
