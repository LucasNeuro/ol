import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const ConfirmDialogContext = React.createContext()

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = React.useState(null)

  const confirm = React.useCallback((options) => {
    return new Promise((resolve) => {
      setDialog({
        ...options,
        onConfirm: () => {
          setDialog(null)
          resolve(true)
        },
        onCancel: () => {
          setDialog(null)
          resolve(false)
        },
      })
    })
  }, [])

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <Dialog open={!!dialog} onOpenChange={(open) => !open && dialog.onCancel()}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">
                    {dialog.title || 'Confirmar ação'}
                  </DialogTitle>
                  {dialog.description && (
                    <DialogDescription className="mt-1">
                      {dialog.description}
                    </DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600">
                {dialog.message || 'Tem certeza que deseja continuar?'}
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={dialog.onCancel}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant={dialog.variant === 'destructive' ? 'destructive' : 'default'}
                onClick={dialog.onConfirm}
                className="flex-1"
              >
                {dialog.confirmText || 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirm() {
  const context = React.useContext(ConfirmDialogContext)
  if (!context) {
    throw new Error("useConfirm deve ser usado dentro de ConfirmDialogProvider")
  }
  return context.confirm
}

