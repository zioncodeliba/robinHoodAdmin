import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Lock, User, Plus, Trash2, Save, MessageSquare, Edit2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { getCurrentAdminProfile } from '@/lib/admin-profile'
import { changeAdminPassword, updateAdminProfile } from '@/lib/admin-profile-api'
import { createAdmin, fetchAdmins, removeAdmin, type AdminUser } from '@/lib/admins-api'
import { clearAuth, updateStoredUser } from '@/lib/auth-storage'
import { formatShortDate } from '@/lib/utils'
import { useMessages } from '@/lib/messages-store'
import type { Gender } from '@/lib/auth-api'
import type { LeadStatus, MessageTemplate } from '@/types'

const leadStatusOptions: { value: LeadStatus; label: string }[] = [
  { value: 'נרשם', label: 'נרשם' },
  { value: 'שיחה עם הצ׳אט', label: 'שיחה עם הצ׳אט' },
  { value: 'חוסר התאמה', label: 'חוסר התאמה' },
  { value: 'סיום צ׳אט בהצלחה', label: 'סיום צ׳אט בהצלחה' },
  { value: 'העלאת קבצים', label: 'העלאת קבצים' },
  { value: 'ממתין לאישור עקרוני', label: 'ממתין לאישור עקרוני' },
  { value: 'אישור עקרוני', label: 'אישור עקרוני' },
  { value: 'שיחת תמהיל', label: 'שיחת תמהיל' },
  { value: 'משא ומתן', label: 'משא ומתן' },
  { value: 'חתימות', label: 'חתימות' },
  { value: 'קבלת הכסף', label: 'קבלת הכסף' },
  { value: 'מחזור - אין הצעה', label: 'מחזור - אין הצעה' },
  { value: 'מחזור - יש הצעה', label: 'מחזור - יש הצעה' },
  { value: 'מחזור - נקבעה פגישה', label: 'מחזור - נקבעה פגישה' },
  { value: 'מחזור - ניטור', label: 'מחזור - ניטור' },
]

const genderOptions: { value: Gender; label: string }[] = [
  { value: 'male', label: 'גבר' },
  { value: 'female', label: 'אישה' },
]

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm" dir="rtl">
      <div className="text-right">
        <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">{title}</h2>
        {description ? <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">{description}</p> : null}
      </div>
      <div className="mt-4 sm:mt-5">{children}</div>
    </section>
  )
}

export function Settings() {
  const navigate = useNavigate()
  const currentAdmin = getCurrentAdminProfile()
  const currentUsername = currentAdmin.username ?? ''
  const [profile, setProfile] = useState({
    name: currentAdmin.name,
    email: currentAdmin.email,
    username: currentUsername,
  })
  const [profileSaving, setProfileSaving] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    newPassword: '',
    confirm: '',
  })
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Admin users state
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [addAdminOpen, setAddAdminOpen] = useState(false)
  const [addAdminForm, setAddAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    gender: 'male' as Gender,
  })
  const [isAddingAdmin, setIsAddingAdmin] = useState(false)
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false)
  const [deleteAdminConfirm, setDeleteAdminConfirm] = useState<{ open: boolean; adminId: string | null }>({
    open: false,
    adminId: null,
  })

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true)
    try {
      const data = await fetchAdmins()
      setAdmins(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת משתמשי אדמין')
    } finally {
      setAdminsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAdmins()
  }, [loadAdmins])

  // Message templates state
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useMessages()
  const [addTemplateOpen, setAddTemplateOpen] = useState(false)
  const [addTemplateForm, setAddTemplateForm] = useState({
    name: '',
    trigger: 'אישור עקרוני' as LeadStatus,
    message: '',
  })
  const [editTemplateOpen, setEditTemplateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [deleteTemplateConfirm, setDeleteTemplateConfirm] = useState<{ open: boolean; templateId: string | null }>({
    open: false,
    templateId: null,
  })

  const splitName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    const firstName = parts.shift() ?? ''
    const lastName = parts.join(' ')
    return { firstName, lastName }
  }

  const handleProfileSave = async () => {
    if (!profile.name.trim()) {
      toast.error('הזינו שם מלא')
      return
    }
    if (!profile.username.trim()) {
      toast.error('הזינו שם משתמש')
      return
    }
    if (!profile.email.trim() || !profile.email.includes('@')) {
      toast.error('הזינו אימייל תקין')
      return
    }

    const { firstName, lastName } = splitName(profile.name)

    try {
      setProfileSaving(true)
      const updated = await updateAdminProfile({
        first_name: firstName,
        last_name: lastName,
        mail: profile.email.trim(),
        username: profile.username.trim(),
      })
      const usernameChanged = updated.username !== currentUsername
      if (usernameChanged) {
        toast.success('שם המשתמש עודכן. יש להתחבר מחדש.')
        clearAuth()
        navigate('/login', { replace: true })
        return
      }
      updateStoredUser({
        firstName: updated.first_name,
        lastName: updated.last_name,
        mail: updated.mail,
        username: updated.username,
      })
      setProfile({
        name: [updated.first_name, updated.last_name].filter(Boolean).join(' ').trim(),
        email: updated.mail,
        username: updated.username,
      })
      await loadAdmins()
      toast.success('הפרטים נשמרו בהצלחה')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירת פרטים')
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!passwordForm.current) {
      toast.error('הזינו סיסמה נוכחית')
      return
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      toast.error('הסיסמה החדשה חייבת להכיל לפחות 6 תווים')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      toast.error('הסיסמאות אינן תואמות')
      return
    }
    try {
      setPasswordSaving(true)
      await changeAdminPassword({
        current_password: passwordForm.current,
        new_password: passwordForm.newPassword,
      })
      toast.success('הסיסמה עודכנה בהצלחה')
      setPasswordOpen(false)
      setPasswordForm({ current: '', newPassword: '', confirm: '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בעדכון סיסמה')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleAddAdmin = async () => {
    if (!addAdminForm.name.trim()) {
      toast.error('הזינו שם')
      return
    }
    if (!addAdminForm.email.trim() || !addAdminForm.email.includes('@')) {
      toast.error('הזינו אימייל תקין')
      return
    }
    if (!addAdminForm.password || addAdminForm.password.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }

    const { firstName, lastName } = splitName(addAdminForm.name)
    try {
      setIsAddingAdmin(true)
      await createAdmin({
        firstName,
        lastName,
        email: addAdminForm.email.trim(),
        password: addAdminForm.password,
        gender: addAdminForm.gender,
      })
      await loadAdmins()
      toast.success('משתמש אדמין נוסף בהצלחה')
      setAddAdminOpen(false)
      setAddAdminForm({ name: '', email: '', password: '', gender: 'male' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהוספת אדמין')
    } finally {
      setIsAddingAdmin(false)
    }
  }

  const handleDeleteAdmin = async (adminId: string) => {
    if (adminId === currentAdmin.id) {
      toast.error('לא ניתן למחוק את המשתמש הנוכחי')
      return
    }
    try {
      setIsDeletingAdmin(true)
      await removeAdmin(adminId)
      await loadAdmins()
      toast.success('המשתמש נמחק')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה במחיקת אדמין')
    } finally {
      setIsDeletingAdmin(false)
    }
  }

  const handleAddTemplate = () => {
    if (!addTemplateForm.name.trim()) {
      toast.error('הזינו שם לתבנית')
      return
    }
    if (!addTemplateForm.message.trim()) {
      toast.error('הזינו תוכן הודעה')
      return
    }
    addTemplate({
      name: addTemplateForm.name.trim(),
      trigger: addTemplateForm.trigger,
      message: addTemplateForm.message.trim(),
    })
    toast.success('התבנית נוספה בהצלחה')
    setAddTemplateOpen(false)
    setAddTemplateForm({ name: '', trigger: 'אישור עקרוני', message: '' })
  }

  const handleEditTemplate = () => {
    if (!editingTemplate) return
    if (!editingTemplate.name.trim()) {
      toast.error('הזינו שם לתבנית')
      return
    }
    if (!editingTemplate.message.trim()) {
      toast.error('הזינו תוכן הודעה')
      return
    }
    updateTemplate(editingTemplate.id, {
      name: editingTemplate.name.trim(),
      trigger: editingTemplate.trigger,
      message: editingTemplate.message.trim(),
    })
    toast.success('התבנית עודכנה בהצלחה')
    setEditTemplateOpen(false)
    setEditingTemplate(null)
  }

  const handleDeleteTemplate = (templateId: string) => {
    deleteTemplate(templateId)
    toast.success('התבנית נמחקה')
  }

  const openEditTemplate = (template: MessageTemplate) => {
    setEditingTemplate({ ...template })
    setEditTemplateOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      <div className="text-right">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">הגדרות</h1>
        <p className="mt-1 text-sm sm:text-base text-[var(--color-text-muted)]">הגדרות פרופיל וניהול משתמשי אדמין.</p>
      </div>

      {/* Profile */}
      <Section
        title="פרטי פרופיל"
        description="עדכון שם משתמש ואימייל."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="text-right">
            <label className="text-sm font-medium text-[var(--color-text)]">שם מלא</label>
            <div className="mt-2">
              <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} className="text-right" />
            </div>
          </div>
          <div className="text-right">
            <label className="text-sm font-medium text-[var(--color-text)]">שם משתמש</label>
            <div className="mt-2">
              <Input
                value={profile.username}
                onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                dir="ltr"
                className="text-left"
              />
            </div>
          </div>
          <div className="text-right">
            <label className="text-sm font-medium text-[var(--color-text)]">אימייל</label>
            <div className="mt-2">
              <Input value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} dir="ltr" className="text-left" />
            </div>
          </div>
        </div>

        <div className="mt-4 sm:mt-5 flex justify-start">
          <Button
            variant="accent"
            onClick={handleProfileSave}
            className="w-full sm:w-auto"
            disabled={profileSaving}
          >
            <AnimatedIcon icon={User} size={18} variant="lift" />
            {profileSaving ? 'שומר...' : 'שמירת פרטים'}
          </Button>
        </div>
      </Section>

      {/* Password */}
      <Section
        title="סיסמה"
        description="החלפת סיסמה להתחברות למערכת."
      >
        <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between">
         
          <Button
            variant="outline"
            onClick={() => setPasswordOpen(true)}
            className="w-full sm:w-auto"
          >
            <AnimatedIcon icon={Lock} size={18} variant="wiggle" />
            החלפת סיסמה
          </Button>
        </div>
      </Section>

      {/* Admin Management */}
      <Section
        title="ניהול משתמשי אדמין"
        description="הוספה ומחיקה של משתמשי מערכת."
      >
        <div className="flex justify-start mb-4">
          <Button variant="accent" onClick={() => setAddAdminOpen(true)} className="w-full sm:w-auto">
            <AnimatedIcon icon={Plus} size={18} variant="lift" />
            הוספת אדמין
          </Button>
        </div>

        {adminsLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">טוען משתמשי אדמין...</p>
        ) : null}

        {!adminsLoading && admins.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">לא נמצאו משתמשי אדמין.</p>
        ) : null}

        {!adminsLoading && admins.length > 0 ? (
          <>
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
              {admins.map((admin) => {
                const isCurrentAdmin = admin.id === currentAdmin.id
                return (
                  <div
                    key={admin.id}
                    className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-4"
                  >
                    <div className="flex flex-row-reverse items-start justify-between gap-3">
                      <div className="min-w-0 text-right">
                        <p className="font-semibold text-[var(--color-text)] truncate">{admin.name}</p>
                        <p className="text-sm text-[var(--color-text-muted)]" dir="ltr">{admin.email}</p>
                        <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">שם משתמש: {admin.username}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">נוצר: {formatShortDate(admin.createdAt)}</p>
                      </div>
                      {isCurrentAdmin ? (
                        <span className="text-xs text-[var(--color-text-muted)]">המשתמש הנוכחי</span>
                      ) : (
                        <button
                          onClick={() => setDeleteAdminConfirm({ open: true, adminId: admin.id })}
                          className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                          aria-label="מחיקה"
                          disabled={isDeletingAdmin}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-b border-[var(--color-border-light)] text-[var(--color-text-muted)]">
                    <th className="px-4 py-3 text-right font-medium">שם</th>
                    <th className="px-4 py-3 text-right font-medium">אימייל</th>
                    <th className="px-4 py-3 text-right font-medium">שם משתמש</th>
                    <th className="px-4 py-3 text-right font-medium">תאריך יצירה</th>
                    <th className="px-4 py-3 text-right font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => {
                    const isCurrentAdmin = admin.id === currentAdmin.id
                    return (
                      <tr key={admin.id} className="border-b border-[var(--color-border-light)] last:border-0">
                        <td className="px-4 py-3 font-medium text-[var(--color-text)]">{admin.name}</td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]" dir="ltr">{admin.email}</td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]" dir="ltr">{admin.username}</td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatShortDate(admin.createdAt)}</td>
                        <td className="px-4 py-3">
                          {isCurrentAdmin ? (
                            <span className="text-xs text-[var(--color-text-muted)]">המשתמש הנוכחי</span>
                          ) : (
                            <button
                              onClick={() => setDeleteAdminConfirm({ open: true, adminId: admin.id })}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                              aria-label="מחיקה"
                              disabled={isDeletingAdmin}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Section>

      {/* Message Templates Management */}
      <Section
        title="ניהול הודעות ללקוח"
        description="הגדרת תבניות הודעות לשליחה ללקוחות לפי שלבי התהליך."
      >
        <div className="flex justify-start mb-4">
          <Button variant="accent" onClick={() => setAddTemplateOpen(true)} className="w-full sm:w-auto">
            <AnimatedIcon icon={Plus} size={18} variant="lift" />
            הוספת תבנית
          </Button>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-4"
            >
              <div className="flex flex-row-reverse items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-right">
                  <p className="font-semibold text-[var(--color-text)]">{template.name}</p>
                  <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] mt-1">
                    {template.trigger}
                  </span>
                  <p className="text-sm text-[var(--color-text-muted)] mt-2 line-clamp-2">{template.message}</p>
                </div>
                <div className="shrink-0 flex gap-1">
                  <button
                    onClick={() => openEditTemplate(template)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                    aria-label="עריכה"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setDeleteTemplateConfirm({ open: true, templateId: template.id })}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                    aria-label="מחיקה"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-center text-sm text-[var(--color-text-muted)] py-8">אין תבניות הודעות. הוסיפו תבנית חדשה.</p>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] text-[var(--color-text-muted)]">
                <th className="px-4 py-3 text-right font-medium">שם</th>
                <th className="px-4 py-3 text-right font-medium">טריגר</th>
                <th className="px-4 py-3 text-right font-medium">הודעה</th>
                <th className="px-4 py-3 text-right font-medium w-28">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-[var(--color-border-light)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{template.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      {template.trigger}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] max-w-xs truncate">{template.message}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditTemplate(template)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                        aria-label="עריכה"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTemplateConfirm({ open: true, templateId: template.id })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                        aria-label="מחיקה"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                    אין תבניות הודעות. הוסיפו תבנית חדשה.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Password Change Modal */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>החלפת סיסמה</DialogTitle>
            <DialogDescription>הזינו את הסיסמה הנוכחית ובחרו סיסמה חדשה.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">סיסמה נוכחית</label>
              <Input
                type="password"
                className="mt-2 text-left"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">סיסמה חדשה</label>
              <Input
                type="password"
                className="mt-2 text-left"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                dir="ltr"
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">לפחות 6 תווים</p>
            </div>
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">אישור סיסמה חדשה</label>
              <Input
                type="password"
                className="mt-2 text-left"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                dir="ltr"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row-reverse justify-start gap-2">
            <Button
              variant="accent"
              onClick={handlePasswordChange}
              className="w-full sm:w-auto"
              disabled={passwordSaving}
            >
              {passwordSaving ? 'מעדכן...' : 'עדכון סיסמה'}
            </Button>
            <Button variant="outline" onClick={() => setPasswordOpen(false)} className="w-full sm:w-auto">ביטול</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Admin Modal */}
      <Dialog open={addAdminOpen} onOpenChange={setAddAdminOpen}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>הוספת משתמש אדמין</DialogTitle>
            <DialogDescription>הוסיפו משתמש חדש למערכת הניהול.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">שם מלא</label>
              <Input
                className="mt-2 text-right"
                value={addAdminForm.name}
                onChange={(e) => setAddAdminForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">אימייל</label>
              <Input
                className="mt-2 text-left"
                value={addAdminForm.email}
                onChange={(e) => setAddAdminForm((p) => ({ ...p, email: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">מגדר</label>
              <div className="mt-2">
                <DropdownSelect<Gender>
                  value={addAdminForm.gender}
                  onChange={(value) => setAddAdminForm((p) => ({ ...p, gender: value }))}
                  options={genderOptions}
                  buttonClassName="w-full justify-between bg-white"
                  contentAlign="end"
                />
              </div>
            </div>
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">סיסמה</label>
              <Input
                type="password"
                className="mt-2 text-left"
                value={addAdminForm.password}
                onChange={(e) => setAddAdminForm((p) => ({ ...p, password: e.target.value }))}
                dir="ltr"
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">לפחות 6 תווים</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row-reverse justify-start gap-2">
            <Button
              variant="accent"
              onClick={handleAddAdmin}
              className="w-full sm:w-auto"
              disabled={isAddingAdmin}
            >
              {isAddingAdmin ? 'יוצר אדמין...' : 'הוספת אדמין'}
            </Button>
            <Button variant="outline" onClick={() => setAddAdminOpen(false)} className="w-full sm:w-auto">ביטול</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Admin Confirmation */}
      <ConfirmDialog
        open={deleteAdminConfirm.open}
        onOpenChange={(open) => setDeleteAdminConfirm({ open, adminId: null })}
        title="מחיקת משתמש אדמין"
        description="האם אתם בטוחים שברצונכם למחוק משתמש זה? פעולה זו אינה ניתנת לביטול."
        confirmText="מחיקה"
        onConfirm={() => {
          if (deleteAdminConfirm.adminId) {
            handleDeleteAdmin(deleteAdminConfirm.adminId)
          }
        }}
      />

      {/* Add Template Modal */}
      <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader className="text-right">
            <DialogTitle>הוספת תבנית הודעה</DialogTitle>
            <DialogDescription>צרו תבנית הודעה חדשה לשליחה ללקוחות.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">שם התבנית</label>
              <Input
                className="mt-2 text-right"
                placeholder="לדוגמה: אישור עקרוני התקבל"
                value={addTemplateForm.name}
                onChange={(e) => setAddTemplateForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">טריגר (שלב בתהליך)</label>
              <div className="mt-2">
                <DropdownSelect<LeadStatus>
                  value={addTemplateForm.trigger}
                  onChange={(v) => setAddTemplateForm((p) => ({ ...p, trigger: v }))}
                  options={leadStatusOptions}
                  buttonClassName="w-full justify-between"
                />
              </div>
            </div>
            <div className="text-right">
              <label className="text-sm font-medium text-[var(--color-text)]">תוכן ההודעה</label>
              <textarea
                className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white p-3 text-sm text-right resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                rows={4}
                placeholder="הזינו את תוכן ההודעה שתישלח ללקוח..."
                value={addTemplateForm.message}
                onChange={(e) => setAddTemplateForm((p) => ({ ...p, message: e.target.value }))}
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">טיפ: השתמשו ב-{'{שם}'} להוספת שם הלקוח בהודעה.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row-reverse justify-start gap-2">
            <Button variant="accent" onClick={handleAddTemplate} className="w-full sm:w-auto">
              <AnimatedIcon icon={MessageSquare} size={18} variant="lift" />
              הוספת תבנית
            </Button>
            <Button variant="outline" onClick={() => setAddTemplateOpen(false)} className="w-full sm:w-auto">ביטול</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Modal */}
      <Dialog open={editTemplateOpen} onOpenChange={setEditTemplateOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader className="text-right">
            <DialogTitle>עריכת תבנית הודעה</DialogTitle>
            <DialogDescription>עדכנו את פרטי התבנית.</DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4">
              <div className="text-right">
                <label className="text-sm font-medium text-[var(--color-text)]">שם התבנית</label>
                <Input
                  className="mt-2 text-right"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate((p) => p ? { ...p, name: e.target.value } : null)}
                />
              </div>
              <div className="text-right">
                <label className="text-sm font-medium text-[var(--color-text)]">טריגר (שלב בתהליך)</label>
                <div className="mt-2">
                  <DropdownSelect<LeadStatus>
                    value={editingTemplate.trigger}
                    onChange={(v) => setEditingTemplate((p) => p ? { ...p, trigger: v } : null)}
                    options={leadStatusOptions}
                    buttonClassName="w-full justify-between"
                  />
                </div>
              </div>
              <div className="text-right">
                <label className="text-sm font-medium text-[var(--color-text)]">תוכן ההודעה</label>
                <textarea
                  className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white p-3 text-sm text-right resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  rows={4}
                  value={editingTemplate.message}
                  onChange={(e) => setEditingTemplate((p) => p ? { ...p, message: e.target.value } : null)}
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">טיפ: השתמשו ב-{'{שם}'} להוספת שם הלקוח בהודעה.</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse sm:flex-row-reverse justify-start gap-2">
            <Button variant="accent" onClick={handleEditTemplate} className="w-full sm:w-auto">
              <AnimatedIcon icon={Save} size={18} variant="lift" />
              שמירת שינויים
            </Button>
            <Button variant="outline" onClick={() => setEditTemplateOpen(false)} className="w-full sm:w-auto">ביטול</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <ConfirmDialog
        open={deleteTemplateConfirm.open}
        onOpenChange={(open) => setDeleteTemplateConfirm({ open, templateId: null })}
        title="מחיקת תבנית הודעה"
        description="האם אתם בטוחים שברצונכם למחוק תבנית זו? פעולה זו אינה ניתנת לביטול."
        confirmText="מחיקה"
        onConfirm={() => {
          if (deleteTemplateConfirm.templateId) {
            handleDeleteTemplate(deleteTemplateConfirm.templateId)
          }
        }}
      />
    </div>
  )
}
