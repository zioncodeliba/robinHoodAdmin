import type { LoginResponse } from '@/lib/auth-api'

export type StoredAuth = {
  accessToken: string
  tokenType: string
  user: {
    id: string
    username: string
    firstName: string
    lastName: string
    gender: LoginResponse['gender']
    mail: string
    role?: string
    status?: string
  }
}

const STORAGE_KEY = 'robin_admin_auth'

export function storeAuth(payload: LoginResponse): StoredAuth {
  const data: StoredAuth = {
    accessToken: payload.access_token,
    tokenType: payload.token_type,
    user: {
      id: payload.id,
      username: payload.username,
      firstName: payload.first_name,
      lastName: payload.last_name,
      gender: payload.gender,
      mail: payload.mail,
      role: payload.admin_role,
      status: payload.admin_status,
    },
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}

export function getStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

export function updateStoredUser(patch: Partial<StoredAuth['user']>): StoredAuth | null {
  const auth = getStoredAuth()
  if (!auth) {
    return null
  }
  const next: StoredAuth = {
    ...auth,
    user: {
      ...auth.user,
      ...patch,
    },
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function isActiveAdminAuth(auth: StoredAuth | null): boolean {
  return Boolean(auth?.accessToken && auth.user.role && auth.user.status === 'active')
}

export function getActiveAdminAuth(): StoredAuth | null {
  const auth = getStoredAuth()
  return isActiveAdminAuth(auth) ? auth : null
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

export function forceLogout() {
  clearAuth()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}
