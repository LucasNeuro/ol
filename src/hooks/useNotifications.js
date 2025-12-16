// ============================================
// HOOK: useNotifications
// ============================================
// Hook customizado para substituir alert() e confirm() do JavaScript
// Usa o sistema de Toast e ConfirmDialog da aplicação

import { useToast } from '@/components/ui/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'

export function useNotifications() {
  const { addToast } = useToast()
  const confirm = useConfirm()

  // Substitui alert() - mostra uma notificação
  const showAlert = (message, type = 'info') => {
    const variants = {
      success: { variant: 'success', title: 'Sucesso' },
      error: { variant: 'error', title: 'Erro' },
      warning: { variant: 'warning', title: 'Atenção' },
      info: { variant: 'info', title: 'Informação' },
    }

    const config = variants[type] || variants.info

    addToast({
      title: config.title,
      description: message,
      variant: config.variant,
      duration: type === 'error' ? 6000 : 5000, // Erros ficam mais tempo
    })
  }

  // Substitui confirm() - mostra um diálogo de confirmação
  const showConfirm = async (message, options = {}) => {
    return await confirm({
      title: options.title || 'Confirmar ação',
      message: message,
      description: options.description,
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      variant: options.variant || 'default', // 'default' ou 'destructive'
    })
  }

  // Métodos de conveniência
  const success = (message) => showAlert(message, 'success')
  const error = (message) => showAlert(message, 'error')
  const warning = (message) => showAlert(message, 'warning')
  const info = (message) => showAlert(message, 'info')

  return {
    alert: showAlert,
    confirm: showConfirm,
    success,
    error,
    warning,
    info,
  }
}








