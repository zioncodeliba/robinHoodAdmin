import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Affiliate, AffiliatePayment, AffiliateStatus } from '@/types'
import { affiliatesSeed } from '@/lib/mock-data'

type NewAffiliateInput = {
  name: string
  code: string
  status: AffiliateStatus
  email?: string
  phone?: string
  address?: string
  bankDetails?: Affiliate['bankDetails']
}

interface AffiliatesContextType {
  affiliates: Affiliate[]
  addAffiliate: (input: NewAffiliateInput) => void
  updateAffiliate: (id: string, updates: Partial<Affiliate>) => void
  deleteAffiliate: (id: string) => void
  addPayment: (affiliateId: string, payment: Omit<AffiliatePayment, 'id'>) => void
  totalEarningsAllTime: number
  totalBalanceDue: number
}

const AffiliatesContext = createContext<AffiliatesContextType | undefined>(undefined)

function calcEarnings(affiliate: Affiliate) {
  // Demo: 250₪ per conversion
  return affiliate.conversions * 250
}

function calcPaid(affiliate: Affiliate) {
  return affiliate.payments.reduce((sum, p) => sum + p.amount, 0)
}

export function AffiliatesProvider({ children }: { children: ReactNode }) {
  const [affiliates, setAffiliates] = useState<Affiliate[]>(affiliatesSeed)

  const addAffiliate = useCallback((input: NewAffiliateInput) => {
    const now = new Date()
    const createdAt = now.toISOString().slice(0, 10)
    const id = `a-${Date.now()}`
    const next: Affiliate = {
      id,
      name: input.name,
      code: input.code,
      status: input.status,
      createdAt,
      clicks: 0,
      conversions: 0,
      email: input.email,
      phone: input.phone,
      address: input.address,
      bankDetails: input.bankDetails,
      withdrawalRequested: false,
      trafficByMonth: [
        { month: 'ינואר', clicks: 0, conversions: 0 },
        { month: 'פברואר', clicks: 0, conversions: 0 },
        { month: 'מרץ', clicks: 0, conversions: 0 },
        { month: 'אפריל', clicks: 0, conversions: 0 },
        { month: 'מאי', clicks: 0, conversions: 0 },
        { month: 'יוני', clicks: 0, conversions: 0 },
      ],
      payments: [],
    }
    setAffiliates((prev) => [next, ...prev])
  }, [])

  const updateAffiliate = useCallback((id: string, updates: Partial<Affiliate>) => {
    setAffiliates((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)))
  }, [])

  const deleteAffiliate = useCallback((id: string) => {
    setAffiliates((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const addPayment = useCallback((affiliateId: string, payment: Omit<AffiliatePayment, 'id'>) => {
    setAffiliates((prev) =>
      prev.map((a) => {
        if (a.id !== affiliateId) return a
        const nextPayment: AffiliatePayment = { id: `pay-${Date.now()}`, ...payment }
        return { ...a, payments: [nextPayment, ...a.payments] }
      })
    )
  }, [])

  const totals = useMemo(() => {
    const totalEarningsAllTime = affiliates.reduce((sum, a) => sum + calcEarnings(a), 0)
    const totalBalanceDue = affiliates.reduce((sum, a) => sum + Math.max(0, calcEarnings(a) - calcPaid(a)), 0)
    return { totalEarningsAllTime, totalBalanceDue }
  }, [affiliates])

  return (
    <AffiliatesContext.Provider
      value={{
        affiliates,
        addAffiliate,
        updateAffiliate,
        deleteAffiliate,
        addPayment,
        totalEarningsAllTime: totals.totalEarningsAllTime,
        totalBalanceDue: totals.totalBalanceDue,
      }}
    >
      {children}
    </AffiliatesContext.Provider>
  )
}

export function useAffiliates() {
  const ctx = useContext(AffiliatesContext)
  if (!ctx) throw new Error('useAffiliates must be used within an AffiliatesProvider')
  return ctx
}

export function useAffiliateById(id: string | undefined) {
  const { affiliates } = useAffiliates()
  return useMemo(() => affiliates.find((a) => a.id === id) ?? null, [affiliates, id])
}


