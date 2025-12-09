// ============================================
// COMPONENTE: Chat com Documento (IA)
// ============================================
// Sideover para conversar com documentos PDF usando Mistral AI

import { useState, useRef, useEffect } from 'react'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  AlertCircle, 
  Sparkles,
  Copy,
  Download,
  Trash2,
  FileText
} from 'lucide-react'
import { useChatDocumento } from '@/hooks/useChatDocumento'

export function ChatDocumento({ 
  aberto, 
  onFechar, 
  documento,
  licitacaoId 
}) {
  const [pergunta, setPergunta] = useState('')
  const [processando, setProcessando] = useState(false)
  const messagesEndRef = useRef(null)
  
  const {
    mensagens,
    loading,
    erro,
    documentoProcessado,
    processarDocumento,
    enviarPergunta,
    limparConversa,
    resetar
  } = useChatDocumento()

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Processar documento quando abre o chat
  useEffect(() => {
    if (aberto && documento && !documentoProcessado && !processando) {
      handleProcessarDocumento()
    }
  }, [aberto, documento])

  const handleProcessarDocumento = async () => {
    if (!documento) return
    
    setProcessando(true)
    try {
      await processarDocumento(
        documento.url,
        documento.nome || documento.nomeArquivo || 'documento.pdf',
        licitacaoId
      )
    } catch (error) {
      console.error('Erro ao processar:', error)
    } finally {
      setProcessando(false)
    }
  }

  const handleEnviarPergunta = async (e) => {
    e?.preventDefault()
    
    if (!pergunta.trim() || loading) return
    
    const perguntaAtual = pergunta
    setPergunta('')
    
    try {
      await enviarPergunta(perguntaAtual)
    } catch (error) {
      // Erro já tratado no hook
      setPergunta(perguntaAtual) // Restaurar pergunta em caso de erro
    }
  }

  const handleFechar = () => {
    resetar()
    onFechar()
  }

  const copiarResposta = (texto) => {
    navigator.clipboard.writeText(texto)
    // TODO: Mostrar toast de sucesso
  }

  const perguntasSugeridas = [
    "Qual o objeto desta licitação?",
    "Quais são os requisitos para participar?",
    "Qual o prazo de entrega?",
    "Quais documentos são obrigatórios?",
    "Há restrições geográficas?",
    "Resuma os pontos principais"
  ]

  return (
    <Sheet open={aberto} onOpenChange={handleFechar}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-xl flex items-center gap-2">
                Chat com Documento
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  IA
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-sm">
                {documentoProcessado ? (
                  <span className="flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    {documentoProcessado.nome}
                  </span>
                ) : processando ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processando documento...
                  </span>
                ) : (
                  'Aguardando documento...'
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Área de Mensagens */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Estado Inicial */}
          {mensagens.length === 0 && !processando && documentoProcessado && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Faça uma pergunta sobre o documento
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Pergunte qualquer coisa sobre o conteúdo do edital
              </p>
              
              {/* Perguntas Sugeridas */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 mb-3">
                  Sugestões de perguntas:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {perguntasSugeridas.map((sugestao, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPergunta(sugestao)
                        // Auto-enviar após um pequeno delay
                        setTimeout(() => {
                          handleEnviarPergunta()
                        }, 100)
                      }}
                      className="text-left p-3 text-sm bg-gray-50 hover:bg-purple-50 hover:text-purple-700 rounded-lg transition-colors border border-gray-200 hover:border-purple-300"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Processando Documento */}
          {processando && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Processando documento...</p>
              <p className="text-sm text-gray-500 mt-2">
                Isso pode levar alguns segundos
              </p>
            </div>
          )}

          {/* Erro ao Processar */}
          {erro && !processando && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-900">Erro ao processar</p>
                <p className="text-sm text-red-700 mt-1">{erro}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleProcessarDocumento}
                disabled={processando}
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Mensagens */}
          {mensagens.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-900 border border-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
                
                {/* Botão de copiar (apenas para respostas da IA) */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-300">
                    <button
                      onClick={() => copiarResposta(msg.content)}
                      className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar
                    </button>
                    {msg.tokens && (
                      <span className="text-xs text-gray-500 ml-auto">
                        {msg.tokens.total} tokens
                      </span>
                    )}
                  </div>
                )}
                
                <p className="text-xs opacity-70 mt-2">
                  {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))}

          {/* Loading de nova mensagem */}
          {loading && mensagens.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span className="text-sm text-gray-600">Pensando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input de Pergunta */}
        <div className="px-6 py-4 border-t bg-white">
          {/* Botões de Ação */}
          {mensagens.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={limparConversa}
                className="text-gray-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar conversa
              </Button>
            </div>
          )}
          
          <form onSubmit={handleEnviarPergunta} className="flex gap-2">
            <Input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Digite sua pergunta..."
              disabled={loading || !documentoProcessado || processando}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleEnviarPergunta()
                }
              }}
            />
            <Button
              type="submit"
              disabled={!pergunta.trim() || loading || !documentoProcessado || processando}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          
          <p className="text-xs text-gray-500 mt-2 text-center">
            Powered by <strong>Mistral AI</strong>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

