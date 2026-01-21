import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/toaster'
import { loginUser } from '@/lib/auth-api'
import { clearAuth, getStoredAuth, isActiveAdminAuth, storeAuth } from '@/lib/auth-storage'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    username: '',
    password: '',
  })

  useEffect(() => {
    const stored = getStoredAuth()
    if (isActiveAdminAuth(stored)) {
      navigate('/dashboard', { replace: true })
      return
    }
    if (stored) {
      clearAuth()
    }
  }, [navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.username.trim() || !form.password) {
      toast.error('יש למלא שם משתמש וסיסמה')
      return
    }

    const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard'

    try {
      setIsSubmitting(true)
      const response = await loginUser({
        username: form.username.trim(),
        password: form.password,
      })
      storeAuth(response)
      toast.success('התחברת בהצלחה')
      navigate(nextPath, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהתחברות')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[var(--color-background)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-[var(--color-border)] bg-white p-6 sm:p-8 shadow-sm" dir="rtl">
            <div className="text-right">
              <p className="text-sm text-[var(--color-text-muted)]">ברוכים הבאים חזרה</p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[var(--color-text)]">כניסה למערכת</h1>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                התחברו כדי לנהל לידים, לקוחות ותהליכים במקום אחד.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-[var(--color-text)]">
                שם משתמש
                <Input
                  value={form.username}
                  onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                  autoComplete="username"
                  placeholder="yourname"
                  dir="ltr"
                  className="mt-2 text-left"
                />
              </label>

              <label className="block text-sm font-medium text-[var(--color-text)]">
                סיסמה
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  dir="ltr"
                  className="mt-2 text-left"
                />
              </label>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'מתחבר...' : 'כניסה'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
              עדיין אין משתמש?{' '}
              <Link to="/register" className="font-semibold text-[var(--color-primary)] hover:underline">
                להרשמה
              </Link>
            </div>
          </section>

          <aside className="hidden lg:flex flex-col justify-between rounded-3xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-6 text-white shadow-sm">
            <div className="space-y-4">
              <span className="inline-flex w-fit rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide">
                Robin Admin
              </span>
              <h2 className="text-2xl font-semibold">כל התמונה העסקית במקום אחד</h2>
              <p className="text-sm text-white/80">
                ריכוז סטטוסים, משימות ותיעוד שיחות — עם עדכונים בזמן אמת מצוות המכירות והצ׳אטבוט.
              </p>
            </div>

            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/70">לידים פעילים</span>
                <span className="text-lg font-semibold">128</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-white/70">שיחות פתוחות</span>
                <span className="text-lg font-semibold">17</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
