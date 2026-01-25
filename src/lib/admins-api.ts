import { getStoredAuth } from '@/lib/auth-storage'
import { registerUser, type Gender, type LoggedUser } from '@/lib/auth-api'

type UserDetails = {
  id: string
  first_name: string
  last_name: string
  username: string
  gender: Gender
  mail: string
  created_at: string
  admin_role?: string
  admin_status?: string
}

export type AdminUser = {
  id: string
  name: string
  email: string
  username: string
  createdAt: string
  status?: string
}

export type AdminCreateInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  gender: Gender
  username?: string
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

export async function fetchAdmins(): Promise<AdminUser[]> {
  const users = await request<UserDetails[]>('/users')
  return users
    .filter((user) => Boolean(user.admin_role))
    .map((user) => ({
      id: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username,
      email: user.mail,
      username: user.username,
      createdAt: user.created_at,
      status: user.admin_status ?? undefined,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createAdmin(input: AdminCreateInput): Promise<LoggedUser> {
  const username = input.username?.trim() || input.email.trim()
  return registerUser({
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    username,
    password: input.password,
    gender: input.gender,
    mail: input.email.trim(),
  })
}

export async function removeAdmin(userId: string): Promise<void> {
  await request(`/users/${userId}/admin`, { method: 'DELETE' })
}
