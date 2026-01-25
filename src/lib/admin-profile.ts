import type { Admin } from '@/types'
import { getStoredAuth } from '@/lib/auth-storage'
import { currentUser } from '@/lib/mock-data'

export function getCurrentAdminProfile(): Admin {
  const auth = getStoredAuth()
  if (!auth?.user) {
    return currentUser
  }

  const name = [auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ').trim()
  const fallbackName = auth.user.username || currentUser.name

  return {
    id: auth.user.id,
    name: name || fallbackName,
    email: auth.user.mail || currentUser.email,
    username: auth.user.username,
  }
}
