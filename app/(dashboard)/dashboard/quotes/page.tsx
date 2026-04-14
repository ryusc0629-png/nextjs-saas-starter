import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const statusLabel: Record<string, { text: string; className: string }> = {
  pending:   { text: '대기중',   className: 'bg-yellow-100 text-yellow-800' },
  booked:    { text: '예약됨',   className: 'bg-green-100 text-green-800' },
  expired:   { text: '만료',     className: 'bg-gray-100 text-gray-600' },
  cancelled: { text: '취소',     className: 'bg-red-100 text-red-700' },
}

// 견적 목록 페이지
export default async function QuotesPage() {
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

  // Phase 4: customer_name/phone은 bookings로 이동 — quotes에서 제외
  const { data: quotes } = await db
    .from('quotes')
    .select('id, cleaning_type, space_size, preferred_date, good_price, better_price, best_price, status, created_at')
    .eq('business_id', profile.business_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">견적 요청</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          고객이 요청한 견적 목록입니다
        </p>
      </div>

      {!quotes || quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">아직 견적 요청이 없습니다</p>
          <p className="text-muted-foreground text-xs mt-1">
            대시보드 홈에서 고객 링크를 공유해보세요
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">서비스</th>
                <th className="text-center px-4 py-3 font-medium">평수</th>
                <th className="text-center px-4 py-3 font-medium">희망일</th>
                <th className="text-right px-4 py-3 font-medium">기본가</th>
                <th className="text-right px-4 py-3 font-medium">추천가</th>
                <th className="text-right px-4 py-3 font-medium">프리미엄가</th>
                <th className="text-center px-4 py-3 font-medium">상태</th>
                <th className="text-right px-4 py-3 font-medium">요청일</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const status = statusLabel[quote.status] ?? { text: quote.status, className: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={quote.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{quote.cleaning_type ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {quote.space_size ? `${quote.space_size}평` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">{quote.preferred_date ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {quote.good_price ? `${quote.good_price.toLocaleString()}원` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {quote.better_price ? `${quote.better_price.toLocaleString()}원` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {quote.best_price ? `${quote.best_price.toLocaleString()}원` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString('ko-KR')}
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
