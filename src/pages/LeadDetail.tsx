import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import * as Slider from '@radix-ui/react-slider'
import {
  ArrowRight,
  Download,
  FileUp,
  Pencil,
  Trash2,
  X,
  Plus,
  Calculator,
  Eye,
  UploadCloud,
  CheckCircle2,
  CircleDashed,
  Send,
  MessageSquare,
  CheckCheck,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import { useUsers } from '@/lib/users-store'
import { useAffiliates } from '@/lib/affiliates-store'
import { useMessages } from '@/lib/messages-store'
import { fetchChatHistoryForUser, type ChatHistoryItem } from '@/lib/chatbot-history-api'
import { fetchCustomerBankVisibility, updateCustomerBankVisibility } from '@/lib/bank-visibility-api'
import { downloadBankResponseFile, fetchBankResponses, uploadBankResponseForUser, type BankResponseItem } from '@/lib/bank-responses-api'
import { downloadCustomerFile, fetchCustomerFiles } from '@/lib/customer-files-api'
import { createNotificationForUser, deleteNotification, fetchNotificationsByUser, type NotificationItem } from '@/lib/notifications-api'
import { downloadUserSessionPdf } from '@/lib/session-pdf-api'
import { getCurrentAdminProfile } from '@/lib/admin-profile'
import type { BankName, BankResponseExtractedData, BankResponseFile, LeadStatus, MortgageType, SignatureDocStatus, UserRecord, SentMessage } from '@/types'

const loanTypeLabels: Record<number, string> = {
  1: 'קבועה צמודה',
  2: 'קבועה לא צמודה',
  3: 'משתנה צמודה',
  4: 'פריים',
  5: 'משתנה לא צמודה',
}

const bankIdByName: Record<BankName, number> = {
  'מזרחי-טפחות': 1,
  'לאומי': 2,
  'הפועלים': 3,
  'דיסקונט': 4,
  'הבינלאומי': 8,
  'מרכנתיל': 12,
}

const bankNameById: Record<number, BankName> = {
  1: 'מזרחי-טפחות',
  2: 'לאומי',
  3: 'הפועלים',
  4: 'דיסקונט',
  8: 'הבינלאומי',
  12: 'מרכנתיל',
}

const BANK_VISIBILITY_ORDER = [3, 2, 1, 4, 8, 12]
const BANK_VISIBILITY_OPTIONS = BANK_VISIBILITY_ORDER.map((id) => ({
  id,
  label: bankNameById[id] ?? `בנק ${id}`,
}))

const normalizeAllowedBankIds = (ids: number[]) =>
  BANK_VISIBILITY_ORDER.filter((id) => ids.includes(id))


const mapNotificationToSentMessage = (item: NotificationItem): SentMessage => ({
  id: item.id,
  templateId: item.template_id ?? '',
  templateName: item.template_name ?? 'עדכון',
  message: item.message,
  sentAt: item.sent_at,
  readAt: item.read_at ?? undefined,
})

type BankProcessType = 'recycle' | 'new_loan'

const resolveProcessType = (mortgageType?: MortgageType): BankProcessType =>
  mortgageType === 'מחזור משכנתא' ? 'recycle' : 'new_loan'

const SYSTEM_SIGNATURE_PREFIX = 'system_signature_'
const BANK_SIGNATURE_PREFIX = 'bank_signature_'

type ActiveTab = 'questionnaire' | 'files' | 'simulator' | 'updates'
type SimulatorTab = 'לאומי' | 'מזרחי-טפחות' | 'הצעה נבחרת'

function InfoTile({
  label,
  value,
  valueDir,
}: {
  label: string
  value: React.ReactNode
  valueDir?: 'rtl' | 'ltr'
}) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-[var(--color-background)] p-3 sm:p-4">
      <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 sm:mt-1 text-sm sm:text-base font-semibold text-[var(--color-text)] truncate" dir={valueDir}>
        {value}
      </p>
    </div>
  )
}

function formatCurrencyILS(value: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value)
}

function calcMonthlyPayment(principal: number, annualRatePercent: number, years: number) {
  const r = (annualRatePercent / 100) / 12
  const n = years * 12
  if (r === 0) return principal / n
  return (principal * r) / (1 - Math.pow(1 + r, -n))
}

export function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { users, updateUser, deleteUser, updateCustomer } = useUsers()
  const { affiliates } = useAffiliates()
  const currentAdmin = getCurrentAdminProfile()

  const user = useMemo(() => users.find((u) => u.id === id) ?? null, [users, id])
  const [activeTab, setActiveTab] = useState<ActiveTab>('questionnaire')
  const [simulatorTab, setSimulatorTab] = useState<SimulatorTab>('לאומי')

  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    status: (user?.status ?? 'נרשם') as LeadStatus,
    mortgageType: (user?.mortgageType ?? '-') as MortgageType,
  })

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean
    type: 'bankResponse' | 'simulatorOffer' | 'clientPayment' | null
    id: string | null
  }>({ open: false, type: null, id: null })

  const [uploadingBankFile, setUploadingBankFile] = useState(false)
  const [bankUploadOpen, setBankUploadOpen] = useState(false)
  const [bankUploadForm, setBankUploadForm] = useState<{
    bank: BankName
    fileName: string
    customName: string
    amount: string
    file: File | null
    processType: BankProcessType
  }>({
    bank: 'לאומי',
    fileName: '',
    customName: '',
    amount: '',
    file: null,
    processType: resolveProcessType(user?.mortgageType),
  })
  const [viewBankDataOpen, setViewBankDataOpen] = useState(false)
  const [viewBankData, setViewBankData] = useState<BankResponseFile | null>(null)

  // Client file upload
  const [fileUploadOpen, setFileUploadOpen] = useState(false)
  const [fileUploadForm, setFileUploadForm] = useState<{ fileName: string; customName: string }>({
    fileName: '',
    customName: '',
  })
  const [uploadingFile, setUploadingFile] = useState(false)

  const [loanAmount, setLoanAmount] = useState(850000)
  const [loanYears, setLoanYears] = useState(25)
  const [rate, setRate] = useState(4.2)
  const [calcLoading, setCalcLoading] = useState(false)

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    affiliateId: user?.affiliateId ?? 'organic',
    reference: '',
    note: '',
  })

  // Messages/Updates state
  const { templates } = useMessages()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [deleteMessageConfirm, setDeleteMessageConfirm] = useState<{ open: boolean; messageId: string | null }>({
    open: false,
    messageId: null,
  })

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false)
  const [customerFilesLoading, setCustomerFilesLoading] = useState(false)
  const [bankResponsesLoading, setBankResponsesLoading] = useState(false)
  const [systemFiles, setSystemFiles] = useState<{ id: string; originalName: string; uploadedAt: string }[]>([])
  const [signatureDownloadLoading, setSignatureDownloadLoading] = useState(false)
  const [allowedBankIds, setAllowedBankIds] = useState<number[]>(BANK_VISIBILITY_ORDER)
  const [bankVisibilityLoading, setBankVisibilityLoading] = useState(false)
  const [bankVisibilitySaving, setBankVisibilitySaving] = useState(false)

  const selectedTemplate = useMemo(() => 
    templates.find((t) => t.id === selectedTemplateId) ?? null, 
    [templates, selectedTemplateId]
  )

  const monthly = useMemo(() => calcMonthlyPayment(loanAmount, rate, loanYears), [loanAmount, rate, loanYears])
  const totalPaid = useMemo(() => monthly * loanYears * 12, [monthly, loanYears])
  const totalInterest = useMemo(() => Math.max(0, totalPaid - loanAmount), [totalPaid, loanAmount])

  useEffect(() => {
    if (!user) return
    let isMounted = true
    setChatHistoryLoading(true)
    fetchChatHistoryForUser(user.id)
      .then((data) => {
        if (isMounted) setChatHistory(data)
      })
      .catch((error) => {
        if (!isMounted) return
        setChatHistory([])
        toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת היסטוריית צ׳אט')
      })
      .finally(() => {
        if (isMounted) setChatHistoryLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    let isMounted = true
    setBankVisibilityLoading(true)
    fetchCustomerBankVisibility(user.id)
      .then((data) => {
        if (!isMounted) return
        const normalized = normalizeAllowedBankIds(data.allowed_bank_ids ?? [])
        setAllowedBankIds(normalized)
      })
      .catch(() => {
        if (!isMounted) return
        setAllowedBankIds(BANK_VISIBILITY_ORDER)
      })
      .finally(() => {
        if (isMounted) setBankVisibilityLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    let isMounted = true
    fetchNotificationsByUser(user.id)
      .then((items) => {
        if (!isMounted) return
        updateUser(
          user.id,
          { sentMessages: items.map(mapNotificationToSentMessage) } as Partial<UserRecord>
        )
      })
      .catch((error) => {
        if (!isMounted) return
        toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת הודעות')
      })
    return () => {
      isMounted = false
    }
  }, [user?.id, updateUser])

  useEffect(() => {
    if (!user) return
    let isMounted = true
    setCustomerFilesLoading(true)
    setSystemFiles([])
    fetchCustomerFiles(user.id)
      .then((data) => {
        if (!isMounted) return
        const systemItems = data.filter((item) => item.original_name.startsWith(SYSTEM_SIGNATURE_PREFIX))
        const bankItems = data.filter((item) => item.original_name.startsWith(BANK_SIGNATURE_PREFIX))
        const customerItems = data.filter(
          (item) =>
            !item.original_name.startsWith(SYSTEM_SIGNATURE_PREFIX) &&
            !item.original_name.startsWith(BANK_SIGNATURE_PREFIX)
        )

        const mappedSystem = systemItems.map((item) => {
          const uploadedDate = new Date(item.uploaded_at)
          const uploadedAt = Number.isNaN(uploadedDate.getTime())
            ? item.uploaded_at
            : uploadedDate.toISOString().slice(0, 10)
          return {
            id: item.id,
            originalName: item.original_name,
            uploadedAt,
          }
        })

        const mapped = customerItems.map((item) => {
          const uploadedDate = new Date(item.uploaded_at)
          const uploadedAt = Number.isNaN(uploadedDate.getTime())
            ? item.uploaded_at
            : uploadedDate.toISOString().slice(0, 10)
          return {
            id: item.id,
            originalName: item.original_name,
            uploadedBy: 'לקוח',
            uploadedAt,
          }
        })
        const mappedSignatureDocs = bankItems.map((item) => ({
          id: item.id,
          name: item.original_name,
          status: 'נחתם' as SignatureDocStatus,
          fileName: item.original_name,
        }))
        setSystemFiles(mappedSystem)
        updateUser(user.id, { uploadedFiles: mapped, signatureDocs: mappedSignatureDocs } as Partial<UserRecord>)
      })
      .catch((error) => {
        if (!isMounted) return
        setSystemFiles([])
        toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת קבצי לקוח')
      })
      .finally(() => {
        if (isMounted) setCustomerFilesLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [user?.id, updateUser])

  useEffect(() => {
    if (!user) return
    let isMounted = true
    setBankResponsesLoading(true)
    fetchBankResponses(user.id)
      .then((data) => {
        if (!isMounted) return
        updateUser(user.id, { bankResponses: data.map(mapBankResponseItem) } as Partial<UserRecord>)
      })
      .catch((error) => {
        if (!isMounted) return
        toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת קבצי בנק')
      })
      .finally(() => {
        if (isMounted) setBankResponsesLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [user?.id, updateUser])

  const toggleBankVisibility = async (bankId: number) => {
    if (!user || bankVisibilitySaving) return
    const prev = allowedBankIds
    const next = prev.includes(bankId) ? prev.filter((id) => id !== bankId) : [...prev, bankId]
    const ordered = normalizeAllowedBankIds(next)
    setAllowedBankIds(ordered)
    setBankVisibilitySaving(true)
    try {
      const updated = await updateCustomerBankVisibility(user.id, ordered)
      setAllowedBankIds(normalizeAllowedBankIds(updated.allowed_bank_ids ?? []))
      toast.success('הרשאות הבנקים עודכנו')
    } catch (error) {
      setAllowedBankIds(prev)
      toast.error(error instanceof Error ? error.message : 'שגיאה בעדכון הבנקים')
    } finally {
      setBankVisibilitySaving(false)
    }
  }

  const handleCustomerFileView = async (file: UserRecord['uploadedFiles'][number]) => {
    try {
      const { blob } = await downloadCustomerFile(file.id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת הקובץ')
    }
  }

  const handleCustomerFileDownload = async (file: UserRecord['uploadedFiles'][number]) => {
    try {
      const { blob, filename } = await downloadCustomerFile(file.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || file.originalName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהורדת הקובץ')
    }
  }

  const handleSystemFileView = async (fileId: string) => {
    try {
      const { blob } = await downloadCustomerFile(fileId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת הקובץ')
    }
  }

  const handleSystemFileDownload = async (fileId: string, fallbackName: string) => {
    try {
      const { blob, filename } = await downloadCustomerFile(fileId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || fallbackName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהורדת הקובץ')
    }
  }

  const mapBankResponseItem = (item: BankResponseItem): BankResponseFile => {
    const uploadedDate = new Date(item.uploaded_at)
    const uploadedAt = Number.isNaN(uploadedDate.getTime())
      ? item.uploaded_at
      : uploadedDate.toISOString().slice(0, 10)
    const extractedJson =
      item.extracted_json && typeof item.extracted_json === 'object'
        ? (item.extracted_json as BankResponseExtractedData)
        : null
    return {
      id: item.id,
      fileName: item.original_name,
      bank: bankNameById[item.bank_id] ?? 'לאומי',
      uploadedAt,
      extractedJson,
    }
  }

  const handleBankResponseView = async (response: BankResponseFile) => {
    try {
      const { blob, filename } = await downloadBankResponseFile(response.id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      toast.success(`הקובץ נפתח: ${filename || response.fileName}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בפתיחת קובץ בנק')
    }
  }

  const handleBankUpload = async () => {
    if (!user) return
    if (!bankUploadForm.file) {
      toast.error('בחרו קובץ להעלאה')
      return
    }
    if (!bankUploadForm.customName.trim()) {
      toast.error('נא להזין שם קובץ')
      return
    }
    const amountValue = Number((bankUploadForm.amount || '').replace(/[^\d]/g, ''))
    if (!amountValue) {
      toast.error('נא להזין סכום משכנתא תקין')
      return
    }

    const bankId = bankIdByName[bankUploadForm.bank]
    const rawFile = bankUploadForm.file
    const extension = rawFile.name.includes('.') ? rawFile.name.split('.').pop() ?? '' : ''
    const trimmedName = bankUploadForm.customName.trim()
    const hasExtension = extension && trimmedName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
    const uploadName = hasExtension ? trimmedName : `${trimmedName}${extension ? `.${extension}` : ''}`
    const uploadFile = uploadName === rawFile.name
      ? rawFile
      : new File([rawFile], uploadName, { type: rawFile.type })
    const scanType = bankUploadForm.processType === 'new_loan' ? 'new_loan' : undefined

    try {
      setUploadingBankFile(true)
      const created = await uploadBankResponseForUser(user.id, {
        bank_id: bankId,
        amount: amountValue,
        file: uploadFile,
        scan_type: scanType,
      })
      const mapped = mapBankResponseItem(created)
      updateUser(user.id, { bankResponses: [mapped, ...user.bankResponses] } as Partial<UserRecord>)
      try {
        await updateCustomer(user.id, { status: 'אישור עקרוני' })
      } catch {
        // Error toast is handled in the store.
      }
      toast.success('הקובץ הועלה בהצלחה')
      setBankUploadOpen(false)
      setBankUploadForm({
        bank: 'לאומי',
        fileName: '',
        customName: '',
        amount: '',
        file: null,
        processType: resolveProcessType(user?.mortgageType),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהעלאת קובץ בנק')
    } finally {
      setUploadingBankFile(false)
    }
  }

  const formatHistoryValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return '—'
    return String(value)
  }

  const formatHistoryTimestamp = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('he-IL')
  }

  const latestSessionInfo = useMemo(() => {
    if (chatHistory.length === 0) return null
    let latest = chatHistory[0]
    let latestTime = new Date(latest.timestamp).getTime()
    if (Number.isNaN(latestTime)) latestTime = 0
    for (const item of chatHistory.slice(1)) {
      let time = new Date(item.timestamp).getTime()
      if (Number.isNaN(time)) time = 0
      if (time >= latestTime) {
        latest = item
        latestTime = time
      }
    }
    return { sessionId: latest.session_id, timestamp: latest.timestamp }
  }, [chatHistory])

  const chatSections = useMemo(() => {
    if (chatHistoryLoading) {
      return [
        {
          title: 'שיחות צ׳אט',
          fields: [{ label: 'סטטוס', value: 'טוען היסטוריית שיחה...' }],
        },
      ]
    }
    if (chatHistory.length === 0) {
      return [
        {
          title: 'שיחות צ׳אט',
          fields: [{ label: 'סטטוס', value: 'אין היסטוריית שיחה זמינה' }],
        },
      ]
    }

    return chatHistory.map((item, index) => ({
      title: `שאלה ${index + 1}`,
      fields: [
        { label: 'שאלה', value: formatHistoryValue(item.block_message) },
        { label: 'תשובה', value: formatHistoryValue(item.user_input ?? item.option_label) },
        { label: 'תשובת אפשרות', value: formatHistoryValue(item.option_label) },
        { label: 'קלט חופשי', value: formatHistoryValue(item.user_input) },
        { label: 'מזהה בלוק', value: formatHistoryValue(item.block_id) },
        { label: 'בלוק key', value: formatHistoryValue(item.block_key) },
        { label: 'מזהה אפשרות', value: formatHistoryValue(item.selected_option_id) },
        { label: 'סוג אפשרות', value: formatHistoryValue(item.option_type) },
        { label: 'מזהה סשן', value: formatHistoryValue(item.session_id) },
        { label: 'זמן', value: formatHistoryValue(formatHistoryTimestamp(item.timestamp)) },
        { label: 'סטטוס משוב', value: formatHistoryValue(item.feedback_status) },
        { label: 'הודעת משוב', value: formatHistoryValue(item.feedback_message) },
        { label: 'מנע חזרה', value: item.prevent_rollback ? 'כן' : 'לא' },
        { label: 'פעיל', value: item.is_active ? 'כן' : 'לא' },
      ],
    }))
  }, [chatHistory, chatHistoryLoading])

  const questionnaireSections = useMemo(
    () => [...(user?.questionnaire ?? []), ...chatSections],
    [user, chatSections]
  )

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">תיק לקוח</h1>
        <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6">
          <p className="text-[var(--color-text-muted)]">הלקוח לא נמצא.</p>
          <div className="mt-4">
            <Link to="/users" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
              <AnimatedIcon icon={ArrowRight} size={16} variant="lift" />
              חזרה לרשימת לקוחות
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const openEdit = () => {
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
      status: user.status,
      mortgageType: user.mortgageType,
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    try {
      setEditSaving(true)
      const mortgageType = form.mortgageType === '-' ? '' : form.mortgageType
      await updateCustomer(user.id, {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim(),
        mail: form.email.trim(),
        status: form.status,
        mortgage_type: mortgageType,
      })
      setEditOpen(false)
    } catch {
      // Error toast is handled in the store.
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteCustomer = async () => {
    try {
      setDeleteSaving(true)
      await deleteUser(user.id)
      setDeleteOpen(false)
      navigate('/users')
    } catch {
      // Error toast is handled in the store.
    } finally {
      setDeleteSaving(false)
    }
  }

  const handleDownloadSessionPdf = async () => {
    if (!user) return
    setSignatureDownloadLoading(true)
    try {
      const { blob, filename } = await downloadUserSessionPdf(user.id, latestSessionInfo?.sessionId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`הקובץ הורד: ${filename}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהורדת הקובץ')
    } finally {
      setSignatureDownloadLoading(false)
    }
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim()

  return (
    <div className="space-y-4 sm:space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-right">
          <Link
            to="/users"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <AnimatedIcon icon={ArrowRight} size={16} variant="lift" />
            חזרה לרשימת לקוחות
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">תיק לקוח</h1>
          <p className="text-sm sm:text-base text-[var(--color-text-muted)]">{fullName}</p>
        </div>

        <div className="flex items-center gap-2 sm:self-start">
          <Button variant="outline" onClick={openEdit} className="flex-1 sm:flex-none">
            <AnimatedIcon icon={Pencil} size={18} variant="wiggle" />
            <span className="hidden sm:inline">עריכת פרטים</span>
            <span className="sm:hidden">עריכה</span>
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)} className="flex-1 sm:flex-none">
            <AnimatedIcon icon={Trash2} size={18} variant="pulse" />
            מחיקה
          </Button>
        </div>
      </div>

      {/* Lead info */}
      <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-5">
          <InfoTile label="שם" value={fullName} />
          <InfoTile label="טלפון" value={user.phone} valueDir="ltr" />
          <InfoTile label="אימייל" value={user.email} valueDir="ltr" />
          <InfoTile label="מסלול" value={user.mortgageType} />
          <InfoTile label="סטטוס לקוח" value={user.status} />
        </div>

        {/* Payment section */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border-light)]">
          <h3 className="text-sm font-bold text-[var(--color-text)] mb-3">תשלומים</h3>

          <div className="flex flex-col gap-3 bg-[var(--color-background)] rounded-xl p-3">
            {/* Payment form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Affiliate selection */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">מקור הליד</span>
                <DropdownSelect<string>
                  value={paymentForm.affiliateId}
                  onChange={(v) => setPaymentForm((p) => ({ ...p, affiliateId: v }))}
                  options={[
                    { value: 'organic', label: 'אורגני' },
                    ...affiliates.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                  buttonClassName="w-full justify-between bg-white text-xs"
                  contentAlign="end"
                />
              </div>

              {/* Payment amount */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">סכום (₪)</span>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                  placeholder="סכום"
                />
              </div>

              {/* Reference */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">מספר אסמכתא</span>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                  placeholder="אסמכתא"
                />
              </div>

              {/* Note */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">הערה</span>
                <input
                  type="text"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, note: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                  placeholder="הערה"
                />
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-start">
              <Button
                variant="accent"
                disabled={paymentForm.amount <= 0}
                onClick={() => {
                  const selectedAffiliate = affiliates.find((a) => a.id === paymentForm.affiliateId)
                  const newPayment = {
                    id: `${user.id}-pay-${Date.now()}`,
                    amount: paymentForm.amount,
                    affiliateId: paymentForm.affiliateId === 'organic' ? undefined : paymentForm.affiliateId,
                    affiliateName: paymentForm.affiliateId === 'organic' ? undefined : selectedAffiliate?.name,
                    reference: paymentForm.reference || undefined,
                    note: paymentForm.note || undefined,
                    createdAt: new Date().toISOString().slice(0, 10),
                  }
                  updateUser(user.id, {
                    payments: [newPayment, ...user.payments],
                    affiliateId: paymentForm.affiliateId === 'organic' ? undefined : paymentForm.affiliateId,
                    paymentAmount: (user.paymentAmount ?? 0) + paymentForm.amount,
                  } as Partial<UserRecord>)
                  setPaymentForm({ amount: 0, affiliateId: user.affiliateId ?? 'organic', reference: '', note: '' })
                  toast.success('התשלום נשמר בהצלחה')
                }}
              >
                <AnimatedIcon icon={Plus} size={18} variant="lift" />
                שמור תשלום
              </Button>
            </div>

            {/* Payments History Table */}
            {user.payments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border-light)]">
                <h4 className="text-sm font-bold text-[var(--color-text)] mb-3">היסטוריית תשלומים</h4>

                {/* Mobile Card View */}
                <div className="block sm:hidden space-y-2">
                  {user.payments.map((payment) => (
                    <div key={payment.id} className="rounded-lg border border-[var(--color-border-light)] bg-white p-3">
                      <div className="flex flex-row-reverse items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-sm font-semibold text-[var(--color-text)]">
                              {formatCurrencyILS(payment.amount)}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">{payment.createdAt}</span>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-1">
                            {payment.affiliateName ?? 'אורגני'}
                          </p>
                          {payment.reference && (
                            <p className="text-xs text-[var(--color-text-muted)]">אסמכתא: {payment.reference}</p>
                          )}
                          {payment.note && (
                            <p className="text-xs text-[var(--color-text-muted)]">הערה: {payment.note}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setDeleteConfirm({ open: true, type: 'clientPayment', id: payment.id })}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-danger)] hover:bg-red-50"
                          aria-label="מחיקה"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-[var(--color-border-light)]">
                  <table className="w-full text-sm" dir="rtl">
                    <thead>
                      <tr className="bg-white text-[var(--color-text-muted)]">
                        <th className="px-3 py-2 text-right font-medium">תאריך</th>
                        <th className="px-3 py-2 text-right font-medium">סכום</th>
                        <th className="px-3 py-2 text-right font-medium">אפילייט</th>
                        <th className="px-3 py-2 text-right font-medium">אסמכתא</th>
                        <th className="px-3 py-2 text-right font-medium">הערה</th>
                        <th className="px-3 py-2 text-center font-medium w-[60px]">מחיקה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.payments.map((payment) => (
                        <tr key={payment.id} className="border-t border-[var(--color-border-light)] bg-white">
                          <td className="px-3 py-2 text-[var(--color-text-muted)]">{payment.createdAt}</td>
                          <td className="px-3 py-2 font-medium text-[var(--color-text)]">
                            {formatCurrencyILS(payment.amount)}
                          </td>
                          <td className="px-3 py-2 text-[var(--color-text)]">{payment.affiliateName ?? 'אורגני'}</td>
                          <td className="px-3 py-2 text-[var(--color-text-muted)]">{payment.reference ?? '-'}</td>
                          <td className="px-3 py-2 text-[var(--color-text-muted)]">{payment.note ?? '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => setDeleteConfirm({ open: true, type: 'clientPayment', id: payment.id })}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-red-50 text-[var(--color-danger)]"
                              aria-label="מחיקה"
                              title="מחיקה"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <div className="flex w-full justify-center overflow-x-auto" dir="rtl">
          <Tabs.List
            dir="rtl"
            className="inline-flex rounded-full border border-[var(--color-border)] bg-white p-1 shadow-sm"
          >
            <Tabs.Trigger
              value="questionnaire"
              className="rounded-full px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] data-[state=active]:bg-[var(--color-background)] data-[state=active]:text-[var(--color-text)]"
            >
              שאלון
            </Tabs.Trigger>
            <Tabs.Trigger
              value="files"
              className="rounded-full px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] data-[state=active]:bg-[var(--color-background)] data-[state=active]:text-[var(--color-text)]"
            >
              קבצים
            </Tabs.Trigger>
            <Tabs.Trigger
              value="simulator"
              className="rounded-full px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] data-[state=active]:bg-[var(--color-background)] data-[state=active]:text-[var(--color-text)]"
            >
              סימולטור
            </Tabs.Trigger>
            <Tabs.Trigger
              value="updates"
              className="rounded-full px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] data-[state=active]:bg-[var(--color-background)] data-[state=active]:text-[var(--color-text)]"
            >
              עדכונים
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        <Tabs.Content value="questionnaire" className="mt-4 sm:mt-5">
          <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">שאלון</h2>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">תצוגה לקריאה בלבד.</p>

            <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-2">
              {questionnaireSections.map((section) => (
                <div
                  key={section.title}
                  className="rounded-2xl sm:rounded-3xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 sm:p-5"
                >
                  <h3 className="text-sm font-bold text-[var(--color-text)]">{section.title}</h3>
                  <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
                    {section.fields.map((f) => (
                      <div key={f.label} className="flex flex-row-reverse items-start justify-between gap-3 sm:gap-6">
                        <span className="text-xs sm:text-sm text-[var(--color-text-muted)] text-right">{f.label}</span>
                        <span className="text-xs sm:text-sm font-semibold text-[var(--color-text)] text-left" dir="rtl">
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="files" className="mt-4 sm:mt-5">
          <div className="space-y-4 sm:space-y-6">
            {/* 0) Bank visibility */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">בנקים להצגה ללקוח</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">
                    הסרת סימון מסתירה את הבנק מרשימת ההצעות של הלקוח.
                  </p>
                </div>
                {bankVisibilitySaving && (
                  <span className="text-xs text-[var(--color-text-muted)]">שומר...</span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {BANK_VISIBILITY_OPTIONS.map((bank) => (
                  <label
                    key={bank.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] px-3 py-2"
                  >
                    <span className="text-sm font-medium text-[var(--color-text)]">{bank.label}</span>
                    <input
                      type="checkbox"
                      checked={allowedBankIds.includes(bank.id)}
                      onChange={() => void toggleBankVisibility(bank.id)}
                      disabled={bankVisibilityLoading || bankVisibilitySaving}
                      className="h-4 w-4 rounded"
                      aria-label={`הצגת ${bank.label}`}
                    />
                  </label>
                ))}
              </div>

              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                {bankVisibilityLoading ? 'טוען הרשאות בנקים...' : 'העדכון נשמר אוטומטית.'}
              </p>
            </div>

            {/* 1) Uploaded files */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">קבצים שהלקוח העלה</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">תצוגה + הורדה.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFileUploadForm({ fileName: '', customName: '' })
                    setFileUploadOpen(true)
                  }}
                  className="w-full sm:w-auto"
                >
                  <AnimatedIcon icon={FileUp} size={18} variant="lift" />
                  העלאת קובץ
                </Button>
              </div>

              {/* Mobile Card View */}
              <div className="mt-4 sm:hidden space-y-3">
                {customerFilesLoading ? (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                    טוען קבצים...
                  </div>
                ) : user.uploadedFiles.length === 0 ? (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                    עדיין לא הועלו קבצים.
                  </div>
                ) : (
                  user.uploadedFiles.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 space-y-2"
                    >
                      <div className="flex flex-row-reverse items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 text-right">
                          {f.customName && (
                            <p className="text-sm font-semibold text-[var(--color-text)] truncate">{f.customName}</p>
                          )}
                          <p className={`text-[10px] text-[var(--color-text-muted)] ${f.customName ? 'mt-0.5' : ''}`} dir="ltr">{f.originalName}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">הועלה ע״י: {f.uploadedBy}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">תאריך: {f.uploadedAt}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => void handleCustomerFileView(f)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)]"
                            aria-label="צפייה"
                            title="צפייה"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => void handleCustomerFileDownload(f)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)]"
                            aria-label="הורדה"
                            title="הורדה"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View */}
              <div className="mt-4 hidden sm:block">
                {customerFilesLoading ? (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                    טוען קבצים...
                  </div>
                ) : user.uploadedFiles.length === 0 ? (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                    עדיין לא הועלו קבצים.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[var(--color-border-light)]">
                    <table className="w-full text-sm" dir="rtl">
                      <thead>
                        <tr className="bg-[var(--color-background)] text-[var(--color-text-muted)]">
                          <th className="px-4 py-3 text-right font-medium">שם קובץ</th>
                          <th className="px-4 py-3 text-right font-medium">שם מקורי</th>
                          <th className="px-4 py-3 text-right font-medium">הועלה ע״י</th>
                          <th className="px-4 py-3 text-right font-medium">תאריך העלאה</th>
                          <th className="px-4 py-3 text-center font-medium">צפייה</th>
                          <th className="px-4 py-3 text-center font-medium">הורדה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {user.uploadedFiles.map((f) => (
                          <tr key={f.id} className="border-t border-[var(--color-border-light)] bg-white">
                            <td className="px-4 py-3 font-medium text-[var(--color-text)]">{f.customName || '—'}</td>
                            <td className="px-4 py-3 text-[var(--color-text-muted)]" dir="ltr">{f.originalName}</td>
                            <td className="px-4 py-3 text-[var(--color-text)]">{f.uploadedBy}</td>
                            <td className="px-4 py-3 text-[var(--color-text-muted)]">{f.uploadedAt}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => void handleCustomerFileView(f)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)]"
                                aria-label="צפייה"
                                title="צפייה"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => void handleCustomerFileDownload(f)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)]"
                                aria-label="הורדה"
                                title="הורדה"
                              >
                                <Download size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 2) Signature docs */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-row-reverse items-center justify-between">
                <div className="text-right">
                  <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">קבצים לחתימה</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">סטטוס חתימה + שליחה חוזרת.</p>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="mt-4 space-y-3 sm:hidden">
                {user.signatureDocs.length === 0 ? (
                  <div className="rounded-xl bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                    אין מסמכים לחתימה כרגע.
                  </div>
                ) : (
                  user.signatureDocs.map((d) => {
                    return (
                      <div key={d.id} className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 space-y-3">
                        <div className="flex flex-row-reverse items-center gap-2">
                          {d.status === 'נחתם' ? (
                            <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                          ) : (
                            <CircleDashed className="h-4 w-4 text-[var(--color-text-light)]" />
                          )}
                          <span className="text-sm font-semibold text-[var(--color-text)]">{d.name}</span>
                        </div>
                        <div className="flex flex-row-reverse items-center justify-between gap-2">
                          <DropdownSelect<SignatureDocStatus>
                            value={d.status}
                            onChange={(v) => {
                              updateUser(user.id, {
                                signatureDocs: user.signatureDocs.map((x) =>
                                  x.id === d.id ? { ...x, status: v } : x
                                ),
                              } as Partial<UserRecord>)
                            }}
                            options={[
                              { value: 'נחתם', label: 'נחתם' },
                              { value: 'לא נחתם', label: 'לא נחתם' },
                            ]}
                            buttonClassName="min-w-[120px] justify-between bg-white text-xs"
                            contentAlign="end"
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                void handleSystemFileView(d.id)
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-white"
                              aria-label="צפייה"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => void handleSystemFileDownload(d.id, d.fileName || d.name)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-white"
                              aria-label="הורדה"
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Desktop Table View */}
              <div className="mt-4 hidden sm:block">
                {user.signatureDocs.length === 0 ? (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                    אין מסמכים לחתימה כרגע.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[var(--color-border-light)]">
                    <table className="w-full text-sm" dir="rtl">
                      <thead>
                        <tr className="bg-[var(--color-background)] text-[var(--color-text-muted)]">
                          <th className="px-4 py-3 text-right font-medium">מסמך</th>
                          <th className="px-4 py-3 text-right font-medium">סטטוס</th>
                          <th className="px-4 py-3 text-center font-medium">צפייה</th>
                          <th className="px-4 py-3 text-center font-medium">הורדה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {user.signatureDocs.map((d) => (
                          <tr key={d.id} className="border-t border-[var(--color-border-light)] bg-white">
                            <td className="px-4 py-3 font-medium text-[var(--color-text)] text-right">
                              <div className="flex w-full flex-row-reverse items-center justify-end gap-2">
                                {d.status === 'נחתם' ? (
                                  <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" />
                                ) : (
                                  <CircleDashed className="h-5 w-5 text-[var(--color-text-light)]" />
                                )}
                                <span>{d.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <DropdownSelect<SignatureDocStatus>
                                value={d.status}
                                onChange={(v) => {
                                  updateUser(user.id, {
                                    signatureDocs: user.signatureDocs.map((x) =>
                                      x.id === d.id ? { ...x, status: v } : x
                                    ),
                                  } as Partial<UserRecord>)
                                }}
                                options={[
                                  { value: 'נחתם', label: 'נחתם' },
                                  { value: 'לא נחתם', label: 'לא נחתם' },
                                ]}
                                buttonClassName="min-w-[120px] justify-between bg-[var(--color-background)]"
                                contentAlign="end"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  void handleSystemFileView(d.id)
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)]"
                                aria-label="צפייה במסמך"
                                title="צפייה"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => void handleSystemFileDownload(d.id, d.fileName || d.name)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)]"
                                aria-label="הורדת מסמך"
                                title="הורדה"
                              >
                                <Download size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 3) Bank files */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">קבצי בנק</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">העלאה, צפייה בנתונים שחולצו ומחיקה.</p>
                </div>

              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setBankUploadForm({
                    bank: 'לאומי',
                    fileName: '',
                    customName: '',
                    amount: '',
                    file: null,
                    processType: resolveProcessType(user?.mortgageType),
                  })
                  setBankUploadOpen(true)
                }}
              >
                <AnimatedIcon icon={FileUp} size={18} variant="lift" />
                העלאת קובץ
              </Button>
            </div>

            {/* Mobile Card View */}
              <div className="mt-4 space-y-3 sm:hidden">
                {bankResponsesLoading ? (
                  <div className="rounded-xl bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                    טוען קבצי בנק...
                  </div>
                ) : user.bankResponses.length === 0 ? (
                  <div className="rounded-xl bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                    אין קבצי בנק עדיין.
                  </div>
                ) : (
                  user.bankResponses.map((r) => (
                    <div key={r.id} className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 space-y-2">
                      <div className="flex flex-row-reverse items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--color-text)] truncate">{r.fileName}</p>
                          <span className="inline-flex mt-1 rounded-full bg-white border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text)]">
                            {r.bank}
                          </span>
                        </div>
                        <button
                          onClick={() => setDeleteConfirm({ open: true, type: 'bankResponse', id: r.id })}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-danger)] hover:bg-red-50"
                          aria-label="מחיקה"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex flex-row-reverse items-center gap-2">
                        <button
                          onClick={() => handleBankResponseView(r)}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-border-light)]"
                        >
                          <Eye size={14} />
                          פתח קובץ
                        </button>
                        <button
                          onClick={() => {
                            setViewBankData(r)
                            setViewBankDataOpen(true)
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-border-light)]"
                        >
                          <Eye size={14} />
                          נתונים שחולצו
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View */}
              <div className="mt-4 hidden sm:block">
                {bankResponsesLoading ? (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                    טוען קבצי בנק...
                  </div>
                ) : user.bankResponses.length === 0 ? (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                    אין קבצי בנק עדיין.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[var(--color-border-light)]">
                    <table className="w-full text-sm" dir="rtl">
                      <thead>
                        <tr className="bg-[var(--color-background)] text-[var(--color-text-muted)]">
                          <th className="px-4 py-3 text-right font-medium">שם הקובץ</th>
                          <th className="px-4 py-3 text-right font-medium">בנק</th>
                          <th className="px-4 py-3 text-center font-medium">פתיחת קובץ</th>
                          <th className="px-4 py-3 text-center font-medium">נתונים שחולצו</th>
                          <th className="px-4 py-3 text-center font-medium">מחיקה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {user.bankResponses.map((r) => (
                          <tr key={r.id} className="border-t border-[var(--color-border-light)] bg-white">
                            <td className="px-4 py-3 font-medium text-[var(--color-text)]">{r.fileName}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-full bg-[var(--color-background)] border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-text)]">
                                {r.bank}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleBankResponseView(r)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)] text-[var(--color-primary)]"
                                aria-label="פתח קובץ"
                                title="פתח קובץ"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  setViewBankData(r)
                                  setViewBankDataOpen(true)
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)] text-[var(--color-text)]"
                                aria-label="צפייה בנתונים"
                                title="צפייה בנתונים שחולצו"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setDeleteConfirm({ open: true, type: 'bankResponse', id: r.id })}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-red-50 text-[var(--color-danger)]"
                                aria-label="מחיקה"
                                title="מחיקה"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 4) System files */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">קבצי מערכת</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">מסמכים שנוצרו בסיום השיחה.</p>
                </div>
              </div>

              <div className="mt-4">
                {chatHistoryLoading || customerFilesLoading ? (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                    טוען קבצי מערכת...
                  </div>
                ) : !latestSessionInfo && systemFiles.length === 0 ? (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                    אין קבצי מערכת זמינים מהשיחה.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {latestSessionInfo ? (
                      <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[var(--color-text)]">מסמך מהשיחה</p>
                            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]" dir="ltr">
                              {`session_${latestSessionInfo.sessionId}.pdf`}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              עודכן: {formatHistoryTimestamp(latestSessionInfo.timestamp)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadSessionPdf}
                            disabled={signatureDownloadLoading}
                            className="w-full sm:w-auto"
                          >
                            <Download size={16} />
                            {signatureDownloadLoading ? 'מוריד...' : 'הורדה'}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {systemFiles.map((file) => (
                      <div
                        key={file.id}
                        className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 sm:p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[var(--color-text)]">חתימה דיגיטלית</p>
                            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]" dir="ltr">
                              {file.originalName}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              עודכן: {file.uploadedAt}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSystemFileView(file.id)}
                              className="w-full sm:w-auto"
                            >
                              <Eye size={16} />
                              צפייה
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSystemFileDownload(file.id, file.originalName)}
                              className="w-full sm:w-auto"
                            >
                              <Download size={16} />
                              הורדה
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="simulator" className="mt-4 sm:mt-5">
          <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">סימולטור</h2>
                <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">
                  ניהול הצעות מבנקים שונים והצעה נבחרת.
                </p>
              </div>

              <div className="flex flex-row-reverse gap-2">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => {
                    const simId = `${user.id}-so-${Date.now()}`
                    updateUser(user.id, {
                      simulatorOffers: [
                        {
                          id: simId,
                          bank: simulatorTab,
                          track: 'מסלול חדש',
                          amount: 200000,
                          rate: 4.0,
                          years: 20,
                        },
                        ...user.simulatorOffers,
                      ],
                    } as Partial<UserRecord>)
                    toast.success('נוסף מסלול')
                  }}
                >
                  <AnimatedIcon icon={Plus} size={18} variant="lift" />
                  <span className="hidden sm:inline">הוספת מסלול</span>
                  <span className="sm:hidden">הוסף</span>
                </Button>
                <Button
                  variant="accent"
                  className="flex-1 sm:flex-none"
                  disabled={calcLoading}
                  onClick={() => {
                    setCalcLoading(true)
                    setTimeout(() => {
                      toast.success('חישוב עודכן')
                      setCalcLoading(false)
                    }, 700)
                  }}
                >
                  <AnimatedIcon icon={Calculator} size={18} variant="lift" />
                  חשב
                </Button>
              </div>
            </div>

            {/* Simulator Tabs */}
            <div className="mt-4 flex flex-wrap gap-2" dir="rtl">
              {(['לאומי', 'מזרחי-טפחות', 'הצעה נבחרת'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSimulatorTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    simulatorTab === tab
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-border-light)]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Filtered offers for current tab */}
            {(() => {
              const filteredOffers = user.simulatorOffers.filter((o) => o.bank === simulatorTab)
              return (
                <>
                  {/* Mobile Card View for Simulator */}
                  <div className="mt-4 space-y-3 sm:hidden">
                    {filteredOffers.length === 0 ? (
                      <div className="rounded-xl bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                        אין מסלולים עדיין עבור {simulatorTab}. הוסיפו מסלול כדי להתחיל.
                      </div>
                    ) : (
                      filteredOffers.map((row) => (
                        <div key={row.id} className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 space-y-3">
                          <div className="flex flex-row-reverse items-start justify-between gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-[var(--color-text-muted)]">מסלול</label>
                              <input
                                value={row.track}
                                onChange={(e) =>
                                  updateUser(user.id, {
                                    simulatorOffers: user.simulatorOffers.map((r) => (r.id === row.id ? { ...r, track: e.target.value } : r)),
                                  } as Partial<UserRecord>)
                                }
                                className="mt-1 h-9 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-xs outline-none"
                              />
                            </div>
                            <button
                              onClick={() => setDeleteConfirm({ open: true, type: 'simulatorOffer', id: row.id })}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-danger)] hover:bg-red-50"
                              aria-label="מחיקה"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-[var(--color-text-muted)]">סכום</label>
                              <input
                                value={row.amount}
                                onChange={(e) =>
                                  updateUser(user.id, {
                                    simulatorOffers: user.simulatorOffers.map((r) => (r.id === row.id ? { ...r, amount: Number(e.target.value || 0) } : r)),
                                  } as Partial<UserRecord>)
                                }
                                type="number"
                                className="mt-1 h-9 w-full rounded-xl border border-[var(--color-border)] bg-white px-2 text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[var(--color-text-muted)]">ריבית %</label>
                              <input
                                value={row.rate}
                                onChange={(e) =>
                                  updateUser(user.id, {
                                    simulatorOffers: user.simulatorOffers.map((r) => (r.id === row.id ? { ...r, rate: Number(e.target.value || 0) } : r)),
                                  } as Partial<UserRecord>)
                                }
                                type="number"
                                step="0.01"
                                className="mt-1 h-9 w-full rounded-xl border border-[var(--color-border)] bg-white px-2 text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[var(--color-text-muted)]">שנים</label>
                              <input
                                value={row.years}
                                onChange={(e) =>
                                  updateUser(user.id, {
                                    simulatorOffers: user.simulatorOffers.map((r) => (r.id === row.id ? { ...r, years: Number(e.target.value || 0) } : r)),
                                  } as Partial<UserRecord>)
                                }
                                type="number"
                                className="mt-1 h-9 w-full rounded-xl border border-[var(--color-border)] bg-white px-2 text-xs outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop Table View for Simulator */}
                  <div className="mt-4 hidden sm:block">
                    {filteredOffers.length === 0 ? (
                      <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                        אין מסלולים עדיין עבור {simulatorTab}. הוסיפו מסלול כדי להתחיל.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-[var(--color-border-light)]">
                        <table className="w-full text-sm" dir="rtl">
                          <thead>
                            <tr className="bg-[var(--color-background)] text-[var(--color-text-muted)]">
                              <th className="px-4 py-3 text-right font-medium">מסלול</th>
                              <th className="px-4 py-3 text-right font-medium">סכום</th>
                              <th className="px-4 py-3 text-right font-medium">ריבית (%)</th>
                              <th className="px-4 py-3 text-right font-medium">שנים</th>
                              <th className="px-4 py-3 text-center font-medium w-[70px]">מחיקה</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOffers.map((row) => (
                              <tr key={row.id} className="border-t border-[var(--color-border-light)] bg-white">
                                <td className="px-4 py-3">
                                  <input
                                    value={row.track}
                                    onChange={(e) =>
                                      updateUser(user.id, {
                                        simulatorOffers: user.simulatorOffers.map((r) => (r.id === row.id ? { ...r, track: e.target.value } : r)),
                                      } as Partial<UserRecord>)
                                    }
                                    className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    value={row.amount}
                                    onChange={(e) =>
                                      updateUser(user.id, {
                                        simulatorOffers: user.simulatorOffers.map((r) => (r.id === row.id ? { ...r, amount: Number(e.target.value || 0) } : r)),
                                      } as Partial<UserRecord>)
                                    }
                                    type="number"
                                    className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    value={row.rate}
                                    onChange={(e) =>
                                      updateUser(user.id, {
                                        simulatorOffers: user.simulatorOffers.map((r) => (r.id === row.id ? { ...r, rate: Number(e.target.value || 0) } : r)),
                                      } as Partial<UserRecord>)
                                    }
                                    type="number"
                                    step="0.01"
                                    className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    value={row.years}
                                    onChange={(e) =>
                                      updateUser(user.id, {
                                        simulatorOffers: user.simulatorOffers.map((r) => (r.id === row.id ? { ...r, years: Number(e.target.value || 0) } : r)),
                                      } as Partial<UserRecord>)
                                    }
                                    type="number"
                                    className="h-10 w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => setDeleteConfirm({ open: true, type: 'simulatorOffer', id: row.id })}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-red-50 text-[var(--color-danger)]"
                                    aria-label="מחיקה"
                                    title="מחיקה"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}

            {/* Result panel (demo aggregation) */}
            <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-2xl sm:rounded-3xl bg-[var(--color-background)] p-4 sm:p-5">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--color-text)]">תוצאה (דמו)</h3>
                <p className="mt-1 text-[10px] sm:text-sm text-[var(--color-text-muted)]">
                  תוצאה מוצגת לפי סליידרים (לצורך UI). בהמשך יוחלף בחישוב API.
                </p>
                <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-2 sm:gap-4 md:grid-cols-3">
                  <InfoTile label="החזר חודשי משוער" value={formatCurrencyILS(Math.round(monthly))} />
                  <InfoTile label="סה״כ תשלומים" value={formatCurrencyILS(Math.round(totalPaid))} />
                  <InfoTile label="סה״כ ריבית" value={formatCurrencyILS(Math.round(totalInterest))} />
                </div>
              </div>
              <div className="rounded-2xl sm:rounded-3xl bg-[var(--color-background)] p-4 sm:p-5 text-right" dir="rtl">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--color-text)]">פרמטרים (דמו)</h3>
                <div className="mt-3 sm:mt-4 space-y-4 sm:space-y-5">
                  <div>
                    <div className="flex flex-row-reverse items-center justify-between">
                      <p className="text-xs sm:text-sm font-semibold text-[var(--color-text)]">סכום הלוואה</p>
                      <p dir="ltr" className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                        {formatCurrencyILS(loanAmount)}
                      </p>
                    </div>
                    <Slider.Root
                      dir="rtl"
                      value={[loanAmount]}
                      onValueChange={(v) => setLoanAmount(v[0] ?? loanAmount)}
                      min={200000}
                      max={2000000}
                      step={10000}
                      className="relative mt-2 sm:mt-3 flex h-5 w-full items-center"
                    >
                      <Slider.Track className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-border-light)]">
                        <Slider.Range className="absolute h-full bg-[var(--color-primary)]" />
                      </Slider.Track>
                      <Slider.Thumb className="block h-5 w-5 rounded-full border border-[var(--color-border)] bg-white shadow-sm" />
                    </Slider.Root>
                  </div>

                  <div>
                    <div className="flex flex-row-reverse items-center justify-between">
                      <p className="text-xs sm:text-sm font-semibold text-[var(--color-text)]">תקופה (שנים)</p>
                      <p dir="ltr" className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                        {loanYears} שנים
                      </p>
                    </div>
                    <Slider.Root
                      dir="rtl"
                      value={[loanYears]}
                      onValueChange={(v) => setLoanYears(v[0] ?? loanYears)}
                      min={5}
                      max={35}
                      step={1}
                      className="relative mt-2 sm:mt-3 flex h-5 w-full items-center"
                    >
                      <Slider.Track className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-border-light)]">
                        <Slider.Range className="absolute h-full bg-[var(--color-primary)]" />
                      </Slider.Track>
                      <Slider.Thumb className="block h-5 w-5 rounded-full border border-[var(--color-border)] bg-white shadow-sm" />
                    </Slider.Root>
                  </div>

                  <div>
                    <div className="flex flex-row-reverse items-center justify-between">
                      <p className="text-xs sm:text-sm font-semibold text-[var(--color-text)]">ריבית שנתית</p>
                      <p dir="ltr" className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                        {rate.toFixed(1)}%
                      </p>
                    </div>
                    <Slider.Root
                      dir="rtl"
                      value={[rate]}
                      onValueChange={(v) => setRate(v[0] ?? rate)}
                      min={0.5}
                      max={8.5}
                      step={0.1}
                      className="relative mt-2 sm:mt-3 flex h-5 w-full items-center"
                    >
                      <Slider.Track className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-border-light)]">
                        <Slider.Range className="absolute h-full bg-[var(--color-accent)]" />
                      </Slider.Track>
                      <Slider.Thumb className="block h-5 w-5 rounded-full border border-[var(--color-border)] bg-white shadow-sm" />
                    </Slider.Root>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Tabs.Content>

        {/* Updates Tab */}
        <Tabs.Content value="updates" className="mt-4 sm:mt-5">
          <div className="space-y-4 sm:space-y-6">
            {/* Send Update Section */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={20} className="text-[var(--color-primary)]" />
                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">שליחת עדכון ללקוח</h2>
              </div>
              
              <div className="space-y-4">
                <div className="text-right">
                  <label className="text-sm font-medium text-[var(--color-text)]">בחירת תבנית</label>
                  <div className="mt-2">
                    <DropdownSelect<string>
                      value={selectedTemplateId}
                      onChange={setSelectedTemplateId}
                      options={[
                        { value: '', label: 'בחרו תבנית...' },
                        ...templates.map((t) => ({ value: t.id, label: t.name })),
                      ]}
                      buttonClassName="w-full justify-between flex-row-reverse text-right"
                    />
                  </div>
                </div>

                {selectedTemplate && (
                  <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        {selectedTemplate.trigger}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
                      {selectedTemplate.message.replace('{שם}', `${user.firstName} ${user.lastName}`)}
                    </p>
                  </div>
                )}

                <div className="flex justify-start">
                  <Button
                    variant="accent"
                    disabled={!selectedTemplateId}
                    onClick={async () => {
                      if (!user || !selectedTemplate) return
                      try {
                        const payloadMessage = selectedTemplate.message.replace(
                          '{שם}',
                          `${user.firstName} ${user.lastName}`
                        )
                        const saved = await createNotificationForUser(user.id, {
                          message: payloadMessage,
                          templateId: selectedTemplate.id,
                          templateName: selectedTemplate.name,
                        })
                        const newMessage: SentMessage = mapNotificationToSentMessage(saved)
                        updateUser(user.id, {
                          sentMessages: [newMessage, ...(user.sentMessages || [])],
                        } as Partial<UserRecord>)
                        setSelectedTemplateId('')
                        toast.success('ההודעה נשלחה בהצלחה')
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'שגיאה בשליחת הודעה')
                      }
                    }}
                  >
                    <AnimatedIcon icon={Send} size={18} variant="lift" />
                    שלח עדכון
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages History */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">היסטוריית הודעות</h2>
              <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">הודעות שנשלחו ללקוח.</p>

              {(!user.sentMessages || user.sentMessages.length === 0) ? (
                <div className="mt-4 text-center py-8 text-sm text-[var(--color-text-muted)]">
                  אין הודעות שנשלחו ללקוח זה.
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block sm:hidden mt-4 space-y-3">
                    {user.sentMessages.map((msg) => (
                      <div key={msg.id} className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3">
                        <div className="flex flex-row-reverse items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-sm font-semibold text-[var(--color-text)]">{msg.templateName}</span>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                              {new Date(msg.sentAt).toLocaleDateString('he-IL')} {new Date(msg.sentAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-2 line-clamp-2">{msg.message}</p>
                            <div className="mt-2 flex items-center gap-1 justify-end">
                              {msg.readAt ? (
                                <>
                                  <CheckCheck size={14} className="text-[var(--color-success)]" />
                                  <span className="text-xs text-[var(--color-success)]">
                                    נקרא {new Date(msg.readAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Clock size={14} className="text-[var(--color-text-muted)]" />
                                  <span className="text-xs text-[var(--color-text-muted)]">לא נקרא</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteMessageConfirm({ open: true, messageId: msg.id })}
                            className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                            aria-label="מחיקה"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden sm:block mt-4 overflow-x-auto">
                    <table className="w-full text-sm" dir="rtl">
                      <thead>
                        <tr className="border-b border-[var(--color-border-light)] text-[var(--color-text-muted)]">
                          <th className="px-3 py-3 text-right font-medium">תאריך</th>
                          <th className="px-3 py-3 text-right font-medium">תבנית</th>
                          <th className="px-3 py-3 text-right font-medium">הודעה</th>
                          <th className="px-3 py-3 text-right font-medium">סטטוס קריאה</th>
                          <th className="px-3 py-3 text-right font-medium w-16">מחיקה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {user.sentMessages.map((msg) => (
                          <tr key={msg.id} className="border-b border-[var(--color-border-light)] last:border-0">
                            <td className="px-3 py-3 text-[var(--color-text-muted)] whitespace-nowrap">
                              {new Date(msg.sentAt).toLocaleDateString('he-IL')}
                              <br />
                              <span className="text-xs">{new Date(msg.sentAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                            </td>
                            <td className="px-3 py-3 font-medium text-[var(--color-text)]">{msg.templateName}</td>
                            <td className="px-3 py-3 text-[var(--color-text-muted)] max-w-xs truncate">{msg.message}</td>
                            <td className="px-3 py-3">
                              {msg.readAt ? (
                                <div className="flex items-center gap-1 text-[var(--color-success)]">
                                  <CheckCheck size={16} />
                                  <span className="text-xs">נקרא {new Date(msg.readAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                                  <Clock size={16} />
                                  <span className="text-xs">לא נקרא</span>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <button
                                onClick={() => setDeleteMessageConfirm({ open: true, messageId: msg.id })}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                                aria-label="מחיקה"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {/* Edit modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת פרטי לקוח</DialogTitle>
            <DialogDescription>העדכון נשמר בשרת ויתעדכן ברשימה.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">שם פרטי</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">שם משפחה</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">טלפון</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">אימייל</label>
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">מסלול</label>
              <div className="mt-2">
                <DropdownSelect<MortgageType>
                  value={form.mortgageType}
                  onChange={(v) => setForm((p) => ({ ...p, mortgageType: v }))}
                  options={[
                    { value: '-', label: '-' },
                    { value: 'משכנתא חדשה', label: 'משכנתא חדשה' },
                    { value: 'מחזור משכנתא', label: 'מחזור משכנתא' },
                  ]}
                  buttonClassName="w-full justify-between bg-white"
                  className="w-full"
                  contentAlign="end"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">סטטוס</label>
              <div className="mt-2">
                <DropdownSelect<LeadStatus>
                  value={form.status}
                  onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                  options={[
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
                    { value: 'מחזור - ניטור', label: 'מחזור - ניטור' },
                  ]}
                  buttonClassName="w-full justify-between bg-white"
                  className="w-full"
                  contentAlign="end"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="w-full sm:w-auto">ביטול</Button>
            <Button variant="accent" onClick={saveEdit} className="w-full sm:w-auto" disabled={editSaving}>
              {editSaving ? 'שומר...' : 'שמירה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מחיקת לקוח</DialogTitle>
            <DialogDescription>
              אתם בטוחים שברצונכם למחוק את {fullName}? פעולה זו מוחקת גם שיחות, תהליכים וקבצים ואינה ניתנת לביטול.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="w-full sm:w-auto">ביטול</Button>
            <Button
              variant="danger"
              className="w-full sm:w-auto"
              onClick={handleDeleteCustomer}
              disabled={deleteSaving}
            >
              {deleteSaving ? 'מוחק...' : 'מחיקה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation for bank responses, simulator offers, and payments */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, type: null, id: null })}
        title={
          deleteConfirm.type === 'bankResponse'
            ? 'מחיקת תשובת בנק'
            : deleteConfirm.type === 'clientPayment'
            ? 'מחיקת תשלום'
            : 'מחיקת מסלול'
        }
        description={
          deleteConfirm.type === 'bankResponse'
            ? 'האם אתה בטוח שברצונך למחוק את תשובת הבנק? פעולה זו אינה ניתנת לביטול.'
            : deleteConfirm.type === 'clientPayment'
            ? 'האם אתה בטוח שברצונך למחוק את התשלום? פעולה זו אינה ניתנת לביטול.'
            : 'האם אתה בטוח שברצונך למחוק את המסלול? פעולה זו אינה ניתנת לביטול.'
        }
        confirmText="מחיקה"
        onConfirm={() => {
          if (deleteConfirm.id && deleteConfirm.type === 'bankResponse') {
            updateUser(user.id, {
              bankResponses: user.bankResponses.filter((x) => x.id !== deleteConfirm.id),
            } as Partial<UserRecord>)
            toast.success('נמחק')
          } else if (deleteConfirm.id && deleteConfirm.type === 'simulatorOffer') {
            updateUser(user.id, {
              simulatorOffers: user.simulatorOffers.filter((x) => x.id !== deleteConfirm.id),
            } as Partial<UserRecord>)
            toast.success('נמחק')
          } else if (deleteConfirm.id && deleteConfirm.type === 'clientPayment') {
            const paymentToDelete = user.payments.find((p) => p.id === deleteConfirm.id)
            updateUser(user.id, {
              payments: user.payments.filter((x) => x.id !== deleteConfirm.id),
              paymentAmount: Math.max(0, (user.paymentAmount ?? 0) - (paymentToDelete?.amount ?? 0)),
            } as Partial<UserRecord>)
            toast.success('התשלום נמחק')
          }
        }}
      />

      {/* Delete message confirmation */}
      <ConfirmDialog
        open={deleteMessageConfirm.open}
        onOpenChange={(open) => setDeleteMessageConfirm({ open, messageId: null })}
        title="מחיקת הודעה"
        description="האם אתה בטוח שברצונך למחוק את ההודעה מההיסטוריה? פעולה זו אינה ניתנת לביטול."
        confirmText="מחיקה"
        onConfirm={() => {
          if (!deleteMessageConfirm.messageId || !user) return
          deleteNotification(deleteMessageConfirm.messageId)
            .then(() => {
              updateUser(user.id, {
                sentMessages: (user.sentMessages || []).filter((m) => m.id !== deleteMessageConfirm.messageId),
              } as Partial<UserRecord>)
              toast.success('ההודעה נמחקה')
            })
            .catch((error) => {
              toast.error(error instanceof Error ? error.message : 'שגיאה במחיקת הודעה')
            })
        }}
      />

      {/* Upload bank file modal */}
      <Dialog open={bankUploadOpen} onOpenChange={setBankUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>העלאת קובץ בנק</DialogTitle>
            <DialogDescription>בחרו בנק והעלו את הקובץ.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">שם הקובץ</label>
              <input
                type="text"
                value={bankUploadForm.customName}
                onChange={(e) => setBankUploadForm((p) => ({ ...p, customName: e.target.value }))}
                placeholder="לדוגמה: אישור עקרוני דצמבר 2024"
                className="mt-2 w-full h-11 rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">בחירת בנק</label>
              <div className="mt-2">
                <DropdownSelect<BankName>
                  value={bankUploadForm.bank}
                  onChange={(v) => setBankUploadForm((p) => ({ ...p, bank: v }))}
                  options={[
                    { value: 'לאומי', label: 'לאומי' },
                    { value: 'הפועלים', label: 'הפועלים' },
                    { value: 'דיסקונט', label: 'דיסקונט' },
                    { value: 'מזרחי-טפחות', label: 'מזרחי-טפחות' },
                    { value: 'הבינלאומי', label: 'הבינלאומי' },
                    { value: 'מרכנתיל', label: 'מרכנתיל' },
                  ]}
                  buttonClassName="w-full justify-between bg-white"
                  contentAlign="end"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">סוג תהליך</label>
              <div className="mt-2">
                <DropdownSelect<BankProcessType>
                  value={bankUploadForm.processType}
                  onChange={(v) => setBankUploadForm((p) => ({ ...p, processType: v }))}
                  options={[
                    { value: 'new_loan', label: 'משכנתא חדשה (אישור עקרוני)' },
                    { value: 'recycle', label: 'מחזור משכנתא (דוח יתרות)' },
                  ]}
                  buttonClassName="w-full justify-between bg-white"
                  contentAlign="end"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">סכום משכנתא</label>
              <input
                type="text"
                inputMode="numeric"
                value={bankUploadForm.amount}
                onChange={(e) => setBankUploadForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="לדוגמה: 1,250,000"
                className="mt-2 w-full h-11 rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">קובץ</label>
              <div className="mt-2">
                <div className="relative rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-background)] p-6 text-center">
                  <AnimatedIcon icon={FileUp} size={32} variant="lift" className="mx-auto text-[var(--color-text-muted)]" />
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    {bankUploadForm.fileName || 'גרור קובץ לכאן או לחץ לבחירה'}
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setBankUploadForm((p) => ({ ...p, fileName: file.name, file }))
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setBankUploadOpen(false)} className="w-full sm:w-auto">ביטול</Button>
            <Button
              variant="accent"
              disabled={!bankUploadForm.file || !bankUploadForm.customName.trim() || !bankUploadForm.amount.trim() || uploadingBankFile}
              className="w-full sm:w-auto"
              onClick={handleBankUpload}
            >
              {uploadingBankFile ? 'מעלה...' : 'העלאה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View bank data modal */}
      <Dialog open={viewBankDataOpen} onOpenChange={setViewBankDataOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>נתוני תשובת בנק</DialogTitle>
            <DialogDescription>
              {viewBankData?.fileName} • {viewBankData?.bank}
            </DialogDescription>
          </DialogHeader>

          {viewBankData ? (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
              {/* General info - Key-Value Table */}
              <div className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden">
                <div className="bg-[var(--color-background)] px-4 py-3 border-b border-[var(--color-border)]">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">פרטים כלליים</h3>
                </div>
                <table className="w-full text-sm" dir="rtl">
                  <tbody>
                    <tr className="border-b border-[var(--color-border-light)]">
                      <td className="px-4 py-3 bg-[var(--color-background)] font-medium text-[var(--color-text)] w-1/3">בנק</td>
                      <td className="px-4 py-3 text-[var(--color-text)]">
                        {viewBankData.extractedJson?.data?.bank_title || viewBankData.bank}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--color-border-light)]">
                      <td className="px-4 py-3 bg-[var(--color-background)] font-medium text-[var(--color-text)]">תאריך אישור</td>
                      <td className="px-4 py-3 text-[var(--color-text)]">
                        {viewBankData.extractedJson?.data?.approval_date || '—'}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--color-border-light)]">
                      <td className="px-4 py-3 bg-[var(--color-background)] font-medium text-[var(--color-text)]">תאריך תפוגה</td>
                      <td className="px-4 py-3 text-[var(--color-text)]">
                        {viewBankData.extractedJson?.data?.expiration_date || '—'}
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--color-border-light)]">
                      <td className="px-4 py-3 bg-[var(--color-background)] font-medium text-[var(--color-text)]">מטרה</td>
                      <td className="px-4 py-3 text-[var(--color-text)]">
                        {viewBankData.extractedJson?.data?.purpose || '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 bg-[var(--color-background)] font-medium text-[var(--color-text)]">סוג מטרה</td>
                      <td className="px-4 py-3 text-[var(--color-text)]">
                        {viewBankData.extractedJson?.data?.purpose_type ?? '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tracks table */}
              <div className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden">
                <div className="bg-[var(--color-background)] px-4 py-3 border-b border-[var(--color-border)]">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    מסלולים ({viewBankData.extractedJson?.data?.tracks?.length || 0})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" dir="rtl">
                    <thead>
                      <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-background)] text-[var(--color-text-muted)]">
                        <th className="px-3 py-2 text-right font-medium">סוג מסלול</th>
                        <th className="px-3 py-2 text-right font-medium">סכום</th>
                        <th className="px-3 py-2 text-right font-medium">תקופה (חודשים)</th>
                        <th className="px-3 py-2 text-right font-medium">ריבית</th>
                        <th className="px-3 py-2 text-right font-medium">עוגן</th>
                        <th className="px-3 py-2 text-right font-medium">תוספת לריבית</th>
                        <th className="px-3 py-2 text-right font-medium">תדירות שינוי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewBankData.extractedJson?.data?.tracks && viewBankData.extractedJson.data.tracks.length > 0 ? (
                        viewBankData.extractedJson.data.tracks.map((track, idx) => (
                          <tr key={idx} className="border-b border-[var(--color-border-light)] last:border-0">
                            <td className="px-3 py-3 font-medium text-[var(--color-text)]">
                              {loanTypeLabels[track.loan_type] || `סוג ${track.loan_type}`}
                            </td>
                            <td className="px-3 py-3 text-[var(--color-text)]">
                              {formatCurrencyILS(track.loan_value)}
                            </td>
                            <td className="px-3 py-3 text-[var(--color-text)]">
                              {track.loan_years}
                            </td>
                            <td className="px-3 py-3 text-[var(--color-text)]">
                              {typeof track.loan_interest === 'number' ? track.loan_interest.toFixed(2) : track.loan_interest}%
                            </td>
                            <td className="px-3 py-3 text-[var(--color-text)]">
                              {typeof track.anchor === 'number' ? track.anchor.toFixed(2) : track.anchor}%
                            </td>
                            <td className="px-3 py-3 text-[var(--color-text)]">
                              {track.addition_to_interest === '' || track.addition_to_interest === 0
                                ? '—'
                                : typeof track.addition_to_interest === 'number'
                                  ? `${track.addition_to_interest.toFixed(2)}%`
                                  : track.addition_to_interest}
                            </td>
                            <td className="px-3 py-3 text-[var(--color-text)]">
                              {track.change_frequency === '' || track.change_frequency === 0
                                ? '—'
                                : track.change_frequency}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                            אין מסלולים להצגה
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-[var(--color-text-muted)]">
              אין נתונים להצגה
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setViewBankDataOpen(false)}>סגור</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client file upload dialog */}
      <Dialog open={fileUploadOpen} onOpenChange={setFileUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>העלאת קובץ</DialogTitle>
            <DialogDescription>בחר קובץ והגדר שם</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Custom name input */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">שם קובץ</label>
              <input
                type="text"
                value={fileUploadForm.customName}
                onChange={(e) => setFileUploadForm((prev) => ({ ...prev, customName: e.target.value }))}
                placeholder="לדוגמה: תלוש שכר דצמבר 2024"
                className="w-full h-11 rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>

            {/* File input */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">קובץ</label>
              <div className="relative">
                <input
                  type="file"
                  id="client-file-upload"
                  className="sr-only"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setFileUploadForm((prev) => ({ ...prev, fileName: file.name }))
                    }
                  }}
                />
                <label
                  htmlFor="client-file-upload"
                  className="flex items-center justify-center gap-2 w-full h-24 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-background)] cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                >
                  {fileUploadForm.fileName ? (
                    <div className="text-center">
                      <CheckCircle2 className="h-6 w-6 mx-auto text-[var(--color-success)] mb-1" />
                      <span className="text-sm font-medium text-[var(--color-text)]">{fileUploadForm.fileName}</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <UploadCloud className="h-6 w-6 mx-auto text-[var(--color-text-muted)] mb-1" />
                      <span className="text-sm text-[var(--color-text-muted)]">לחץ לבחירת קובץ</span>
                    </div>
                  )}
                </label>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">PDF, DOC, DOCX, JPG, PNG</p>
            </div>

            {/* Admin info */}
            <div className="text-xs text-[var(--color-text-muted)] text-right">
              יועלה ע״י: <strong className="text-[var(--color-text)]">{currentAdmin.name}</strong>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setFileUploadOpen(false)}>ביטול</Button>
            <Button
              variant="accent"
              disabled={!fileUploadForm.fileName || uploadingFile}
              className="w-full sm:w-auto"
              onClick={() => {
                setUploadingFile(true)
                setTimeout(() => {
                  const fileId = `${user.id}-file-${Date.now()}`
                  updateUser(user.id, {
                    uploadedFiles: [
                      {
                        id: fileId,
                        originalName: fileUploadForm.fileName,
                        customName: fileUploadForm.customName.trim() || undefined,
                        uploadedBy: currentAdmin.name,
                        uploadedAt: new Date().toISOString().slice(0, 10),
                      },
                      ...user.uploadedFiles,
                    ],
                  } as Partial<UserRecord>)
                  toast.success('הקובץ הועלה בהצלחה')
                  setUploadingFile(false)
                  setFileUploadOpen(false)
                }, 500)
              }}
            >
              {uploadingFile ? 'מעלה...' : 'העלאה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
