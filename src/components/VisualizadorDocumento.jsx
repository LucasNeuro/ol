import { useState, useEffect, useRef } from 'react'
import {
  X, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2,
  Send, MessageSquare, Sparkles, Copy, Trash2, AlertCircle,
  ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '@/lib/supabase'
import { useChatDocumento } from '@/hooks/useChatDocumento'

// Configurar worker
const pdfjsVersion = pdfjsLib.version || '5.4.449'
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`

// ── CSS injetado uma vez para a text layer ────────────────────────────────
const TEXT_LAYER_STYLE = `
  .pdf-text-layer { position: absolute; top: 0; left: 0; overflow: hidden; pointer-events: none; }
  .pdf-text-layer span {
    color: transparent; position: absolute; white-space: pre;
    cursor: text; transform-origin: 0% 0%; pointer-events: auto;
    line-height: 1; user-select: text;
  }
  .pdf-text-layer span::selection { background: rgba(139,92,246,0.35); }
  .pdf-text-layer br { display: none; }
`

function injectTextLayerStyles() {
  if (document.getElementById('pdf-tl-styles')) return
  const s = document.createElement('style')
  s.id = 'pdf-tl-styles'
  s.textContent = TEXT_LAYER_STYLE
  document.head.appendChild(s)
}

export function VisualizadorDocumento({
  open,
  onOpenChange,
  urlDocumento,
  nomeArquivo,
  licitacaoId,
}) {
  const [numPages, setNumPages]       = useState(null)
  const [pageNumber, setPageNumber]   = useState(1)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [isPdf, setIsPdf]             = useState(true)
  const [pdfDoc, setPdfDoc]           = useState(null)
  const [urlLocal, setUrlLocal]       = useState(null)
  const [zoom, setZoom]               = useState(1.0)
  const [pergunta, setPergunta]       = useState('')
  const [processandoDoc, setProcessandoDoc] = useState(false)
  const [textoPagina, setTextoPagina] = useState('')

  const canvasRef        = useRef(null)
  const textLayerRef     = useRef(null)
  const canvasWrapRef    = useRef(null)
  const messagesEndRef   = useRef(null)
  const renderTaskRef    = useRef(null)
  const textLayerTaskRef = useRef(null)
  const processedUrlRef  = useRef(null)

  const {
    mensagens, loading: loadingChat, erro: erroChat,
    documentoProcessado, processarDocumento, enviarPergunta,
    limparConversa, resetar,
  } = useChatDocumento()

  // inject text-layer CSS once
  useEffect(() => { injectTextLayerStyles() }, [])

  // scroll to latest message
  useEffect(() => {
    const id = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 150)
    return () => clearTimeout(id)
  }, [mensagens, loadingChat, processandoDoc])

  // ── Processar documento para chat ──────────────────────────────────────
  const handleProcessarDocumento = async () => {
    if (!urlDocumento || !isPdf) return
    if (processedUrlRef.current === urlDocumento && documentoProcessado) return
    setProcessandoDoc(true)
    try {
      await processarDocumento(
        urlDocumento,
        nomeArquivo || 'documento.pdf',
        licitacaoId || 'visualizacao',
      )
    } catch { /* silencioso */ } finally {
      setProcessandoDoc(false)
    }
  }

  const handleEnviarPergunta = async (e) => {
    e?.preventDefault()
    if (!pergunta.trim() || loadingChat) return
    const q = pergunta
    setPergunta('')
    try {
      await enviarPergunta(q, {
        paginaAtual: pageNumber,
        textoPagina,
      })
    } catch {
      setPergunta(q)
    }
  }

  const copiarResposta = (t) => navigator.clipboard.writeText(t)

  // ── Abrir / fechar modal ───────────────────────────────────────────────
  useEffect(() => {
    if (open && urlDocumento) {
      const mudou = processedUrlRef.current !== urlDocumento
      if (mudou) {
        processedUrlRef.current = urlDocumento
        setPageNumber(1)
        setLoading(true)
        setError(null)
        setPdfDoc(null)
        setTextoPagina('')
      }

      const urlLower  = urlDocumento.toLowerCase()
      const nomeLower = (nomeArquivo || '').toLowerCase()
      const naoPdf    = ['.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.zip','.rar','.txt','.csv']
      const temNaoPdf = naoPdf.some(e => urlLower.endsWith(e) || nomeLower.endsWith(e) || urlLower.includes(e+'?') || nomeLower.includes(e))
      const temPdf    = ['.pdf','/pdf','pdf','application/pdf'].some(e => urlLower.includes(e) || nomeLower.includes(e))
      const ehPdf     = !temNaoPdf || temPdf

      setIsPdf(ehPdf)
      if (ehPdf) carregarPDF()
      else setLoading(false)
    } else {
      setLoading(false)
      setPdfDoc(null)
      setUrlLocal(null)
      processedUrlRef.current = null
      resetar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, urlDocumento, nomeArquivo])

  useEffect(() => {
    const urlOk = urlDocumento && typeof urlDocumento === 'string' && !urlDocumento.startsWith('blob:')
    if (open && urlOk && isPdf && !documentoProcessado && !processandoDoc) {
      handleProcessarDocumento()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, urlDocumento, isPdf, documentoProcessado, processandoDoc])

  // ── Baixar PDF para Supabase Storage ──────────────────────────────────
  const baixarESalvarNoBucket = async () => {
    if (!supabase) throw new Error('Supabase não configurado')
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) throw new Error('URL do Supabase não configurada')
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
    let response
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/processar-documento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ urlDocumento, nomeArquivo: nomeArquivo || 'documento.pdf', licitacaoId: 'visualizacao' }),
      })
    } catch (fe) {
      if (fe.message.includes('Failed to fetch') || fe.message.includes('NetworkError')) {
        throw new Error('Edge Function não disponível. Use "Abrir em nova aba" para visualizar no PNCP.')
      }
      throw fe
    }
    if (!response.ok) {
      if (response.status === 404) throw new Error('Edge Function não encontrada (404). Verifique se "processar-documento" está deployada.')
      let t = 'Erro desconhecido'
      try { const j = await response.json(); t = j.error || j.details || t } catch { t = await response.text().catch(() => t) }
      throw new Error(`Erro ao processar documento (${response.status}): ${t}`)
    }
    const result = await response.json()
    if (!result.success) throw new Error(result.error || 'Erro ao processar documento')
    if (!result.documento?.urlStorage) throw new Error('Resposta inválida: URL não encontrada')
    return result.documento.urlStorage
  }

  const carregarPDF = async () => {
    if (pdfDoc && processedUrlRef.current === urlDocumento) { setLoading(false); return }
    try {
      setLoading(true); setError(null)
      const isBlob = typeof urlDocumento === 'string' && urlDocumento.startsWith('blob:')
      const url = isBlob ? urlDocumento : await baixarESalvarNoBucket()
      if (!isBlob) setUrlLocal(url)
      const task = pdfjsLib.getDocument({ url, withCredentials: false, verbosity: 0 })
      const pdf  = await task.promise
      setPdfDoc(pdf)
      setNumPages(pdf.numPages)
      setPageNumber(1)
      setLoading(false)
    } catch (err) {
      if (err.message?.includes('muito grande')) {
        setError(err.message + ' Use "Abrir em nova aba" para visualizar no PNCP.')
      } else {
        setError(err.message || 'Não foi possível carregar o documento PDF')
      }
      setLoading(false)
    }
  }

  // ── Renderizar página + text layer ────────────────────────────────────
  useEffect(() => {
    if (pdfDoc && canvasRef.current && pageNumber) renderizarPagina()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageNumber, zoom])

  const renderizarPagina = async () => {
    if (!pdfDoc || !canvasRef.current) return
    try {
      // cancelar renders anteriores
      try { renderTaskRef.current?.cancel() }    catch { /* noop */ }
      try { textLayerTaskRef.current?.cancel() } catch { /* noop */ }

      const page     = await pdfDoc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: zoom })

      // ── Canvas ──────────────────────────────────────────────────────
      const canvas  = canvasRef.current
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width  = viewport.width
      canvas.style.width  = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      renderTaskRef.current = page.render({ canvasContext: context, viewport })
      await renderTaskRef.current.promise
      renderTaskRef.current = null

      // ── Text Layer (seleção de texto) ───────────────────────────────
      const tl = textLayerRef.current
      if (!tl) return
      tl.innerHTML = ''
      tl.style.width  = `${viewport.width}px`
      tl.style.height = `${viewport.height}px`

      try {
        const textContent = await page.getTextContent()

        // Extrair texto simples da página para enviar à IA
        try {
          const plain = textContent.items
            .map((item) => item.str || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
          setTextoPagina(plain)
        } catch {
          setTextoPagina('')
        }

        // PDF.js v4 / v5 — tenta renderTextLayer primeiro
        if (typeof pdfjsLib.renderTextLayer === 'function') {
          const task = pdfjsLib.renderTextLayer({
            textContent,
            container: tl,
            viewport,
            textDivs: [],
          })
          textLayerTaskRef.current = task
          if (task?.promise) await task.promise
        } else if (typeof pdfjsLib.TextLayer === 'function') {
          // fallback PDF.js v5 class API
          const inst = new pdfjsLib.TextLayer({ textContentSource: textContent, container: tl, viewport })
          textLayerTaskRef.current = inst
          await inst.render()
        } else {
          // fallback manual mínimo
          textContent.items.forEach((item) => {
            if (!item.str) return
            const span = document.createElement('span')
            span.textContent = item.str
            // transform PDF coordinates → viewport pixels
            const [a, b, c, d, e, f] = pdfjsLib.Util
              ? pdfjsLib.Util.transform(viewport.transform, item.transform)
              : item.transform
            const fontH = Math.sqrt(b * b + d * d)
            span.style.cssText = [
              `left:${e}px`,
              `top:${f - fontH}px`,
              `font-size:${fontH}px`,
              `width:${(item.width * viewport.scale) || 0}px`,
            ].join(';')
            tl.appendChild(span)
          })
        }
      } catch (e) {
        console.warn('Text layer error (non-fatal):', e)
      }
    } catch (err) {
      if (!err?.message?.includes('cancel') && !err?.message?.includes('Cancel')) {
        setError('Erro ao renderizar página do documento')
      }
    }
  }


  // ── Navegação / zoom ──────────────────────────────────────────────────
  const goToPrevPage  = () => setPageNumber(p => Math.max(1, p - 1))
  const goToNextPage  = () => setPageNumber(p => Math.min(numPages || 1, p + 1))
  const handleZoomIn  = () => setZoom(z => Math.min(z + 0.5, 8))
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.5, 1))
  const handleZoomReset = () => setZoom(1.0)
  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = urlDocumento; a.download = nomeArquivo || 'documento.pdf'; a.target = '_blank'; a.click()
  }
  const handleOpenExternal = () => { if (urlDocumento) window.open(urlDocumento, '_blank') }

  if (!open || !urlDocumento) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[98vw] w-full max-h-[98vh] h-[98vh] p-0 bg-black/80 backdrop-blur-sm border-none overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Visualizador de Documento</DialogTitle>
        <DialogDescription className="sr-only">Visualizador de documento PDF integrado</DialogDescription>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="text-sm font-medium text-white truncate">{nomeArquivo || 'Documento'}</h3>
            {numPages && (
              <p className="text-xs text-white/70">Página {pageNumber} de {numPages}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isPdf && pdfDoc && (
              <>
                <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={zoom <= 1}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0" title="Diminuir zoom">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-white/70 px-2 min-w-[52px] text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={zoom >= 8}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0" title="Aumentar zoom">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleZoomReset}
                  className="text-white hover:bg-white/20 h-8 px-2 text-xs" title="Resetar zoom">
                  <Maximize2 className="w-3 h-3 mr-1" /> Reset
                </Button>
                <div className="w-px h-6 bg-white/20 mx-1" />
              </>
            )}

            {isPdf && numPages && numPages > 1 && (
              <>
                <Button variant="ghost" size="sm" onClick={goToPrevPage} disabled={pageNumber === 1}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-white/70 px-2">{pageNumber} / {numPages}</span>
                <Button variant="ghost" size="sm" onClick={goToNextPage} disabled={pageNumber === numPages}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-white/20 mx-1" />
              </>
            )}

            <Button variant="ghost" size="sm" onClick={handleDownload}
              className="text-white hover:bg-white/20 h-8 w-8 p-0" title="Baixar documento">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleOpenExternal}
              className="text-white hover:bg-white/20 h-8 w-8 p-0" title="Abrir em nova aba">
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20 h-8 w-8 p-0" title="Fechar">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Layout Principal ─────────────────────────────────────────── */}
        <div className="w-full h-full pt-14 flex bg-gray-900 overflow-hidden">

          {/* ── Área do Documento (50%) ─────────────────────────────── */}
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
                    <Button variant="outline" size="sm" onClick={handleDownload}
                      className="text-white border-white/20 hover:bg-white/10">
                      <Download className="w-4 h-4 mr-2" /> Baixar
                    </Button>
                    <Button variant="default" size="sm" onClick={handleOpenExternal}
                      className="bg-orange-600 hover:bg-orange-700 text-white">
                      <ExternalLink className="w-4 h-4 mr-2" /> Abrir em nova aba
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isPdf && !error && !loading && pdfDoc ? (
              <div className="w-full h-full flex items-start justify-center p-4 overflow-auto">
                {/* wrapper relativo para sobrepor text layer */}
                <div ref={canvasWrapRef} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                  <canvas
                    ref={canvasRef}
                    className="shadow-2xl bg-white rounded"
                    style={{ display: 'block' }}
                  />
                  {/* text layer transparente — permite seleção real */}
                  <div
                    ref={textLayerRef}
                    className="pdf-text-layer"
                  />
                </div>
              </div>
            ) : !isPdf ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center p-6 bg-black/80 rounded-lg border border-white/10">
                  <p className="text-white mb-2">Visualização não disponível para este tipo de arquivo</p>
                  <p className="text-sm text-white/70 mb-4">
                    Tipo detectado: {nomeArquivo ? nomeArquivo.split('.').pop() : 'desconhecido'}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={handleDownload}
                      className="text-white border-white/20 hover:bg-white/10">
                      <Download className="w-4 h-4 mr-2" /> Baixar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleOpenExternal}
                      className="text-white border-white/20 hover:bg-white/10">
                      <ExternalLink className="w-4 h-4 mr-2" /> Abrir em nova aba
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

          </div>

          {/* ── Painel do Chat (50%) ─────────────────────────────────── */}
          <div className="w-[50%] border-l border-white/10 bg-gray-800 flex flex-col h-full overflow-hidden">
            {/* Header do chat */}
            <div className="px-4 py-3 border-b border-white/10 bg-gray-900/50 flex-shrink-0 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">Assistente IA</span>
              <span className="text-xs text-white/40 ml-auto">Powered by Mistral AI</span>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {mensagens.length === 0 && !processandoDoc && documentoProcessado && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">Faça uma pergunta sobre o documento</h3>
                  <p className="text-sm text-white/60">Pergunte qualquer coisa sobre o edital</p>
                </div>
              )}

              {processandoDoc && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-white/70">Processando documento...</p>
                  <p className="text-xs text-white/50 mt-1">Isso pode levar alguns segundos</p>
                </div>
              )}

              {erroChat && !processandoDoc && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-400 text-xs">Erro ao processar</p>
                    <p className="text-xs text-red-300/80 mt-1">{erroChat}</p>
                  </div>
                </div>
              )}

              {mensagens.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-white border border-gray-600'
                  }`}>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-600">
                        <button
                          onClick={() => copiarResposta(msg.content)}
                          className="text-xs text-white/60 hover:text-white flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </button>
                      </div>
                    )}
                    <p className="text-xs opacity-60 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

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

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/10 bg-gray-900/50 flex-shrink-0">
              {mensagens.length > 0 && (
                <div className="mb-2">
                  <Button variant="ghost" size="sm" onClick={limparConversa}
                    className="text-white/60 hover:text-white hover:bg-gray-700 h-7 text-xs">
                    <Trash2 className="w-3 h-3 mr-1.5" /> Limpar conversa
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
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviarPergunta() }
                  }}
                />
                <Button
                  type="submit"
                  disabled={!pergunta.trim() || loadingChat || !documentoProcessado || processandoDoc}
                  className="bg-purple-600 hover:bg-purple-700 h-9 w-9 p-0"
                >
                  {loadingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
