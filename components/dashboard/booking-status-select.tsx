'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { updateBookingStatusAction } from '@/lib/actions/bookings'

const STATUS_OPTIONS = [
  { value: 'confirmed',   label: '확정' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed',   label: '완료' },
  { value: 'cancelled',   label: '취소' },
  { value: 'no_show',     label: '노쇼' },
]

interface BookingStatusSelectProps {
  bookingId: string
  currentStatus: string
}

export function BookingStatusSelect({ bookingId, currentStatus }: BookingStatusSelectProps) {
  const { execute, isPending } = useAction(updateBookingStatusAction, {
    onSuccess: () => toast.success('상태가 변경되었습니다'),
    onError: ({ error }) => toast.error(error.serverError ?? '상태 변경에 실패했습니다'),
  })

  const isCompleted = currentStatus === 'completed'

  return (
    <select
      defaultValue={currentStatus}
      disabled={isPending || isCompleted}
      onChange={(e) => execute({ id: bookingId, status: e.target.value })}
      className="h-7 rounded border bg-background px-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
