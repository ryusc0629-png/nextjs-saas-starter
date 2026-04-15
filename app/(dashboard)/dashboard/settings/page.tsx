import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
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

  const { data: business } = await db
    .from('businesses')
    .select('name, phone, address, description, naver_place_url')
    .eq('id', profile.business_id)
    .maybeSingle()

  if (!business) redirect('/onboarding')

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">업체 정보 및 채널 연동을 관리합니다</p>
      </div>

      <SettingsForm business={business} />
    </div>
  )
}
