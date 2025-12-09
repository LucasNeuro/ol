import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '@/lib/supabase'

// Configurar worker do PDF.js
// Usar a mesma versão instalada (5.4.449) do jsdelivr
const pdfjsVersion = pdfjsLib.version || '5.4.449'
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`

export function VisualizadorDocumento({ 
  open, 
  onOpenChange, 
  urlDocumento, 
  nomeArquivo 
}) {
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPdf, setIsPdf] = useState(true)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [urlLocal, setUrlLocal] = useState(null) // URL do documento no nosso bucket
  const canvasRef = useRef(null)

  useEffect(() => {
    if (open && urlDocumento) {
      setPageNumber(1)
      setLoading(true)
      setError(null)
      
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, urlDocumento, nomeArquivo])

  // Função para baixar e salvar PDF no Supabase Storage usando Edge Function
  const baixarESalvarNoBucket = async () => {
    try {
      console.log('📥 Processando PDF via Edge Function:', urlDocumento)
      
      if (!supabase) {
        throw new Error('Supabase não configurado')
      }
      
      // Obter token de autenticação
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
      
      // Usar Edge Function para baixar e salvar (contorna CORS)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-documento`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            urlDocumento,
            nomeArquivo: nomeArquivo || 'documento.pdf',
            licitacaoId: 'visualizacao', // ID genérico para visualização
          }),
        }
      )
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Erro na Edge Function:', errorText)
        throw new Error(`Erro ao processar documento: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar documento')
      }
      
      console.log('✅ PDF processado e salvo:', result.documento)
      
      // Retornar URL do storage
      return result.documento.urlStorage
    } catch (err) {
      console.error('❌ Erro ao processar PDF via Edge Function:', err)
      throw err
    }
  }

  const carregarPDF = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('📥 Iniciando carregamento de PDF...')
      
      // Primeiro, tentar baixar e salvar no bucket
      let urlParaUsar = urlDocumento
      let tentouBucket = false
      
      try {
        const urlLocalStorage = await baixarESalvarNoBucket()
        urlParaUsar = urlLocalStorage
        setUrlLocal(urlLocalStorage)
        tentouBucket = true
        console.log('✅ PDF salvo no bucket, usando URL local:', urlLocalStorage)
      } catch (bucketError) {
        console.warn('⚠️ Não foi possível salvar no bucket:', bucketError.message)
        tentouBucket = true
        // Se falhou ao baixar, provavelmente é CORS - tentar carregar diretamente
        console.log('🔄 Tentando carregar diretamente da URL original...')
      }
      
      // Agora carregar o PDF usando PDF.js com a URL (local ou original)
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: urlParaUsar,
          withCredentials: false,
          httpHeaders: {},
          verbosity: 0 // Reduzir logs
        })
        
        const pdfData = await loadingTask.promise
        
        console.log('✅ PDF carregado:', pdfData.numPages, 'páginas')
        
        setPdfDoc(pdfData)
        setNumPages(pdfData.numPages)
        setPageNumber(1)
        setLoading(false)
      } catch (pdfError) {
        console.error('❌ Erro ao carregar PDF com PDF.js:', pdfError)
        
        // Se tentou bucket e falhou, e agora PDF.js também falhou, é provavelmente CORS
        if (tentouBucket) {
          throw new Error('Não foi possível carregar o documento. O servidor bloqueia o acesso devido a restrições de segurança (CORS). Clique em "Abrir em nova aba" para visualizar.')
        }
        
        throw pdfError
      }
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
  }, [pdfDoc, pageNumber])

  const renderizarPagina = async () => {
    if (!pdfDoc || !canvasRef.current) return

    try {
      const page = await pdfDoc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.5 })
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      
      await page.render(renderContext).promise
      console.log('✅ Página renderizada:', pageNumber)
    } catch (err) {
      console.error('❌ Erro ao renderizar página:', err)
      setError('Erro ao renderizar página do documento')
    }
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(numPages || 1, prev + 1))
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
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 bg-black/80 backdrop-blur-sm border-none">
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
            {/* Controles de navegação */}
            {isPdf && numPages && numPages > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevPage}
                  disabled={pageNumber === 1}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
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
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
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
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Conteúdo do Documento */}
        <div className="w-full h-full pt-14 pb-4 flex items-center justify-center overflow-auto bg-gray-900">
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
            <div className="w-full h-full flex items-center justify-center p-4">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full shadow-2xl bg-white rounded"
                style={{ maxHeight: 'calc(100vh - 80px)' }}
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
      </DialogContent>
    </Dialog>
  )
}
