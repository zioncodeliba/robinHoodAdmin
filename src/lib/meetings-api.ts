import { getActiveAdminAuth } from '@/lib/auth-storage'
import type { MeetingStatus } from '@/types'

export type MeetingItem = {
  id: string
  user_id: string
  session_id?: string | null
  title: string
  start_at: string
  end_at: string
  status: MeetingStatus
  notes?: string | null
}

export type MeetingCreateInput = {
  user_id: string
  session_id?: string | null
  title: string
  start_at: string
  end_at: string
  status: MeetingStatus
  notes?: string | null
}

export type MeetingUpdateInput = Partial<Omit<MeetingCreateInput, 'user_id'>> & {
  user_id?: string
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

export async function fetchMeetings(): Promise<MeetingItem[]> {
  return request<MeetingItem[]>('/meetings')
}

export async function createMeeting(payload: MeetingCreateInput): Promise<MeetingItem> {
  return request<MeetingItem>('/meetings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateMeeting(meetingId: string, payload: MeetingUpdateInput): Promise<MeetingItem> {
  return request<MeetingItem>(`/meetings/${meetingId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  await request(`/meetings/${meetingId}`, { method: 'DELETE' })
}
