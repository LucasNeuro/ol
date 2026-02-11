import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/**
 * Hook para gerenciar rate limiting de envios WhatsApp
 * Limites padrão: 10 envios por hora, 50 por dia
 */
export function useWhatsAppRateLimit() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const LIMITE_POR_HORA = 10
  const LIMITE_POR_DIA = 50

  /**
   * Verifica se usuário pode enviar WhatsApp
   * @returns {Promise<{canSend: boolean, remaining: number, resetIn: number, error?: string}>}
   */
  const checkRateLimit = useCallback(async () => {
    if (!user || !supabase) {
      return { canSend: false, remaining: 0, resetIn: 0, error: 'Usuário não autenticado' }
    }

    setLoading(true)
    try {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // Buscar envios da última hora
      const { data: enviosHora, error: errorHora } = await supabase
        .from('whatsapp_rate_limit')
        .select('id, timestamp')
        .eq('user_id', user.id)
        .eq('status', 'success')
        .gte('timestamp', oneHourAgo.toISOString())

      if (errorHora) throw errorHora

      const countHora = enviosHora?.length || 0

      // Se excedeu limite por hora
      if (countHora >= LIMITE_POR_HORA) {
        const oldestInHour = enviosHora.sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        )[0]
        const resetIn = Math.ceil((new Date(oldestInHour.timestamp).getTime() + 60 * 60 * 1000 - now.getTime()) / 1000 / 60)
        
        return {
          canSend: false,
          remaining: 0,
          resetIn,
          error: `Limite de ${LIMITE_POR_HORA} envios por hora atingido. Tente novamente em ${resetIn} minutos.`
        }
      }

      // Buscar envios do último dia
      const { data: enviosDia, error: errorDia } = await supabase
        .from('whatsapp_rate_limit')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'success')
        .gte('timestamp', oneDayAgo.toISOString())

      if (errorDia) throw errorDia

      const countDia = enviosDia?.length || 0

      // Se excedeu limite por dia
      if (countDia >= LIMITE_POR_DIA) {
        return {
          canSend: false,
          remaining: 0,
          resetIn: 0,
          error: `Limite de ${LIMITE_POR_DIA} envios por dia atingido. Tente novamente amanhã.`
        }
      }

      return {
        canSend: true,
        remaining: LIMITE_POR_HORA - countHora,
        resetIn: 0
      }
    } catch (error) {
      console.error('Erro ao verificar rate limit:', error)
      // Se erro ao verificar (ex: tabela não existe), permitir envio mas avisar
      // Melhor permitir envio do que bloquear usuário por erro técnico
      const errorMsg = error?.message || ''
      const isTableMissing = errorMsg.includes('relation') || errorMsg.includes('does not exist') || errorMsg.includes('not found')
      
      if (isTableMissing) {
        console.warn('⚠️ Tabela whatsapp_rate_limit não existe. Rate limiting desabilitado.')
      }
      
      return {
        canSend: true, // Permitir envio mesmo com erro (fail-open)
        remaining: LIMITE_POR_HORA,
        resetIn: 0,
        warning: isTableMissing 
          ? 'Rate limiting não configurado. Configure a tabela para ativar.'
          : 'Não foi possível verificar limite. Envio permitido.'
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  /**
   * Registra um envio de WhatsApp
   * @param {string} telefone - Número de destino
   * @param {string} licitacaoId - ID da licitação
   * @param {string} status - Status do envio (success, failed, blocked)
   */
  const registerSend = useCallback(async (telefone, licitacaoId = null, status = 'success') => {
    if (!user || !supabase) return

    try {
      const { error } = await supabase
        .from('whatsapp_rate_limit')
        .insert({
          user_id: user.id,
          telefone_destino: telefone,
          licitacao_id: licitacaoId,
          status,
          timestamp: new Date().toISOString()
        })

      if (error) throw error
    } catch (error) {
      console.error('Erro ao registrar envio:', error)
    }
  }, [user])

  /**
   * Obtém histórico de envios do usuário
   * @param {number} limit - Limite de registros
   */
  const getHistory = useCallback(async (limit = 50) => {
    if (!user || !supabase) return []

    try {
      const { data, error } = await supabase
        .from('whatsapp_rate_limit')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erro ao buscar histórico:', error)
      return []
    }
  }, [user])

  return {
    checkRateLimit,
    registerSend,
    getHistory,
    loading,
    LIMITE_POR_HORA,
    LIMITE_POR_DIA
  }
}
