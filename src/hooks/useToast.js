// Hook simplificado para usar toast
import { useCallback } from 'react'
import { useToast as useToastContext } from '@/components/ui/toast'

export function useToast() {
  const { addToast } = useToastContext()

  const toast = useCallback((options) => {
    return addToast(options)
  }, [addToast])

  const success = useCallback((message, title = 'Sucesso') => {
    return addToast({
      title,
      description: message,
      variant: 'success',
    })
  }, [addToast])

  const error = useCallback((message, title = 'Erro') => {
    return addToast({
      title,
      description: message,
      variant: 'error',
    })
  }, [addToast])

  const warning = useCallback((message, title = 'Atenção') => {
    return addToast({
      title,
      description: message,
      variant: 'warning',
    })
  }, [addToast])

  const info = useCallback((message, title = 'Informação') => {
    return addToast({
      title,
      description: message,
      variant: 'info',
    })
  }, [addToast])

  return {
    toast,
    success,
    error,
    warning,
    info,
  }
}

