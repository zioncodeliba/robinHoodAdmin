import type { LeadStatus, MortgageType } from '@/types'
import { getStoredAuth } from '@/lib/auth-storage'

export type CustomerCreateInput = {
  first_name: string
  last_name: string
  mail: string
  phone: string
  status: LeadStatus
  mortgage_type: MortgageType
  gender: 'male' | 'female'
}

export type CustomerUpdateInput = Partial<Omit<CustomerCreateInput, 'gender'>> & {
  gender?: never
}

export type CustomerItem = {
  id: string
  first_name: string
  last_name: string
  mail: string
  phone: string
  status: LeadStatus
  mortgage_type: MortgageType
  created_at: string
  last_activity_at: string
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

  const payload = await parseJson<T>(response)
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Request failed'))
  }

  if (payload === null) {
    throw new Error('Unexpected empty response')
  }

  return payload
}

export async function fetchCustomers(): Promise<CustomerItem[]> {
  return request<CustomerItem[]>('/customers')
}

export async function createCustomer(payload: CustomerCreateInput): Promise<CustomerItem> {
  return request<CustomerItem>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateCustomer(userId: string, payload: CustomerUpdateInput): Promise<CustomerItem> {
  return request<CustomerItem>(`/customers/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
