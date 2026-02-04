import * as React from 'react'
import { toast } from 'sonner'
import { usersSeed } from '@/lib/mock-data'
import { createCustomer, deleteCustomer, fetchCustomers, updateCustomer, type CustomerCreateInput, type CustomerItem, type CustomerUpdateInput } from '@/lib/customers-api'
import type { LeadStatus, MortgageType, UserRecord } from '@/types'

type UsersContextValue = {
  users: UserRecord[]
  setUsers: React.Dispatch<React.SetStateAction<UserRecord[]>>
  updateUser: (id: string, patch: Partial<UserRecord>) => void
  deleteUser: (id: string) => Promise<void>
  addUser: (data: CustomerCreateInput) => Promise<void>
  updateCustomer: (userId: string, data: CustomerUpdateInput) => Promise<void>
}

const UsersContext = React.createContext<UsersContextValue | null>(null)

const leadStatusOptions: LeadStatus[] = [
  'נרשם',
  'שיחה עם הצ׳אט',
  'חוסר התאמה',
  'סיום צ׳אט בהצלחה',
  'העלאת קבצים',
  'ממתין לאישור עקרוני',
  'אישור עקרוני',
  'שיחת תמהיל',
  'משא ומתן',
  'חתימות',
  'קבלת הכסף',
  'מחזור - אין הצעה',
  'מחזור - יש הצעה',
  'מחזור - ניטור',
]

const mortgageTypeOptions: MortgageType[] = ['-', 'משכנתא חדשה', 'מחזור משכנתא']

const mapStatus = (value: string): LeadStatus => {
  const trimmed = value?.trim?.() ?? ''
  if (trimmed.startsWith('נשלחה בקשה ל')) return 'סיום צ׳אט בהצלחה'
  return leadStatusOptions.includes(trimmed as LeadStatus) ? (trimmed as LeadStatus) : 'נרשם'
}

const mapMortgageType = (value: string): MortgageType => {
  const trimmed = value?.trim?.() ?? ''
  if (!trimmed) return '-'
  return mortgageTypeOptions.includes(trimmed as MortgageType) ? (trimmed as MortgageType) : '-'
}

const mapCustomer = (item: CustomerItem): UserRecord => {
  const createdAt = item.created_at ?? new Date().toISOString()
  const lastActivityAt = item.last_activity_at ?? createdAt
  return {
    id: item.id,
    firstName: item.first_name,
    lastName: item.last_name,
    phone: item.phone ?? '',
    email: item.mail,
    status: mapStatus(item.status),
    mortgageType: mapMortgageType(item.mortgage_type),
    createdAt,
    lastActivityAt,
    paymentReceived: false,
    questionnaire: [
      {
        title: 'פרטים אישיים',
        fields: [
          { label: 'שם מלא', value: `${item.first_name} ${item.last_name}` },
          { label: 'טלפון', value: item.phone ?? '' },
          { label: 'אימייל', value: item.mail },
        ],
      },
    ],
    uploadedFiles: [],
    signatureDocs: [],
    bankResponses: [],
    simulatorOffers: [],
    payments: [],
    sentMessages: [],
  }
}

export function UsersProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = React.useState<UserRecord[]>([])

  const loadCustomers = React.useCallback(async () => {
    try {
      const data = await fetchCustomers()
      setUsers(data.map(mapCustomer))
    } catch (error) {
      setUsers(usersSeed)
      toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת לקוחות')
    }
  }, [])

  React.useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const updateUser = React.useCallback((id: string, patch: Partial<UserRecord>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }, [])

  const deleteUser = React.useCallback(async (id: string) => {
    try {
      await deleteCustomer(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
      toast.success('הלקוח נמחק')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה במחיקת לקוח')
      throw error
    }
  }, [])

  const addUser = React.useCallback(async (data: CustomerCreateInput) => {
    try {
      const created = await createCustomer(data)
      setUsers((prev) => [mapCustomer(created), ...prev])
      toast.success('הלקוח נוסף בהצלחה')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהוספת לקוח')
      throw error
    }
  }, [])

  const updateCustomerProfile = React.useCallback(async (userId: string, data: CustomerUpdateInput) => {
    try {
      const updated = await updateCustomer(userId, data)
      const mapped = mapCustomer(updated)
      setUsers((prev) => prev.map((u) => (
        u.id === userId
          ? {
              ...u,
              firstName: mapped.firstName,
              lastName: mapped.lastName,
              phone: mapped.phone,
              email: mapped.email,
              status: mapped.status,
              mortgageType: mapped.mortgageType,
              createdAt: mapped.createdAt,
              lastActivityAt: mapped.lastActivityAt,
            }
          : u
      )))
      toast.success('הפרטים עודכנו')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בעדכון לקוח')
      throw error
    }
  }, [])

  const value = React.useMemo(
    () => ({ users, setUsers, updateUser, deleteUser, addUser, updateCustomer: updateCustomerProfile }),
    [users, updateUser, deleteUser, addUser, updateCustomerProfile]
  )

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>
}

export function useUsers() {
  const ctx = React.useContext(UsersContext)
  if (!ctx) throw new Error('useUsers must be used within UsersProvider')
  return ctx
}
