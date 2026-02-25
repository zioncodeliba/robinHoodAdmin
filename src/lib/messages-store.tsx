import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { MessageTemplate, MessageTemplateTrigger } from '@/types'
import {
  createMessageTemplate,
  deleteMessageTemplate,
  fetchMessageTemplates,
  updateMessageTemplate,
  type MessageTemplateCreateInput,
  type MessageTemplateItem,
  type MessageTemplateUpdateInput,
} from '@/lib/message-templates-api'

type NewTemplateInput = {
  name: string
  trigger: MessageTemplateTrigger
  message: string
}

interface MessagesContextType {
  templates: MessageTemplate[]
  loading: boolean
  refreshTemplates: () => Promise<void>
  addTemplate: (input: NewTemplateInput) => Promise<MessageTemplate>
  updateTemplate: (id: string, updates: Partial<MessageTemplate>) => Promise<MessageTemplate>
  deleteTemplate: (id: string) => Promise<void>
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined)

const mapTemplate = (item: MessageTemplateItem): MessageTemplate => ({
  id: item.id,
  name: item.name,
  trigger: item.trigger,
  message: item.message,
  createdAt: item.created_at,
})

const toCreatePayload = (input: NewTemplateInput): MessageTemplateCreateInput => ({
  name: input.name.trim(),
  trigger: input.trigger,
  message: input.message.trim(),
})

const toUpdatePayload = (updates: Partial<MessageTemplate>): MessageTemplateUpdateInput => {
  const payload: MessageTemplateUpdateInput = {}
  if (updates.name !== undefined) payload.name = updates.name.trim()
  if (updates.trigger !== undefined) payload.trigger = updates.trigger
  if (updates.message !== undefined) payload.message = updates.message.trim()
  return payload
}

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const refreshTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchMessageTemplates()
      setTemplates(data.map(mapTemplate))
    } catch (error) {
      setTemplates([])
      toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת תבניות הודעות')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshTemplates()
  }, [refreshTemplates])

  const addTemplate = useCallback(async (input: NewTemplateInput) => {
    const created = await createMessageTemplate(toCreatePayload(input))
    const mapped = mapTemplate(created)
    setTemplates((prev) => [mapped, ...prev])
    return mapped
  }, [])

  const updateTemplateById = useCallback(async (id: string, updates: Partial<MessageTemplate>) => {
    const payload = toUpdatePayload(updates)
    if (Object.keys(payload).length === 0) {
      const existing = templates.find((t) => t.id === id)
      if (!existing) {
        throw new Error('Message template not found')
      }
      return existing
    }
    const updated = await updateMessageTemplate(id, payload)
    const mapped = mapTemplate(updated)
    setTemplates((prev) => prev.map((t) => (t.id === id ? mapped : t)))
    return mapped
  }, [templates])

  const deleteTemplateById = useCallback(async (id: string) => {
    await deleteMessageTemplate(id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <MessagesContext.Provider
      value={{
        templates,
        loading,
        refreshTemplates,
        addTemplate,
        updateTemplate: updateTemplateById,
        deleteTemplate: deleteTemplateById,
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
