import { getActiveAdminAuth } from '@/lib/auth-storage'

export type CustomerFileItem = {
  id: string
  user_id: string
  original_name: string
  content_type: string
  size_bytes: number
  uploaded_at: string
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
  const auth = getActiveAdminAuth()
  if (!auth?.accessToken) {
    throw new Error('Missing auth token')
  }
  return { Authorization: `${auth.tokenType} ${auth.accessToken}` }
}

function getFilenameFromHeader(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback
  const match = /filename\*?=(?:UTF-8''|\"?)([^\";]+)/i.exec(contentDisposition)
  if (!match?.[1]) return fallback
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
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

  const payload = await parseJson<T>(response)
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Request failed'))
  }

  if (payload === null) {
    throw new Error('Unexpected empty response')
  }

  return payload
}

export async function fetchCustomerFiles(userId: string): Promise<CustomerFileItem[]> {
  return request<CustomerFileItem[]>(`/customer-files/by-user/${userId}`)
}

export async function downloadCustomerFile(fileId: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${AUTH_BASE}/customer-files/${fileId}`, {
    headers: {
      ...getAuthHeader(),
    },
  })

  if (!response.ok) {
    const payload = await parseJson<{ detail?: string }>(response)
    throw new Error(getErrorMessage(payload, 'Request failed'))
  }

  const blob = await response.blob()
  const filename = getFilenameFromHeader(response.headers.get('content-disposition'), 'file')
  return { blob, filename }
}
