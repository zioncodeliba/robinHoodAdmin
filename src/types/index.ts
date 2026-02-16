export type LeadStatus =
  | 'נרשם'
  | 'שיחה עם הצ׳אט'
  | 'חוסר התאמה'
  | 'סיום צ׳אט בהצלחה'
  | 'העלאת קבצים'
  | 'ממתין לאישור עקרוני'
  | 'אישור עקרוני'
  | 'שיחת תמהיל'
  | 'משא ומתן'
  | 'חתימות'
  | 'קבלת הכסף'
  | 'מחזור - אין הצעה'
  | 'מחזור - יש הצעה'
  | 'מחזור - נקבעה פגישה'
  | 'מחזור - ניטור'

export type MortgageType = '-' | 'מחזור משכנתא' | 'משכנתא חדשה'

export interface Lead {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  status: LeadStatus
  mortgageType: MortgageType
  createdAt: string
  lastActivityAt: string
  assignedTo?: string
  // Payment & Affiliate
  affiliateId?: string
  paymentReceived: boolean
  paymentAmount?: number
}

export type SignatureDocStatus = 'נחתם' | 'לא נחתם'

export type BankName =
  | 'לאומי'
  | 'הפועלים'
  | 'דיסקונט'
  | 'מזרחי-טפחות'
  | 'הבינלאומי'
  | 'מרכנתיל'

export type QuestionnaireSection = {
  title: string
  fields: Array<{ label: string; value: string }>
}

export type UploadedFile = {
  id: string
  originalName: string  // שם הקובץ המקורי
  customName?: string   // שם שהאדמין נותן
  uploadedBy: string    // שם האדמין שהעלה
  uploadedAt: string
}

export type SignatureDoc = {
  id: string
  name: string
  status: SignatureDocStatus
  lastSentAt?: string
  fileName?: string
}

export type BankResponseTrack = {
  loan_type: number
  loan_board: string
  loan_years: number
  loan_value: number
  loan_interest: number
  addition_to_interest: number | string
  change_frequency: number | string
  anchor: number
}

export type BankResponseExtractedData = {
  code?: number
  message?: string
  uuid?: string
  data?: {
    approval_date?: string
    expiration_date?: string
    bank_id?: string
    bank_title?: string
    bank_color?: string
    purpose?: string
    purpose_type?: number
    tracks?: BankResponseTrack[]
  }
}

export type BankResponseFile = {
  id: string
  fileName: string
  bank: BankName
  uploadedAt: string
  extractedJson: BankResponseExtractedData | null
}

export type SimulatorOfferBank = 'לאומי' | 'מזרחי-טפחות' | 'הצעה נבחרת'

export type SimulatorOfferRow = {
  id: string
  bank: SimulatorOfferBank
  track: string
  amount: number
  rate: number
  years: number
}

export type ClientPayment = {
  id: string
  amount: number
  affiliateId?: string
  affiliateName?: string
  reference?: string       // מספר אסמכתא
  note?: string           // הערה
  createdAt: string
}

export interface UserRecord extends Lead {
  questionnaire: QuestionnaireSection[]
  uploadedFiles: UploadedFile[]
  signatureDocs: SignatureDoc[]
  bankResponses: BankResponseFile[]
  simulatorOffers: SimulatorOfferRow[]
  payments: ClientPayment[]
  sentMessages: SentMessage[]
}

export interface Admin {
  id: string
  name: string
  email: string
  username?: string
  avatar?: string
}

export interface DashboardStats {
  totalLeads: number
  totalLeadsGrowth: number
  activeLeads: number
  activeLeadsGrowth: number
  monthlyMeetings: number
  monthlyMeetingsGrowth: number
  conversionRate: number
  conversionRateGrowth: number
}

export type MeetingStatus = 'מאושר' | 'ממתין' | 'בוטל'

export type CalendarView = 'day' | 'week' | 'month'

export interface Meeting {
  id: string
  title: string
  userId: string
  userName: string
  start: string // ISO
  end: string // ISO
  status: MeetingStatus
  notes?: string
}

export type AffiliateStatus = 'פעיל' | 'לא פעיל'

export type AffiliateBankDetails = {
  beneficiaryName: string
  bankName: string
  branchNumber: string
  accountNumber: string
  iban?: string
  swift?: string
}

export type AffiliateTrafficPoint = {
  month: string
  clicks: number
  conversions: number
}

export type AffiliatePayment = {
  id: string
  date: string // YYYY-MM-DD
  amount: number
  reference?: string // אסמכתא / הערה חופשית
}

export interface Affiliate {
  id: string
  name: string
  code: string
  status: AffiliateStatus
  createdAt: string // YYYY-MM-DD

  clicks: number
  conversions: number

  email?: string
  phone?: string
  address?: string

  bankDetails?: AffiliateBankDetails

  trafficByMonth: AffiliateTrafficPoint[]
  payments: AffiliatePayment[]

  withdrawalRequested: boolean
}

export type ContactSubmissionStatus = 'חדש' | 'בטיפול' | 'טופל'

export interface ContactSubmission {
  id: string
  fullName: string
  phone: string
  email: string
  message: string
  status: ContactSubmissionStatus
  createdAt: string // YYYY-MM-DD
  source?: string // e.g. "צור קשר באתר"
}

export interface ChartDataPoint {
  month: string
  value: number
}

// תבנית הודעה
export type MessageTemplate = {
  id: string
  name: string
  trigger: LeadStatus
  message: string
  createdAt: string
}

// הודעה שנשלחה ללקוח
export type SentMessage = {
  id: string
  templateId: string
  templateName: string
  message: string
  sentAt: string
  readAt?: string // undefined = לא נקרא
}
