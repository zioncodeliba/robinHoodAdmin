import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ContactSubmission, ContactSubmissionStatus } from '@/types'
import { contactSubmissionsSeed } from '@/lib/mock-data'

type NewContactSubmission = Omit<ContactSubmission, 'id' | 'createdAt'>

interface ContactContextType {
  submissions: ContactSubmission[]
  addSubmission: (input: NewContactSubmission) => void
  updateSubmission: (id: string, updates: Partial<ContactSubmission>) => void
  setStatus: (id: string, status: ContactSubmissionStatus) => void
  counts: {
    total: number
    new: number
    inProgress: number
    done: number
  }
}

const ContactContext = createContext<ContactContextType | undefined>(undefined)

export function ContactProvider({ children }: { children: ReactNode }) {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>(contactSubmissionsSeed)

  const addSubmission = useCallback((input: NewContactSubmission) => {
    const id = `c-${Date.now()}`
    const createdAt = new Date().toISOString().slice(0, 10)
    const next: ContactSubmission = { id, createdAt, ...input }
    setSubmissions((prev) => [next, ...prev])
  }, [])

  const updateSubmission = useCallback((id: string, updates: Partial<ContactSubmission>) => {
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }, [])

  const setStatus = useCallback((id: string, status: ContactSubmissionStatus) => {
    updateSubmission(id, { status })
  }, [updateSubmission])

  const counts = useMemo(() => {
    const total = submissions.length
    const n = submissions.filter((s) => s.status === 'חדש').length
    const ip = submissions.filter((s) => s.status === 'בטיפול').length
    const d = submissions.filter((s) => s.status === 'טופל').length
    return { total, new: n, inProgress: ip, done: d }
  }, [submissions])

  return (
    <ContactContext.Provider value={{ submissions, addSubmission, updateSubmission, setStatus, counts }}>
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


