import { getActiveAdminAuth } from '@/lib/auth-storage'

export type TimeRange = {
  start: string
  end: string
}

export type AvailabilityDay = {
  enabled: boolean
  ranges: TimeRange[]
}

export type DateException = {
  id: string
  date: string
  type: 'block' | 'open'
  allDay: boolean
  ranges: TimeRange[]
  reason: string
}

export type MeetingAvailabilityPayload = {
  availability: AvailabilityDay[]
  exceptions: DateException[]
  agent_count: number
  block_holidays: boolean
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

export async function fetchMeetingAvailability(): Promise<MeetingAvailabilityPayload> {
  return request<MeetingAvailabilityPayload>('/meeting-availability')
}

export async function updateMeetingAvailability(
  payload: MeetingAvailabilityPayload
): Promise<MeetingAvailabilityPayload> {
  return request<MeetingAvailabilityPayload>('/meeting-availability', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
