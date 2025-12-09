import * as React from "react"
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const ToastContext = React.createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([])

  const addToast = React.useCallback((toast) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { id, ...toast }
    setToasts((prev) => [...prev, newToast])

    // Auto remover após 5 segundos (ou duração customizada)
    setTimeout(() => {
      removeToast(id)
    }, toast.duration || 5000)

    return id
  }, [])

  const removeToast = React.useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const value = React.useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast deve ser usado dentro de ToastProvider")
  }
  return context
}

function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  )
}

function Toast({ toast, removeToast }) {
  const { title, description, variant = "default", id } = toast

  const variants = {
    default: "bg-white border-gray-200 text-gray-900",
    success: "bg-green-50 border-green-200 text-green-900",
    error: "bg-red-50 border-red-200 text-red-900",
    warning: "bg-orange-50 border-orange-200 text-orange-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  }

  const icons = {
    default: Info,
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const Icon = icons[variant] || Info

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-top-5",
        variants[variant]
      )}
      role="alert"
    >
      <Icon className={cn(
        "h-5 w-5 flex-shrink-0 mt-0.5",
        variant === "success" && "text-green-600",
        variant === "error" && "text-red-600",
        variant === "warning" && "text-orange-600",
        variant === "info" && "text-blue-600",
        variant === "default" && "text-gray-600"
      )} />
      <div className="flex-1 min-w-0">
        {title && (
          <div className="font-semibold text-sm mb-1">{title}</div>
        )}
        {description && (
          <div className="text-sm opacity-90">{description}</div>
        )}
      </div>
      <button
        onClick={() => removeToast(id)}
        className="flex-shrink-0 rounded-md p-1 hover:bg-black/5 transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

