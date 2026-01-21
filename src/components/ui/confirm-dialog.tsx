import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { AnimatedIcon } from '@/components/ui/animated-icon'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'אישור פעולה',
  description = 'האם אתה בטוח שברצונך לבצע פעולה זו?',
  confirmText = 'אישור',
  cancelText = 'ביטול',
  variant = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex flex-row-reverse items-center gap-3">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
              variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              <AnimatedIcon 
                icon={AlertTriangle} 
                size={20} 
                variant="pulse" 
                className={variant === 'danger' ? 'text-red-600' : 'text-amber-600'} 
              />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="mt-2">{description}</DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'accent'}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className="w-full sm:w-auto"
          >
            {confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook for easier usage
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean
    title: string
    description: string
    confirmText: string
    variant: 'danger' | 'warning'
    onConfirm: () => void
  }>({
    open: false,
    title: '',
    description: '',
    confirmText: '',
    variant: 'danger',
    onConfirm: () => {},
  })

  const confirm = React.useCallback(
    (options: {
      title?: string
      description?: string
      confirmText?: string
      variant?: 'danger' | 'warning'
      onConfirm: () => void
    }) => {
      setState({
        open: true,
        title: options.title ?? 'אישור מחיקה',
        description: options.description ?? 'האם אתה בטוח שברצונך למחוק? פעולה זו אינה ניתנת לביטול.',
        confirmText: options.confirmText ?? 'מחיקה',
        variant: options.variant ?? 'danger',
        onConfirm: options.onConfirm,
      })
    },
    []
  )

  const dialogProps = {
    open: state.open,
    onOpenChange: (open: boolean) => setState((s) => ({ ...s, open })),
    title: state.title,
    description: state.description,
    confirmText: state.confirmText,
    variant: state.variant,
    onConfirm: state.onConfirm,
  }

  return { confirm, dialogProps, ConfirmDialog }
}



