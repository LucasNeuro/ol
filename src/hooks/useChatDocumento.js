// ============================================
// HOOK: useChat Documento
// ============================================
// Hook para gerenciar chat com documentos usando Mistral AI

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function useChatDocumento() {
  const [mensagens, setMensagens] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null)
  const [documentoProcessado, setDocumentoProcessado] = useState(null)
  const { user } = useAuth()
  
  // Buscar dados do perfil da empresa
  const buscarDadosEmpresa = useCallback(async () => {
    if (!user?.id) return null
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      if (error) {
        return null
      }
      
      return data
    } catch (err) {
      return null
    }
  }, [user?.id])

  // Processar documento (download + upload para Storage)
  const processarDocumento = useCallback(async (urlDocumento, nomeArquivo, licitacaoId) => {
    setLoading(true)
    setErro(null)

    try {

      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-documento`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            urlDocumento,
            nomeArquivo,
            licitacaoId,
          }),
        }
      )

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar documento')
      }

      setDocumentoProcessado(result.documento)
      
      return result.documento

    } catch (error) {
      setErro(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Enviar pergunta ao documento
  // contextoPagina: { paginaAtual?: number, textoPagina?: string }
  const enviarPergunta = useCallback(async (pergunta, contextoPagina = null) => {
    if (!documentoProcessado) {
      throw new Error('Nenhum documento processado')
    }

    if (!pergunta.trim()) {
      throw new Error('Pergunta não pode estar vazia')
    }

    setLoading(true)
    setErro(null)

    try {

      // Buscar dados da empresa para contexto
      const dadosEmpresa = await buscarDadosEmpresa()

      // Adicionar mensagem do usuário
      const mensagemUsuario = {
        role: 'user',
        content: pergunta,
        timestamp: new Date().toISOString()
      }
      
      setMensagens(prev => [...prev, mensagemUsuario])

      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      // Chamar Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-documento`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            pergunta,
            documentoUrl: documentoProcessado.urlStorage,
            documentoId: documentoProcessado.id,
            dadosEmpresa: dadosEmpresa, // Passar dados da empresa
            historico: mensagens.map(m => ({
              role: m.role,
              content: m.content
            })),
            paginaAtual: contextoPagina?.paginaAtual ?? null,
            textoPagina: contextoPagina?.textoPagina ?? null,
          }),
        }
      )

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar pergunta')
      }


      // Adicionar resposta da IA
      const mensagemIA = {
        role: 'assistant',
        content: result.resposta,
        timestamp: result.timestamp,
        tokens: result.tokens
      }

      setMensagens(prev => [...prev, mensagemIA])

      return result

    } catch (error) {
      setErro(error.message)
      
      // Remover mensagem do usuário em caso de erro
      setMensagens(prev => prev.slice(0, -1))
      
      throw error
    } finally {
      setLoading(false)
    }
  }, [documentoProcessado, mensagens, buscarDadosEmpresa])

  // Limpar conversa
  const limparConversa = useCallback(() => {
    setMensagens([])
    setErro(null)
  }, [])

  // Resetar tudo
  const resetar = useCallback(() => {
    setMensagens([])
    setErro(null)
    setDocumentoProcessado(null)
    setLoading(false)
  }, [])

  return {
    // Estado
    mensagens,
    loading,
    erro,
    documentoProcessado,
    
    // Ações
    processarDocumento,
    enviarPergunta,
    limparConversa,
    resetar,
  }
}










