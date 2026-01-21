import type { Admin, Affiliate, BankName, ChartDataPoint, ContactSubmission, DashboardStats, UserRecord } from '@/types'

export const dashboardStats: DashboardStats = {
  totalLeads: 248,
  totalLeadsGrowth: 12,
  activeLeads: 89,
  activeLeadsGrowth: 8,
  monthlyMeetings: 34,
  monthlyMeetingsGrowth: 15,
  conversionRate: 23,
  conversionRateGrowth: 3,
}

export const leadsChartData: ChartDataPoint[] = [
  { month: 'ינואר', value: 32 },
  { month: 'פברואר', value: 45 },
  { month: 'מרץ', value: 38 },
  { month: 'אפריל', value: 52 },
  { month: 'מאי', value: 48 },
  { month: 'יוני', value: 65 },
]

const banks: BankName[] = ['לאומי', 'הפועלים', 'דיסקונט', 'מזרחי-טפחות', 'הבינלאומי', 'מרכנתיל']

function userSeedBase(u: Omit<UserRecord, 'questionnaire' | 'uploadedFiles' | 'signatureDocs' | 'bankResponses' | 'simulatorOffers' | 'payments' | 'sentMessages'>): UserRecord {
  return {
    ...u,
    questionnaire: [
      {
        title: 'פרטים אישיים',
        fields: [
          { label: 'שם מלא', value: `${u.firstName} ${u.lastName}` },
          { label: 'טלפון', value: u.phone },
          { label: 'אימייל', value: u.email },
        ],
      },
      {
        title: 'נתונים פיננסיים',
        fields: [
          { label: 'הכנסה נטו (חודשית)', value: '21,000 ₪' },
          { label: 'הון עצמי', value: '320,000 ₪' },
          { label: 'מספר לווים', value: '2' },
        ],
      },
      {
        title: 'העדפות',
        fields: [
          { label: 'מטרה', value: 'רכישת דירה' },
          { label: 'הערות', value: 'מעוניינים במסלול משולב' },
        ],
      },
    ],
    uploadedFiles: [
      { id: `${u.id}-uf-1`, originalName: 'salary_dec_2024.pdf', customName: 'תלוש שכר דצמבר', uploadedBy: 'אדמין ראשי', uploadedAt: '2024-12-12' },
      { id: `${u.id}-uf-2`, originalName: 'bank_statement.pdf', customName: 'דף חשבון בנק', uploadedBy: 'אדמין ראשי', uploadedAt: '2024-12-05' },
    ],
    signatureDocs: [
      { id: `${u.id}-sd-1`, name: 'ייפוי כוח', status: 'לא נחתם' },
      { id: `${u.id}-sd-2`, name: 'הסכמה למסירת מידע', status: 'נחתם', fileName: 'הסכמה_למסירת_מידע.pdf' },
      { id: `${u.id}-sd-3`, name: 'כתב ויתור סודיות', status: 'לא נחתם' },
      { id: `${u.id}-sd-4`, name: 'טופס הצהרת הון עצמי', status: 'לא נחתם' },
      { id: `${u.id}-sd-5`, name: 'אישור תנאים כלליים', status: 'נחתם', fileName: 'אישור_תנאים_כלליים.pdf' },
    ],
    bankResponses: [
      {
        id: `${u.id}-br-1`,
        fileName: 'אישור עקרוני.pdf',
        bank: banks[(Number(u.id) + 1) % banks.length],
        uploadedAt: '2024-12-18',
        extractedJson: {
          code: 0,
          message: 'done',
          uuid: `demo-${u.id}-uuid`,
          data: {
            approval_date: '27/11/2024',
            expiration_date: '21/12/2024',
            bank_id: String((Number(u.id) + 1) % 6),
            bank_title: banks[(Number(u.id) + 1) % banks.length],
            bank_color: '#0066cc',
            purpose: 'מיחזור לבנק אחר - לדיור',
            purpose_type: 1,
            tracks: [
              {
                loan_type: 2,
                loan_board: '1',
                loan_years: 300,
                loan_value: 500000,
                loan_interest: 4.25,
                addition_to_interest: '',
                change_frequency: '',
                anchor: 4.25,
              },
              {
                loan_type: 4,
                loan_board: '1',
                loan_years: 300,
                loan_value: 350000,
                loan_interest: 5.1,
                addition_to_interest: 0.85,
                change_frequency: 12,
                anchor: 4.25,
              },
              {
                loan_type: 1,
                loan_board: '1',
                loan_years: 240,
                loan_value: 150000,
                loan_interest: 4.8,
                addition_to_interest: '',
                change_frequency: '',
                anchor: 4.8,
              },
            ],
          },
        },
      },
    ],
    simulatorOffers: [
      { id: `${u.id}-so-1`, bank: 'לאומי', track: 'קבועה לא צמודה', amount: 500000, rate: 4.2, years: 25 },
      { id: `${u.id}-so-2`, bank: 'לאומי', track: 'פריים', amount: 350000, rate: 3.6, years: 20 },
      { id: `${u.id}-so-3`, bank: 'מזרחי-טפחות', track: 'משתנה כל 5', amount: 250000, rate: 4.0, years: 25 },
      { id: `${u.id}-so-4`, bank: 'מזרחי-טפחות', track: 'קבועה צמודה', amount: 400000, rate: 3.8, years: 30 },
      { id: `${u.id}-so-5`, bank: 'הצעה נבחרת', track: 'קבועה לא צמודה', amount: 500000, rate: 4.0, years: 25 },
      { id: `${u.id}-so-6`, bank: 'הצעה נבחרת', track: 'פריים', amount: 300000, rate: 3.5, years: 20 },
    ],
    payments: [],
    sentMessages: Number(u.id) <= 2 ? [
      {
        id: `${u.id}-msg-1`,
        templateId: 'tpl-1',
        templateName: 'אישור עקרוני התקבל',
        message: `שלום ${u.firstName} ${u.lastName}, קיבלנו אישור עקרוני עבורך! נציג יצור איתך קשר בהקדם להמשך התהליך.`,
        sentAt: '2024-12-20T10:30:00.000Z',
        readAt: Number(u.id) === 1 ? '2024-12-20T11:15:00.000Z' : undefined,
      },
      {
        id: `${u.id}-msg-2`,
        templateId: 'tpl-2',
        templateName: 'זימון לשיחת תמהיל',
        message: `שלום ${u.firstName} ${u.lastName}, אנחנו מזמינים אותך לשיחת תמהיל לקביעת פרטי המשכנתא. אנא צור קשר לתיאום מועד.`,
        sentAt: '2024-12-22T14:00:00.000Z',
        readAt: undefined,
      },
    ] : [],
  }
}

export const usersSeed: UserRecord[] = [
  userSeedBase({
    id: '1',
    firstName: 'דוד',
    lastName: 'לוי',
    phone: '050-1234567',
    email: 'david@example.com',
    status: 'ממתין לאישור עקרוני',
    mortgageType: 'משכנתא חדשה',
    createdAt: '2024-12-20',
    lastActivityAt: '2024-12-28',
    paymentReceived: false,
  }),
  userSeedBase({
    id: '2',
    firstName: 'שרה',
    lastName: 'כהן',
    phone: '052-9876543',
    email: 'sarah@example.com',
    status: 'שיחת תמהיל',
    mortgageType: 'מחזור משכנתא',
    createdAt: '2024-12-19',
    lastActivityAt: '2024-12-27',
    affiliateId: 'a-1',
    paymentReceived: true,
    paymentAmount: 500,
  }),
  userSeedBase({
    id: '3',
    firstName: 'משה',
    lastName: 'אברהם',
    phone: '054-5555555',
    email: 'moshe@example.com',
    status: 'קבלת הכסף',
    mortgageType: 'משכנתא חדשה',
    createdAt: '2024-12-18',
    lastActivityAt: '2024-12-26',
    paymentReceived: true,
    paymentAmount: 750,
  }),
  userSeedBase({
    id: '4',
    firstName: 'רחל',
    lastName: 'לוי',
    phone: '053-1112222',
    email: 'rachel@example.com',
    status: 'מחזור - יש הצעה',
    mortgageType: 'מחזור משכנתא',
    createdAt: '2024-12-17',
    lastActivityAt: '2024-12-25',
    affiliateId: 'a-2',
    paymentReceived: false,
  }),
  userSeedBase({
    id: '5',
    firstName: 'יעקב',
    lastName: 'שמעון',
    phone: '050-3334444',
    email: 'yaakov@example.com',
    status: 'אישור עקרוני',
    mortgageType: 'משכנתא חדשה',
    createdAt: '2024-12-16',
    lastActivityAt: '2024-12-24',
    paymentReceived: false,
  }),
]

// Backward compatibility: some legacy components still import `mockLeads`.
// We keep this alias to avoid runtime crashes while the UI is being renamed to "לקוחות".
export const mockLeads = usersSeed

export const currentUser: Admin = {
  id: '1',
  name: 'אדמין ראשי',
  email: 'admin@robin.co.il',
}

export const affiliatesSeed: Affiliate[] = [
  {
    id: 'a-1',
    name: 'אבי לוי',
    code: 'AVI10',
    status: 'פעיל',
    createdAt: '2024-10-12',
    clicks: 1240,
    conversions: 48,
    email: 'avi@example.com',
    phone: '052-1112222',
    address: 'דיזנגוף 10, תל אביב',
    bankDetails: {
      beneficiaryName: 'אבי לוי',
      bankName: 'לאומי',
      branchNumber: '800',
      accountNumber: '123456',
      iban: 'IL12 0100 0800 0001 2345 6',
      swift: 'LUMIILIT',
    },
    trafficByMonth: [
      { month: 'ינואר', clicks: 140, conversions: 6 },
      { month: 'פברואר', clicks: 180, conversions: 7 },
      { month: 'מרץ', clicks: 210, conversions: 8 },
      { month: 'אפריל', clicks: 190, conversions: 7 },
      { month: 'מאי', clicks: 240, conversions: 10 },
      { month: 'יוני', clicks: 280, conversions: 10 },
    ],
    payments: [
      { id: 'p-1', date: '2025-01-10', amount: 1200 },
      { id: 'p-2', date: '2025-02-10', amount: 900 },
    ],
    withdrawalRequested: true,
  },
  {
    id: 'a-2',
    name: 'נועה כהן',
    code: 'NOA25',
    status: 'פעיל',
    createdAt: '2024-11-03',
    clicks: 860,
    conversions: 31,
    email: 'noa@example.com',
    phone: '050-3334444',
    address: 'החרושת 5, רמת גן',
    bankDetails: {
      beneficiaryName: 'נועה כהן',
      bankName: 'הפועלים',
      branchNumber: '123',
      accountNumber: '987654',
    },
    trafficByMonth: [
      { month: 'ינואר', clicks: 110, conversions: 4 },
      { month: 'פברואר', clicks: 140, conversions: 5 },
      { month: 'מרץ', clicks: 135, conversions: 4 },
      { month: 'אפריל', clicks: 150, conversions: 6 },
      { month: 'מאי', clicks: 160, conversions: 6 },
      { month: 'יוני', clicks: 165, conversions: 6 },
    ],
    payments: [{ id: 'p-3', date: '2025-02-18', amount: 700 }],
    withdrawalRequested: false,
  },
  {
    id: 'a-3',
    name: 'סטודיו "Core"',
    code: 'CORE7',
    status: 'לא פעיל',
    createdAt: '2024-08-22',
    clicks: 410,
    conversions: 9,
    email: 'hello@core.co.il',
    phone: '03-5555555',
    address: 'המסגר 20, תל אביב',
    bankDetails: {
      beneficiaryName: 'סטודיו Core בע״מ',
      bankName: 'דיסקונט',
      branchNumber: '456',
      accountNumber: '112233',
    },
    trafficByMonth: [
      { month: 'ינואר', clicks: 50, conversions: 1 },
      { month: 'פברואר', clicks: 60, conversions: 1 },
      { month: 'מרץ', clicks: 70, conversions: 2 },
      { month: 'אפריל', clicks: 65, conversions: 2 },
      { month: 'מאי', clicks: 80, conversions: 2 },
      { month: 'יוני', clicks: 85, conversions: 1 },
    ],
    payments: [],
    withdrawalRequested: false,
  },
]

export const contactSubmissionsSeed: ContactSubmission[] = [
  {
    id: 'c-1',
    fullName: 'דוד לוי',
    phone: '050-1234567',
    email: 'david@example.com',
    message: 'אני מעוניין בייעוץ משכנתא',
    status: 'חדש',
    createdAt: '2024-12-23',
    source: 'צור קשר באתר',
  },
  {
    id: 'c-2',
    fullName: 'שרה כהן',
    phone: '052-9876543',
    email: 'sarah@example.com',
    message: 'רוצה מידע על תהליך רכישה',
    status: 'בטיפול',
    createdAt: '2024-12-22',
    source: 'צור קשר באתר',
  },
  {
    id: 'c-3',
    fullName: 'משה אברהם',
    phone: '054-5555555',
    email: 'moshe@example.com',
    message: 'שאלה בנוגע לריבית',
    status: 'טופל',
    createdAt: '2024-12-21',
    source: 'צור קשר באתר',
  },
  {
    id: 'c-4',
    fullName: 'רחל ישראלי',
    phone: '053-4444444',
    email: 'rachel@example.com',
    message: 'בקשה לפגישה',
    status: 'חדש',
    createdAt: '2024-12-20',
    source: 'צור קשר באתר',
  },
]


