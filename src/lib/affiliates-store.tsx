import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Affiliate, AffiliatePayment, AffiliateStatus } from '@/types'
import { affiliatesSeed } from '@/lib/mock-data'
import {
  createAffiliate,
  fetchAffiliates,
  updateAffiliate as updateAffiliateApi,
  deleteAffiliate as deleteAffiliateApi,
  type AffiliateItem,
} from '@/lib/affiliates-api'

type NewAffiliateInput = {
  firstName: string
  lastName: string
  code?: string
  status: AffiliateStatus
  email?: string
  phone?: string
  address?: string
  bankDetails?: Affiliate['bankDetails']
  internalNotes?: string
}

interface AffiliatesContextType {
  affiliates: Affiliate[]
  addAffiliate: (input: NewAffiliateInput) => Promise<Affiliate>
  updateAffiliate: (id: string, updates: Partial<Affiliate>) => Promise<Affiliate | null>
  deleteAffiliate: (id: string) => Promise<void>
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
  useEffect(() => {
    let isMounted = true
    fetchAffiliates()
      .then((rows) => {
        if (!isMounted) return
        const mapped = rows.map(mapAffiliate)
        setAffiliates(mapped)
      })
      .catch(() => {
        if (!isMounted) return
      })
    return () => {
      isMounted = false
    }
  }, [])

  const addAffiliate = useCallback(async (input: NewAffiliateInput) => {
    const payload = {
      first_name: input.firstName,
      last_name: input.lastName,
      status: input.status,
      code: input.code,
      email: input.email,
      phone: input.phone,
      address: input.address,
      internal_notes: input.internalNotes,
      beneficiary_name: input.bankDetails?.beneficiaryName,
      bank_name: input.bankDetails?.bankName,
      branch_number: input.bankDetails?.branchNumber,
      account_number: input.bankDetails?.accountNumber,
      iban: input.bankDetails?.iban,
      swift: input.bankDetails?.swift,
    }
    const created = await createAffiliate(payload)
    const next = mapAffiliate(created)
    setAffiliates((prev) => [next, ...prev])
    return next
  }, [])

  const updateAffiliate = useCallback(async (id: string, updates: Partial<Affiliate>) => {
    const hasServerFields =
      'name' in updates ||
      'code' in updates ||
      'status' in updates ||
      'email' in updates ||
      'phone' in updates ||
      'address' in updates ||
      'bankDetails' in updates ||
      'withdrawalRequested' in updates

    if (hasServerFields) {
      const name = updates.name?.trim()
      const [firstName, ...rest] = name ? name.split(/\s+/) : []
      const lastName = rest.join(' ')

      const payload = {
        code: updates.code,
        status: updates.status,
        first_name: name ? firstName : undefined,
        last_name: name ? lastName : undefined,
        email: updates.email,
        phone: updates.phone,
        address: updates.address,
        beneficiary_name: updates.bankDetails?.beneficiaryName,
        bank_name: updates.bankDetails?.bankName,
        branch_number: updates.bankDetails?.branchNumber,
        account_number: updates.bankDetails?.accountNumber,
        iban: updates.bankDetails?.iban,
        swift: updates.bankDetails?.swift,
        withdrawal_requested: updates.withdrawalRequested,
      }

      const updated = await updateAffiliateApi(id, payload)
      const next = mapAffiliate(updated)
      setAffiliates((prev) => prev.map((a) => (a.id === id ? { ...a, ...next } : a)))
      return next
    }

    setAffiliates((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)))
    return affiliates.find((a) => a.id === id) ?? null
  }, [affiliates])

  const deleteAffiliate = useCallback(async (id: string) => {
    await deleteAffiliateApi(id)
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

function mapAffiliate(row: AffiliateItem): Affiliate {
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    code: row.code,
    status: row.status,
    createdAt: row.created_at?.slice(0, 10) ?? '',
    clicks: row.clicks ?? 0,
    conversions: row.conversions ?? 0,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    bankDetails: row.bank_name || row.branch_number || row.account_number || row.beneficiary_name
      ? {
          beneficiaryName: row.beneficiary_name ?? '—',
          bankName: row.bank_name ?? '—',
          branchNumber: row.branch_number ?? '—',
          accountNumber: row.account_number ?? '—',
          iban: row.iban ?? undefined,
          swift: row.swift ?? undefined,
        }
      : undefined,
    trafficByMonth: [],
    payments: [],
    withdrawalRequested: row.withdrawal_requested ?? false,
  }
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
