import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useNotifications } from './useNotifications'

/**
 * Hook para gerenciar timeout de sessão
 * Faz logout automático após X minutos de inatividade
 */
export function useSessionTimeout(timeoutMinutes = 30) {
  const { user, logout } = useAuth()
  const { warning } = useNotifications()
  const timeoutRef = useRef(null)
  const warningTimeoutRef = useRef(null)
  const warningShownRef = useRef(false)

  const TIMEOUT_MS = timeoutMinutes * 60 * 1000 // 30 min padrão
  const WARNING_MS = TIMEOUT_MS - (5 * 60 * 1000) // Aviso 5 min antes

  const handleLogout = useCallback(() => {
    warning('Sessão expirada por inatividade. Faça login novamente.')
    logout()
  }, [logout, warning])

  const showWarning = useCallback(() => {
    if (!warningShownRef.current) {
      warningShownRef.current = true
      warning('Sua sessão expirará em 5 minutos. Mova o mouse para continuar.')
    }
  }, [warning])

  const resetTimeout = useCallback(() => {
    // Limpar timeouts anteriores
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    
    warningShownRef.current = false

    // Criar novos timeouts
    warningTimeoutRef.current = setTimeout(showWarning, WARNING_MS)
    timeoutRef.current = setTimeout(handleLogout, TIMEOUT_MS)
  }, [handleLogout, showWarning, TIMEOUT_MS, WARNING_MS])

  useEffect(() => {
    // Só ativar timeout se o usuário estiver logado
    if (!user) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      return
    }

    // Eventos que indicam atividade do usuário
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']

    // Throttle para evitar resetar a cada movimento
    let throttleTimer = null
    const throttledReset = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          resetTimeout()
          throttleTimer = null
        }, 1000) // Reset no máximo a cada 1s
      }
    }

    // Adicionar listeners
    events.forEach(event => {
      window.addEventListener(event, throttledReset, { passive: true })
    })

    // Iniciar timeout
    resetTimeout()

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledReset)
      })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (throttleTimer) clearTimeout(throttleTimer)
    }
  }, [user, resetTimeout])

  return null
}
