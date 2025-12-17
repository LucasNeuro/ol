import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Send, MessageSquare, Sparkles, Copy, Trash2, FileText, AlertCircle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '@/lib/supabase'
import { useChatDocumento } from '@/hooks/useChatDocumento'

// Configurar worker do PDF.js
// Usar a mesma versão instalada (5.4.449) do jsdelivr
const pdfjsVersion = pdfjsLib.version || '5.4.449'
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`

export function VisualizadorDocumento({ 
  open, 
  onOpenChange, 
  urlDocumento, 
  nomeArquivo,
  licitacaoId 
}) {
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPdf, setIsPdf] = useState(true)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [urlLocal, setUrlLocal] = useState(null) // URL do documento no nosso bucket
  const canvasRef = useRef(null)
  const messagesEndRef = useRef(null)
  const renderTaskRef = useRef(null)
  const processedUrlRef = useRef(null)
  const [pergunta, setPergunta] = useState('')
  const [processandoDoc, setProcessandoDoc] = useState(false)
  const [zoom, setZoom] = useState(1.0) // Zoom inicial 100%
  
  // Hook do chat
  const {
    mensagens,
    loading: loadingChat,
    erro: erroChat,
    documentoProcessado,
    processarDocumento,
    enviarPergunta,
    limparConversa,
    resetar
  } = useChatDocumento()

  // Scroll automático para última mensagem - melhorado
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        // Usar scrollIntoView com opções mais confiáveis
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'nearest'
        })
      }
    }
    
    // Delay para garantir que o DOM foi atualizado
    const timeoutId = setTimeout(scrollToBottom, 150)
    
    return () => clearTimeout(timeoutId)
  }, [mensagens, loadingChat, processandoDoc])

  // Processar documento quando abre o modal (apenas PDFs)
  const handleProcessarDocumento = async () => {
    if (!urlDocumento || !isPdf) return
    if (processedUrlRef.current === urlDocumento && documentoProcessado) return
    
    setProcessandoDoc(true)
    try {
      await processarDocumento(
        urlDocumento,
        nomeArquivo || 'documento.pdf',
        licitacaoId || 'visualizacao'
      )
    } catch (error) {
      console.error('Erro ao processar documento para chat:', error)
    } finally {
      setProcessandoDoc(false)
    }
  }

  const handleEnviarPergunta = async (e) => {
    e?.preventDefault()
    
    if (!pergunta.trim() || loadingChat) return
    
    const perguntaAtual = pergunta
    setPergunta('')
    
    try {
      await enviarPergunta(perguntaAtual)
    } catch (error) {
      setPergunta(perguntaAtual) // Restaurar pergunta em caso de erro
    }
  }

  const copiarResposta = (texto) => {
    navigator.clipboard.writeText(texto)
  }

  useEffect(() => {
    if (open && urlDocumento) {
      // Evitar reprocessar se já carregado o mesmo documento
      const mudouDocumento = processedUrlRef.current !== urlDocumento
      if (mudouDocumento) {
        processedUrlRef.current = urlDocumento
        setPageNumber(1)
        setLoading(true)
        setError(null)
        setPdfDoc(null)
      }
      
      // Verificar se é PDF - lógica mais permissiva
      const urlLower = urlDocumento.toLowerCase()
      const nomeLower = (nomeArquivo || '').toLowerCase()
      
      // Verificar extensões conhecidas de outros tipos
      const extensoesNaoPdf = ['.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.zip', '.rar', '.txt', '.csv']
      const temExtensaoNaoPdf = extensoesNaoPdf.some(ext => {
        // Verificar se termina com a extensão ou tem a extensão no meio
        return urlLower.endsWith(ext) || nomeLower.endsWith(ext) || 
               urlLower.includes(ext + '?') || urlLower.includes(ext + '#') ||
               nomeLower.includes(ext)
      })
      
      // Verificar se tem indicação clara de PDF
      const temIndicacaoPdf = urlLower.includes('.pdf') || 
                              nomeLower.includes('.pdf') || 
                              urlLower.includes('/pdf') ||
                              urlLower.includes('pdf') ||
                              urlLower.includes('application/pdf')
      
      // Se não tem extensão de outro tipo conhecido, assumir que é PDF (padrão para documentos do PNCP)
      // OU se tiver qualquer indicação de PDF
      const resultadoIsPdf = !temExtensaoNaoPdf || temIndicacaoPdf
      
      console.log('🔍 Detecção de tipo:', {
        urlDocumento: urlDocumento.substring(0, 100),
        nomeArquivo,
        temIndicacaoPdf,
        temExtensaoNaoPdf,
        resultadoIsPdf
      })
      
      setIsPdf(resultadoIsPdf)
      
      if (resultadoIsPdf) {
        carregarPDF()
      } else {
        setLoading(false)
      }
    } else {
      setLoading(false)
      setPdfDoc(null)
      setUrlLocal(null)
      processedUrlRef.current = null
      resetar() // Resetar chat ao fechar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, urlDocumento, nomeArquivo])

  // Processar documento para chat quando modal abre (apenas PDFs)
  useEffect(() => {
    if (open && urlDocumento && isPdf && !documentoProcessado && !processandoDoc) {
      handleProcessarDocumento()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, urlDocumento, isPdf, documentoProcessado, processandoDoc])

  // Função para baixar e salvar PDF no Supabase Storage usando Edge Function
  const baixarESalvarNoBucket = async () => {
    try {
      console.log('📥 Processando PDF via Edge Function:', urlDocumento)
      
      if (!supabase) {
        throw new Error('Supabase não configurado')
      }
      
      // Verificar se a Edge Function está disponível
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('URL do Supabase não configurada')
      }
      
      // Obter token de autenticação
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
      
      // Usar Edge Function para baixar e salvar (contorna CORS)
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/processar-documento`
      
      console.log('🔗 Chamando Edge Function:', edgeFunctionUrl)
      
      let response
      try {
        response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            urlDocumento,
            nomeArquivo: nomeArquivo || 'documento.pdf',
            licitacaoId: 'visualizacao', // ID genérico para visualização
          }),
        })
      } catch (fetchError) {
        console.error('❌ Erro na requisição fetch:', fetchError)
        // Se a Edge Function não existir ou não estiver disponível
        if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
          throw new Error('Edge Function não disponível. Verifique se está deployada e acessível. O documento precisa ser aberto em nova aba devido a restrições CORS.')
        }
        throw fetchError
      }
      
      console.log('📡 Resposta recebida:', response.status, response.statusText)
      
      if (!response.ok) {
        // Se retornar 404, a Edge Function não existe
        if (response.status === 404) {
          throw new Error('Edge Function não encontrada (404). Verifique se a função "processar-documento" está deployada no Supabase.')
        }
        
        let errorText = 'Erro desconhecido'
        try {
          errorText = await response.text()
          console.error('❌ Erro na Edge Function:', errorText)
          
          // Tentar parsear como JSON
          try {
            const errorJson = JSON.parse(errorText)
            if (errorJson.error) {
              errorText = errorJson.error
            }
            if (errorJson.details) {
              console.error('❌ Detalhes do erro:', errorJson.details)
            }
          } catch (e) {
            // Não é JSON, usar texto direto
          }
        } catch (e) {
          console.error('❌ Erro ao ler resposta de erro:', e)
        }
        
        throw new Error(`Erro ao processar documento (${response.status}): ${errorText}`)
      }
      
      const result = await response.json()
      console.log('✅ Resultado da Edge Function:', result)
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar documento')
      }
      
      if (!result.documento || !result.documento.urlStorage) {
        throw new Error('Resposta da Edge Function inválida: URL do documento não encontrada')
      }
      
      console.log('✅ PDF processado e salvo:', result.documento)
      
      // Retornar URL do storage
      return result.documento.urlStorage
    } catch (err) {
      console.error('❌ Erro ao processar PDF via Edge Function:', err)
      console.error('❌ Stack:', err.stack)
      throw err
    }
  }

  const carregarPDF = async () => {
    // Se já temos o PDF carregado para a mesma URL, não recarregar
    if (pdfDoc && processedUrlRef.current === urlDocumento) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      
      console.log('📥 Iniciando carregamento de PDF...')
      
      // Estratégia 1: Tentar carregar diretamente primeiro (pode funcionar se não houver CORS)
      let urlParaUsar = urlDocumento
      let tentouDireto = false
      let tentouBucket = false
      
      try {
        console.log('🔄 Tentativa 1: Carregando diretamente da URL...')
        const loadingTaskDireto = pdfjsLib.getDocument({
          url: urlDocumento,
          withCredentials: false,
          httpHeaders: {},
          verbosity: 0
        })
        
        const pdfDataDireto = await loadingTaskDireto.promise
        console.log('✅ PDF carregado diretamente:', pdfDataDireto.numPages, 'páginas')
        
        setPdfDoc(pdfDataDireto)
        setNumPages(pdfDataDireto.numPages)
        setPageNumber(1)
        setLoading(false)
        return // Sucesso!
      } catch (erroDireto) {
        console.warn('⚠️ Falha ao carregar diretamente:', erroDireto.message)
        tentouDireto = true
      }
      
      // Estratégia 2: Tentar usar Edge Function para baixar e salvar no bucket
      try {
        console.log('🔄 Tentativa 2: Usando Edge Function para contornar CORS...')
        const urlLocalStorage = await baixarESalvarNoBucket()
        urlParaUsar = urlLocalStorage
        setUrlLocal(urlLocalStorage)
        tentouBucket = true
        console.log('✅ PDF processado via Edge Function, usando URL local:', urlLocalStorage)
        
        // Tentar carregar o PDF do bucket
        const loadingTask = pdfjsLib.getDocument({
          url: urlParaUsar,
          withCredentials: false,
          httpHeaders: {},
          verbosity: 0
        })
        
        const pdfData = await loadingTask.promise
        console.log('✅ PDF carregado do bucket:', pdfData.numPages, 'páginas')
        
        setPdfDoc(pdfData)
        setNumPages(pdfData.numPages)
        setPageNumber(1)
        setLoading(false)
        return // Sucesso!
      } catch (bucketError) {
        console.warn('⚠️ Falha ao processar via Edge Function:', bucketError.message)
        tentouBucket = true
      }
      
      // Se ambas as estratégias falharam, é CORS
      console.error('❌ Todas as tentativas falharam - CORS bloqueando acesso')
      throw new Error('Não foi possível carregar o documento. O servidor bloqueia o acesso devido a restrições de segurança (CORS). Use "Abrir em nova aba" para visualizar o documento.')
      
    } catch (err) {
      console.error('❌ Erro ao carregar PDF:', err)
      setError(err.message || 'Não foi possível carregar o documento PDF')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pdfDoc && canvasRef.current && pageNumber) {
      renderizarPagina()
    }
  }, [pdfDoc, pageNumber, zoom])

  const renderizarPagina = async () => {
    if (!pdfDoc || !canvasRef.current) return
    
    try {
      // Cancelar render anterior, se existir
      if (renderTaskRef.current && renderTaskRef.current.cancel) {
        try {
          renderTaskRef.current.cancel()
        } catch (err) {
          console.warn('⚠️ Falha ao cancelar render anterior:', err)
        }
      }
      
      const page = await pdfDoc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: zoom })
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      // Definir dimensões do canvas baseadas no viewport (zoom aplicado)
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      // Garantir que o canvas tenha o tamanho físico correto
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      
      renderTaskRef.current = page.render(renderContext)
      await renderTaskRef.current.promise
      console.log('✅ Página renderizada:', pageNumber, 'zoom:', zoom, 'dimensões:', viewport.width, 'x', viewport.height)
    } catch (err) {
      console.error('❌ Erro ao renderizar página:', err)
      setError('Erro ao renderizar página do documento')
    } finally {
      renderTaskRef.current = null
    }
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(numPages || 1, prev + 1))
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, 8)) // Máximo 8x
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, 1)) // Mínimo 1x
  }

  const handleZoomReset = () => {
    setZoom(1.0) // Voltar ao zoom padrão (100%)
  }

  const handleDownload = () => {
    if (urlDocumento) {
      const link = document.createElement('a')
      link.href = urlDocumento
      link.download = nomeArquivo || 'documento.pdf'
      link.target = '_blank'
      link.click()
    }
  }

  const handleOpenExternal = () => {
    if (urlDocumento) {
      window.open(urlDocumento, '_blank')
    }
  }

  if (!open || !urlDocumento) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-full max-h-[98vh] h-[98vh] p-0 bg-black/80 backdrop-blur-sm border-none overflow-hidden">
        <DialogTitle className="sr-only">Visualizador de Documento</DialogTitle>
        <DialogDescription className="sr-only">
          Visualizador de documento PDF integrado
        </DialogDescription>
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-white truncate">
                {nomeArquivo || 'Documento'}
              </h3>
              {numPages && (
                <p className="text-xs text-white/70">
                  Página {pageNumber} de {numPages}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Controles de Zoom */}
            {isPdf && pdfDoc && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  title="Diminuir zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-white/70 px-2 min-w-[60px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoom >= 8}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomReset}
                  className="text-white hover:bg-white/20 h-8 px-2 text-xs"
                  title="Resetar zoom"
                >
                  <Maximize2 className="w-3 h-3 mr-1" />
                  Reset
                </Button>
                <div className="w-px h-6 bg-white/20 mx-1" />
              </>
            )}

            {/* Controles de navegação */}
            {isPdf && numPages && numPages > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevPage}
                  disabled={pageNumber === 1}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-white/70 px-2">
                  {pageNumber} / {numPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={pageNumber === numPages}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  title="Próxima página"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-white/20 mx-1" />
              </>
            )}
            
            {/* Botão Download */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              title="Baixar documento"
            >
              <Download className="w-4 h-4" />
            </Button>
            
            {/* Botão Abrir Externa */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenExternal}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            
            {/* Botão Fechar */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Conteúdo: Documento + Chat lado a lado */}
        <div className="w-full h-full pt-14 flex bg-gray-900 overflow-hidden">
          {/* Área do Documento (50%) */}
          <div className="w-[50%] h-full flex items-center justify-center overflow-auto bg-gray-900 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-sm text-white/70">Carregando documento...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="text-center p-6 bg-black/80 rounded-lg border border-white/10 max-w-md">
                <p className="text-red-400 mb-2">Erro ao carregar documento</p>
                <p className="text-sm text-white/70 mb-4">{error}</p>
                <p className="text-xs text-white/50 mb-4">
                  O documento pode estar bloqueado por CORS. Tente baixar ou abrir em nova aba.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="text-white border-white/20 hover:bg-white/10"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Baixar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleOpenExternal}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir em nova aba
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Visualizador PDF usando PDF.js */}
          {isPdf && !error && !loading && pdfDoc ? (
            <div className="w-full h-full flex items-start justify-center p-4 overflow-auto">
              <canvas
                ref={canvasRef}
                className="shadow-2xl bg-white rounded"
                style={{ 
                  display: 'block',
                  width: 'auto',
                  height: 'auto'
                }}
              />
            </div>
          ) : !isPdf ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center p-6 bg-black/80 rounded-lg border border-white/10">
                <p className="text-white mb-2">Visualização não disponível para este tipo de arquivo</p>
                <p className="text-sm text-white/70 mb-4">
                  Tipo detectado: {nomeArquivo ? nomeArquivo.split('.').pop() : 'desconhecido'}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="text-white border-white/20 hover:bg-white/10"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Baixar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenExternal}
                    className="text-white border-white/20 hover:bg-white/10"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir em nova aba
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          </div>

          {/* Área do Chat (50%) - Tema Escuro */}
          <div className="w-[50%] border-l border-white/10 bg-gray-800 flex flex-col h-full overflow-hidden">
            {/* Header do Chat */}
            <div className="px-4 py-3 border-b border-white/10 bg-gray-900/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white">
                    Assistente IA
                  </h4>
                  <p className="text-xs text-white/60">
                    {documentoProcessado ? nomeArquivo : processandoDoc ? 'Processando...' : 'Aguardando documento'}
                  </p>
                </div>
              </div>
            </div>

            {/* Área de Mensagens - Scroll Independente */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ 
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              {/* Estado Inicial */}
              {mensagens.length === 0 && !processandoDoc && documentoProcessado && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-2 text-base">
                    Faça uma pergunta sobre o documento
                  </h3>
                  <p className="text-sm text-white/60">
                    Pergunte qualquer coisa sobre o conteúdo do edital
                  </p>
                </div>
              )}

              {/* Processando Documento */}
              {processandoDoc && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-white/70">Processando documento...</p>
                  <p className="text-xs text-white/50 mt-1">
                    Isso pode levar alguns segundos
                  </p>
                </div>
              )}

              {/* Erro ao Processar */}
              {erroChat && !processandoDoc && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-400 text-xs">Erro ao processar</p>
                    <p className="text-xs text-red-300/80 mt-1">{erroChat}</p>
                  </div>
                </div>
              )}

              {/* Mensagens */}
              {mensagens.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-white border border-gray-600'
                    }`}
                  >
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                    
                    {/* Botão de copiar (apenas para respostas da IA) */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-600">
                        <button
                          onClick={() => copiarResposta(msg.content)}
                          className="text-xs text-white/60 hover:text-white flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          Copiar
                        </button>
                      </div>
                    )}
                    
                    <p className="text-xs opacity-60 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Loading de nova mensagem */}
              {loadingChat && mensagens.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                      <span className="text-xs text-white/70">Pensando...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input de Pergunta */}
            <div className="px-4 py-3 border-t border-white/10 bg-gray-900/50 flex-shrink-0">
              {/* Botão Limpar Conversa */}
              {mensagens.length > 0 && (
                <div className="mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={limparConversa}
                    className="text-white/60 hover:text-white hover:bg-gray-700 h-7 text-xs"
                  >
                    <Trash2 className="w-3 h-3 mr-1.5" />
                    Limpar conversa
                  </Button>
                </div>
              )}
              
              <form onSubmit={handleEnviarPergunta} className="flex gap-2">
                <Input
                  value={pergunta}
                  onChange={(e) => setPergunta(e.target.value)}
                  placeholder="Digite sua pergunta..."
                  disabled={loadingChat || !documentoProcessado || processandoDoc}
                  className="flex-1 bg-gray-700 border-gray-600 text-white placeholder:text-white/40 h-9 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleEnviarPergunta()
                    }
                  }}
                />
                <Button
                  type="submit"
                  disabled={!pergunta.trim() || loadingChat || !documentoProcessado || processandoDoc}
                  className="bg-purple-600 hover:bg-purple-700 h-9 w-9 p-0"
                >
                  {loadingChat ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
              
              <p className="text-xs text-white/40 mt-2 text-center">
                Powered by <strong>Mistral AI</strong>
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
