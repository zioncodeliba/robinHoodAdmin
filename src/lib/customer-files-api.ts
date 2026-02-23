import { getActiveAdminAuth } from '@/lib/auth-storage'

export type CustomerFileItem = {
  id: string
  user_id: string
  original_name: string
  content_type: string
  size_bytes: number
  uploaded_at: string
}

export type AdminSignatureSignerInput = {
  name: string
  idNumber: string
  phone: string
  mail: string
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

export async function deleteCustomerFile(fileId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/customer-files/${fileId}`, {
    method: 'DELETE',
  })
}

export async function uploadCustomerSignatureForUser(
  userId: string,
  sessionId: string,
  file: File,
  signer?: AdminSignatureSignerInput,
): Promise<CustomerFileItem> {
  const formData = new FormData()
  formData.append('session_id', sessionId)
  formData.append('file', file)
  if (signer?.name.trim()) {
    formData.append('borrower_name', signer.name.trim())
  }
  if (signer?.idNumber.trim()) {
    formData.append('borrower_id_number', signer.idNumber.trim())
  }
  if (signer?.phone.trim()) {
    formData.append('borrower_phone', signer.phone.trim())
  }
  if (signer?.mail.trim()) {
    formData.append('borrower_mail', signer.mail.trim())
  }

  const response = await fetch(`${AUTH_BASE}/customer-files/by-user/${userId}/signature`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
    },
    body: formData,
  })

  const payload = await parseJson<CustomerFileItem | { detail?: string }>(response)
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Request failed'))
  }

  if (!payload || !('id' in payload)) {
    throw new Error('Unexpected empty response')
  }

  return payload
}
