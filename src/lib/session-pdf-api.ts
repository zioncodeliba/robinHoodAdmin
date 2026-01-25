import { getActiveAdminAuth } from '@/lib/auth-storage'

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:3000').replace(/\/$/, '')
const CHATBOT_BASE = `${API_BASE}/chatbot/v1`

function getAuthHeader() {
  const auth = getActiveAdminAuth()
  if (!auth?.accessToken) {
    throw new Error('Missing auth token')
  }
  return { Authorization: `${auth.tokenType} ${auth.accessToken}` }
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

async function readErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = await response.json()
    return getErrorMessage(payload, fallback)
  }
  const text = await response.text()
  return text.trim() ? text : fallback
}

function getFilenameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)
  if (!match?.[1]) return fallback
  const raw = match[1].trim()
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function downloadUserSessionPdf(userId: string, sessionId?: string): Promise<{ blob: Blob; filename: string }> {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''
  const response = await fetch(`${CHATBOT_BASE}/sessions/by-user/${userId}/pdf${query}`, {
    headers: {
      ...getAuthHeader(),
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Request failed'))
  }

  const blob = await response.blob()
  const fallback = sessionId ? `session_${sessionId}.pdf` : 'mortgage_document.pdf'
  const filename = getFilenameFromDisposition(response.headers.get('content-disposition'), fallback)
  return { blob, filename }
}
