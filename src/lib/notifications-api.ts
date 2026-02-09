import { forceLogout, getStoredAuth } from '@/lib/auth-storage'

export type NotificationCreateInput = {
  message: string
  templateId?: string
  templateName?: string
}

export type NotificationItem = {
  id: string
  user_id: string
  message: string
  sent_at: string
  read_at?: string | null
  template_id?: string | null
  template_name?: string | null
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

export async function fetchNotificationsByUser(userId: string): Promise<NotificationItem[]> {
  return request<NotificationItem[]>(`/notifications/by-user/${userId}`)
}

export async function createNotificationForUser(
  userId: string,
  payload: NotificationCreateInput
): Promise<NotificationItem> {
  return request<NotificationItem>(`/notifications/by-user/${userId}`, {
    method: 'POST',
    body: JSON.stringify({
      message: payload.message,
      template_id: payload.templateId,
      template_name: payload.templateName,
    }),
  })
}

export async function deleteNotification(notificationId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/notifications/${notificationId}`, {
    method: 'DELETE',
  })
}
