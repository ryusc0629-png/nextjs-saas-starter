import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AddBookingForm } from '@/components/dashboard/add-booking-form'
import { BookingStatusSelect } from '@/components/dashboard/booking-status-select'

const statusLabel: Record<string, { text: string; className: string }> = {
  confirmed:   { text: '확정',   className: 'bg-blue-100 text-blue-800' },
  in_progress: { text: '진행중', className: 'bg-yellow-100 text-yellow-800' },
  completed:   { text: '완료',   className: 'bg-green-100 text-green-800' },
  cancelled:   { text: '취소',   className: 'bg-red-100 text-red-700' },
  no_show:     { text: '노쇼',   className: 'bg-gray-100 text-gray-600' },
}

// 예약 관리 페이지
export default async function BookingsPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.business_id) redirect('/onboarding')

  const { data: bookings } = await db
    .from('bookings')
    .select('id, customer_name, customer_phone, service_address, scheduled_at, selected_tier, final_price, status, created_at')
    .eq('business_id', profile.business_id)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">예약 관리</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            확정된 예약 목록입니다. 전화로 받은 예약도 직접 추가할 수 있습니다
          </p>
        </div>
        <AddBookingForm />
      </div>

      {!bookings || bookings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">아직 예약이 없습니다</p>
          <p className="text-muted-foreground text-xs mt-1">
            고객이 견적 폼에서 예약하거나, 위 버튼으로 직접 추가해보세요
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">예약일시</th>
                <th className="text-left px-4 py-3 font-medium">고객명</th>
                <th className="text-left px-4 py-3 font-medium">연락처</th>
                <th className="text-left px-4 py-3 font-medium">주소</th>
                <th className="text-right px-4 py-3 font-medium">금액</th>
                <th className="text-center px-4 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const status = statusLabel[booking.status] ?? { text: booking.status, className: 'bg-gray-100 text-gray-600' }
                const shortAddress = booking.service_address.length > 25
                  ? booking.service_address.slice(0, 25) + '…'
                  : booking.service_address

                return (
                  <tr key={booking.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(booking.scheduled_at).toLocaleDateString('ko-KR', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">{booking.customer_name}</td>
                    <td className="px-4 py-3">{booking.customer_phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{shortAddress}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {booking.final_price.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                          {status.text}
                        </span>
                        <BookingStatusSelect
                          bookingId={booking.id}
                          currentStatus={booking.status}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
