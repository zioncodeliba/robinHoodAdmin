import { forceLogout, getStoredAuth } from '@/lib/auth-storage'

export type CustomerPaymentItem = {
  id: string
  user_id: string
  amount: number
  affiliate_id?: string | null
  affiliate_name?: string | null
  reference?: string | null
  note?: string | null
  created_at: string
}

export type CustomerPaymentCreateInput = {
  amount: number
  affiliateId?: string
  affiliateName?: string
  reference?: string
  note?: string
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

export async function fetchCustomerPaymentsByUser(userId: string): Promise<CustomerPaymentItem[]> {
  return request<CustomerPaymentItem[]>(`/customer-payments/by-user/${userId}`)
}

export async function createCustomerPaymentForUser(
  userId: string,
  payload: CustomerPaymentCreateInput
): Promise<CustomerPaymentItem> {
  return request<CustomerPaymentItem>(`/customer-payments/by-user/${userId}`, {
    method: 'POST',
    body: JSON.stringify({
      amount: payload.amount,
      affiliate_id: payload.affiliateId,
      affiliate_name: payload.affiliateName,
      reference: payload.reference,
      note: payload.note,
    }),
  })
}

export async function deleteCustomerPayment(paymentId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/customer-payments/${paymentId}`, {
    method: 'DELETE',
  })
}
