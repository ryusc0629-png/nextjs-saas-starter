import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CopyLinkButton } from '@/components/dashboard/copy-link-button'

// 대시보드 홈 — 공개 견적 링크 표시
export default async function DashboardPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .maybeSingle()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const quoteUrl = `${baseUrl}/q/${profile?.business_id}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-muted-foreground mt-1">퀄리오에 오신 것을 환영합니다</p>
      </div>

      {/* 공개 견적 링크 */}
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="font-semibold">고객 견적 요청 링크</h2>
        <p className="text-sm text-muted-foreground">
          아래 링크를 고객에게 공유하면 견적을 요청할 수 있습니다.
        </p>
        <CopyLinkButton url={quoteUrl} />
      </div>
    </div>
  )
}
