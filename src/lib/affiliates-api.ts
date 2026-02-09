import { forceLogout, getStoredAuth } from '@/lib/auth-storage'
import type { AffiliateStatus } from '@/types'

export type AffiliateCreateInput = {
  first_name: string
  last_name: string
  status: AffiliateStatus
  code?: string
  email?: string
  phone?: string
  address?: string
  internal_notes?: string
  beneficiary_name?: string
  bank_name?: string
  branch_number?: string
  account_number?: string
  iban?: string
  swift?: string
}

export type AffiliateItem = {
  id: string
  code: string
  status: AffiliateStatus
  first_name: string
  last_name: string
  email?: string
  phone?: string
  address?: string
  internal_notes?: string
  beneficiary_name?: string
  bank_name?: string
  branch_number?: string
  account_number?: string
  iban?: string
  swift?: string
  clicks: number
  conversions: number
  withdrawal_requested: boolean
  created_at: string
  updated_at: string
}

export type AffiliateUpdateInput = Partial<AffiliateCreateInput> & {
  withdrawal_requested?: boolean
  clicks?: number
  conversions?: number
}

export type AffiliateDeleteResponse = {
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

export async function fetchAffiliates(): Promise<AffiliateItem[]> {
  return request<AffiliateItem[]>('/affiliates')
}

export async function createAffiliate(payload: AffiliateCreateInput): Promise<AffiliateItem> {
  return request<AffiliateItem>('/affiliates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAffiliate(
  affiliateId: string,
  payload: AffiliateUpdateInput
): Promise<AffiliateItem> {
  return request<AffiliateItem>(`/affiliates/${affiliateId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAffiliate(affiliateId: string): Promise<AffiliateDeleteResponse> {
  return request<AffiliateDeleteResponse>(`/affiliates/${affiliateId}`, {
    method: 'DELETE',
  })
}
