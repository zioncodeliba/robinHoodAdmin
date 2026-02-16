import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { ContactSubmission, ContactSubmissionStatus } from '@/types'
import {
  createContactSubmission,
  deleteContactSubmission as deleteContactSubmissionApi,
  fetchContactSubmissions,
  updateContactSubmission,
  type ContactSubmissionCreateInput,
  type ContactSubmissionItem,
  type ContactSubmissionUpdateInput,
} from '@/lib/contact-api'

type NewContactSubmission = Omit<ContactSubmission, 'id' | 'createdAt'>
type ContactSubmissionPatch = Partial<NewContactSubmission>

const mapSubmission = (item: ContactSubmissionItem): ContactSubmission => ({
  id: item.id,
  fullName: item.full_name,
  phone: item.phone,
  email: item.email,
  message: item.message,
  status: item.status,
  source: item.source ?? undefined,
  createdAt: item.created_at,
})

const toCreatePayload = (input: NewContactSubmission): ContactSubmissionCreateInput => ({
  full_name: input.fullName.trim(),
  phone: input.phone.trim(),
  email: input.email.trim(),
  message: input.message.trim(),
  status: input.status,
  source: input.source?.trim() || undefined,
})

const toUpdatePayload = (updates: ContactSubmissionPatch): ContactSubmissionUpdateInput => {
  const payload: ContactSubmissionUpdateInput = {}
  if (updates.fullName !== undefined) payload.full_name = updates.fullName.trim()
  if (updates.phone !== undefined) payload.phone = updates.phone.trim()
  if (updates.email !== undefined) payload.email = updates.email.trim()
  if (updates.message !== undefined) payload.message = updates.message.trim()
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.source !== undefined) payload.source = updates.source.trim()
  return payload
}

interface ContactContextType {
  submissions: ContactSubmission[]
  loading: boolean
  refreshSubmissions: () => Promise<void>
  addSubmission: (input: NewContactSubmission) => Promise<ContactSubmission>
  updateSubmission: (id: string, updates: ContactSubmissionPatch) => Promise<ContactSubmission>
  deleteSubmission: (id: string) => Promise<void>
  setStatus: (id: string, status: ContactSubmissionStatus) => Promise<ContactSubmission>
  counts: {
    total: number
    new: number
    inProgress: number
    done: number
  }
}

const ContactContext = createContext<ContactContextType | undefined>(undefined)

export function ContactProvider({ children }: { children: ReactNode }) {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([])
  const [loading, setLoading] = useState(true)

  const refreshSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchContactSubmissions()
      setSubmissions(data.map(mapSubmission))
    } catch (error) {
      setSubmissions([])
      toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת הפניות')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSubmissions()
  }, [refreshSubmissions])

  const addSubmission = useCallback(async (input: NewContactSubmission) => {
    const created = await createContactSubmission(toCreatePayload(input))
    const mapped = mapSubmission(created)
    setSubmissions((prev) => [mapped, ...prev])
    return mapped
  }, [])

  const updateSubmission = useCallback(async (id: string, updates: ContactSubmissionPatch) => {
    const payload = toUpdatePayload(updates)
    if (Object.keys(payload).length === 0) {
      const existing = submissions.find((s) => s.id === id)
      if (!existing) {
        throw new Error('Contact submission not found')
      }
      return existing
    }
    const updated = await updateContactSubmission(id, payload)
    const mapped = mapSubmission(updated)
    setSubmissions((prev) => prev.map((s) => (s.id === id ? mapped : s)))
    return mapped
  }, [submissions])

  const deleteSubmission = useCallback(async (id: string) => {
    await deleteContactSubmissionApi(id)
    setSubmissions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const setStatus = useCallback((id: string, status: ContactSubmissionStatus) => {
    return updateSubmission(id, { status })
  }, [updateSubmission])

  const counts = useMemo(() => {
    const total = submissions.length
    const n = submissions.filter((s) => s.status === 'חדש').length
    const ip = submissions.filter((s) => s.status === 'בטיפול').length
    const d = submissions.filter((s) => s.status === 'טופל').length
    return { total, new: n, inProgress: ip, done: d }
  }, [submissions])

  return (
    <ContactContext.Provider
      value={{ submissions, loading, refreshSubmissions, addSubmission, updateSubmission, deleteSubmission, setStatus, counts }}
    >
      {children}
    </ContactContext.Provider>
  )
}

export function useContact() {
  const ctx = useContext(ContactContext)
  if (!ctx) throw new Error('useContact must be used within a ContactProvider')
  return ctx
}

export function useContactById(id: string | undefined) {
  const { submissions } = useContact()
  return useMemo(() => submissions.find((s) => s.id === id) ?? null, [submissions, id])
}

