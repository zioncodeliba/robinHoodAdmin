import { forceLogout, getStoredAuth } from '@/lib/auth-storage'
import type { ContactSubmissionStatus } from '@/types'

export type ContactSubmissionItem = {
  id: string
  full_name: string
  phone: string
  email: string
  message: string
  status: ContactSubmissionStatus
  source?: string | null
  created_at: string
  updated_at: string
}

export type ContactSubmissionCreateInput = {
  full_name: string
  phone: string
  email: string
  message: string
  status: ContactSubmissionStatus
  source?: string
}

export type ContactSubmissionUpdateInput = Partial<ContactSubmissionCreateInput>

export type ContactSubmissionDeleteResponse = {
  message: string
  id: string
  deleted: boolean
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:3000').replace(/\/$/, '')
const AUTH_BASE = `${API_BASE}/auth/v1`

async function parseJson<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return null
  }
  return (await response.json()) as T
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: string }).detail
    if (detail && detail.trim()) {
      return detail
    }
  }
  return fallback
}

function getAuthHeader() {
  const auth = getStoredAuth()
  if (!auth?.accessToken) {
    throw new Error('Missing auth token')
  }
  return { Authorization: `${auth.tokenType} ${auth.accessToken}` }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AUTH_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...getAuthHeader(),
    },
  })
  if (response.status === 401 || response.status === 403) {
    forceLogout()
    throw new Error('Session expired')
  }

  const payload = await parseJson<T>(response)
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Request failed'))
  }

  if (payload === null) {
    throw new Error('Unexpected empty response')
  }

  return payload
}

export async function fetchContactSubmissions(): Promise<ContactSubmissionItem[]> {
  return request<ContactSubmissionItem[]>('/contact-submissions')
}

export async function createContactSubmission(payload: ContactSubmissionCreateInput): Promise<ContactSubmissionItem> {
  return request<ContactSubmissionItem>('/contact-submissions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateContactSubmission(
  submissionId: string,
  payload: ContactSubmissionUpdateInput
): Promise<ContactSubmissionItem> {
  return request<ContactSubmissionItem>(`/contact-submissions/${submissionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteContactSubmission(submissionId: string): Promise<ContactSubmissionDeleteResponse> {
  return request<ContactSubmissionDeleteResponse>(`/contact-submissions/${submissionId}`, {
    method: 'DELETE',
  })
}
