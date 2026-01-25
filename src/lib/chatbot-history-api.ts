import { getActiveAdminAuth } from '@/lib/auth-storage'

export type ChatHistoryItem = {
  id: string
  session_id: string
  block_id?: number | null
  block_key: string
  block_message: string
  selected_option_id?: string | null
  option_label?: string | null
  option_type?: 'button' | 'input' | 'scroll' | 'date' | 'attach' | null
  user_input?: string | null
  feedback_status: 'success' | 'warning' | 'error'
  feedback_message: string
  timestamp: string
  prevent_rollback: boolean
  is_active: boolean
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:3000').replace(/\/$/, '')
const CHATBOT_BASE = `${API_BASE}/chatbot/v1`

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CHATBOT_BASE}${path}`, {
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

export async function fetchChatHistoryForUser(userId: string): Promise<ChatHistoryItem[]> {
  return request<ChatHistoryItem[]>(`/session-histories/by-user/${userId}/history-for-chat`)
}
