/**
 * Hook para verificar alertas periodicamente
 * Pode ser usado em qualquer componente
 */

import { useEffect, useRef } from 'react'
import { verificarAlerta, iniciarVerificacaoPeriodica, pararVerificacaoPeriodica } from '@/lib/verificarAlertas'

/**
 * Hook para verificar alertas automaticamente
 * @param {Object} options - Opções de configuração
 * @param {number} options.intervaloMinutos - Intervalo em minutos (padrão: 5)
 * @param {boolean} options.ativo - Se deve rodar automaticamente (padrão: true)
 * @param {string|null} options.alertaId - ID específico do alerta para verificar (opcional)
 */
export function useVerificarAlertas({ 
  intervaloMinutos = 5, 
  ativo = true,
  alertaId = null 
} = {}) {
  const intervalIdRef = useRef(null)

  useEffect(() => {
    if (!ativo) {
      return
    }

    // Iniciar verificação periódica
    intervalIdRef.current = iniciarVerificacaoPeriodica(intervaloMinutos)

    // Limpar ao desmontar
    return () => {
      if (intervalIdRef.current) {
        pararVerificacaoPeriodica(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [ativo, intervaloMinutos])

  // Função para verificar manualmente
  const verificarManual = async () => {
    return await verificarAlerta(alertaId)
  }

  return {
    verificarManual,
  }
}

