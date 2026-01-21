import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { MessageTemplate, LeadStatus } from '@/types'

type NewTemplateInput = {
  name: string
  trigger: LeadStatus
  message: string
}

interface MessagesContextType {
  templates: MessageTemplate[]
  addTemplate: (input: NewTemplateInput) => void
  updateTemplate: (id: string, updates: Partial<MessageTemplate>) => void
  deleteTemplate: (id: string) => void
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined)

// Initial mock templates
const initialTemplates: MessageTemplate[] = [
  {
    id: 'tpl-1',
    name: 'אישור עקרוני התקבל',
    trigger: 'אישור עקרוני',
    message: 'שלום {שם}, קיבלנו אישור עקרוני עבורך! נציג יצור איתך קשר בהקדם להמשך התהליך.',
    createdAt: '2025-01-01',
  },
  {
    id: 'tpl-2',
    name: 'זימון לשיחת תמהיל',
    trigger: 'שיחת תמהיל',
    message: 'שלום {שם}, אנחנו מזמינים אותך לשיחת תמהיל לקביעת פרטי המשכנתא. אנא צור קשר לתיאום מועד.',
    createdAt: '2025-01-02',
  },
  {
    id: 'tpl-3',
    name: 'הודעה על חתימות',
    trigger: 'חתימות',
    message: 'שלום {שם}, המסמכים מוכנים לחתימה! אנא התקשר אלינו לתיאום מועד לחתימה על המסמכים.',
    createdAt: '2025-01-03',
  },
]

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<MessageTemplate[]>(initialTemplates)

  const addTemplate = useCallback((input: NewTemplateInput) => {
    const now = new Date()
    const createdAt = now.toISOString().slice(0, 10)
    const id = `tpl-${Date.now()}`
    const next: MessageTemplate = {
      id,
      name: input.name,
      trigger: input.trigger,
      message: input.message,
      createdAt,
    }
    setTemplates((prev) => [next, ...prev])
  }, [])

  const updateTemplate = useCallback((id: string, updates: Partial<MessageTemplate>) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }, [])

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <MessagesContext.Provider
      value={{
        templates,
        addTemplate,
        updateTemplate,
        deleteTemplate,
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}

export function useMessages() {
  const ctx = useContext(MessagesContext)
  if (!ctx) throw new Error('useMessages must be used within a MessagesProvider')
  return ctx
}

