import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-left"
      richColors
      closeButton
      dir="rtl"
      toastOptions={{
        style: {
          fontFamily: "'Noto Sans Hebrew','Assistant',system-ui,sans-serif",
        },
      }}
    />
  )
}


