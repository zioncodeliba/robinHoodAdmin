import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/toaster'
import { loginUser, registerUser, type Gender } from '@/lib/auth-api'
import { clearAuth, getStoredAuth, isActiveAdminAuth, storeAuth } from '@/lib/auth-storage'

const genderOptions: { value: Gender; label: string }[] = [
  { value: 'male', label: 'גבר' },
  { value: 'female', label: 'אישה' },
]

export function Register() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    mail: '',
    gender: 'male' as Gender,
    password: '',
    confirm: '',
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
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('יש להזין שם פרטי ושם משפחה')
      return
    }
    if (!form.username.trim()) {
      toast.error('יש להזין שם משתמש')
      return
    }
    if (!form.mail.trim() || !form.mail.includes('@')) {
      toast.error('יש להזין כתובת אימייל תקינה')
      return
    }
    if (!form.password || form.password.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    if (form.password !== form.confirm) {
      toast.error('הסיסמאות אינן תואמות')
      return
    }

    try {
      setIsSubmitting(true)
      await registerUser({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        username: form.username.trim(),
        password: form.password,
        gender: form.gender,
        mail: form.mail.trim(),
      })

      const response = await loginUser({
        username: form.username.trim(),
        password: form.password,
      })
      storeAuth(response)
      toast.success('ההרשמה הושלמה בהצלחה')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהרשמה')
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
              <p className="text-sm text-[var(--color-text-muted)]">התחלה מהירה</p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[var(--color-text)]">יצירת משתמש חדש</h1>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                מלאו פרטים בסיסיים ותתחילו לעבוד עם מערכת הניהול.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[var(--color-text)]">
                  שם פרטי
                  <Input
                    value={form.firstName}
                    onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                    autoComplete="given-name"
                    placeholder="דני"
                    className="mt-2"
                  />
                </label>

                <label className="block text-sm font-medium text-[var(--color-text)]">
                  שם משפחה
                  <Input
                    value={form.lastName}
                    onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                    autoComplete="family-name"
                    placeholder="כהן"
                    className="mt-2"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-[var(--color-text)]">
                אימייל
                <Input
                  value={form.mail}
                  onChange={(event) => setForm((prev) => ({ ...prev, mail: event.target.value }))}
                  autoComplete="email"
                  placeholder="name@company.com"
                  dir="ltr"
                  className="mt-2 text-left"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[var(--color-text)]">
                  שם משתמש
                  <Input
                    value={form.username}
                    onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                    autoComplete="username"
                    placeholder="admin01"
                    dir="ltr"
                    className="mt-2 text-left"
                  />
                </label>

                <div className="text-sm font-medium text-[var(--color-text)]">
                  מגדר
                  <div className="mt-2">
                    <DropdownSelect
                      value={form.gender}
                      onChange={(value) => setForm((prev) => ({ ...prev, gender: value }))}
                      options={genderOptions}
                      buttonClassName="w-full justify-between bg-white"
                      contentAlign="end"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[var(--color-text)]">
                  סיסמה
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    dir="ltr"
                    className="mt-2 text-left"
                  />
                </label>

                <label className="block text-sm font-medium text-[var(--color-text)]">
                  אימות סיסמה
                  <Input
                    type="password"
                    value={form.confirm}
                    onChange={(event) => setForm((prev) => ({ ...prev, confirm: event.target.value }))}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    dir="ltr"
                    className="mt-2 text-left"
                  />
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'יוצר משתמש...' : 'סיום הרשמה'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
              כבר יש לך משתמש?{' '}
              <Link to="/login" className="font-semibold text-[var(--color-primary)] hover:underline">
                להתחברות
              </Link>
            </div>
          </section>

          <aside className="hidden lg:flex flex-col justify-between rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <div className="space-y-4 text-right" dir="rtl">
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">מה מחכה לך במערכת?</h2>
              <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
                <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3">
                  מעקב אחר סטטוס לידים ומשימות יומיות.
                </div>
                <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3">
                  אינטגרציה עם תהליכי הצ׳אטבוט והלקוחות.
                </div>
                <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3">
                  דוחות ביצועים ומדדים במקום אחד.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
