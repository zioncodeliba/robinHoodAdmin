export type Gender = 'male' | 'female'

export type LoginInput = {
  username: string
  password: string
}

export type RegisterInput = {
  first_name: string
  last_name: string
  gender: Gender
  username: string
  password: string
  mail: string
}

export type LoginResponse = {
  id: string
  access_token: string
  token_type: string
  username: string
  first_name: string
  last_name: string
  gender: Gender
  mail: string
  admin_role?: string
  admin_status?: string
}

export type LoggedUser = {
  id: string
  first_name: string
  last_name: string
  username: string
  gender: Gender
  mail: string
  admin_role?: string
  admin_status?: string
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

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${AUTH_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
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

export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  return request<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function registerUser(input: RegisterInput): Promise<LoggedUser> {
  return request<LoggedUser>('/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
