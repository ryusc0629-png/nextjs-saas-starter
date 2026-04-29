'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateLeadStatusAction } from '@/lib/actions/crm'

const STATUS_OPTIONS = [
  { value: 'new',        label: '신규' },
  { value: 'contacted',  label: '1차방문' },
  { value: 'follow_up',  label: '팔로업' },
  { value: 'quoted',     label: '견적중' },
  { value: 'contracted', label: '계약완료' },
  { value: 'rejected',   label: '거절' },
]

interface LeadStatusSelectProps {
  leadId: string
  currentStatus: string
}

export function LeadStatusSelect({ leadId, currentStatus }: LeadStatusSelectProps) {
  const [isPending, startTransition] = useTransition()

  const handleChange = (newStatus: string) => {
    startTransition(async () => {
      const result = await updateLeadStatusAction({ leadId, status: newStatus })
      if (result?.serverError) {
        toast.error(result.serverError)
      }
    })
  }

  return (
    <select
      value={currentStatus}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      className="text-xs rounded-full px-2 py-0.5 border border-border bg-background cursor-pointer disabled:opacity-50"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
