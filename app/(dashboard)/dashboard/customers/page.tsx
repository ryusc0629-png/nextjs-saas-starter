import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AddCustomerForm } from '@/components/dashboard/add-customer-form'
import { EditCustomerButton } from '@/components/dashboard/edit-customer-button'
import { DeleteCustomerButton } from '@/components/dashboard/delete-customer-button'
import { AddContractButton } from '@/components/dashboard/add-contract-button'
import { ContractStatusSelect } from '@/components/dashboard/contract-status-select'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

const FREQUENCY_LABEL: Record<string, string> = {
  weekly:   '주 1회',
  biweekly: '격주 1회',
  monthly:  '월 1회',
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type: filterType } = await searchParams

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

  const [
    { data: customers },
    { data: contracts },
  ] = await Promise.all([
    db.from('customers')
      .select('id, name, phone, address, category, type, notes, created_at')
      .eq('business_id', profile.business_id)
      .order('type') // 정기 고객 먼저
      .order('created_at', { ascending: false }),

    db.from('contracts')
      .select('id, customer_id, service_type, frequency, contract_price, status')
      .eq('business_id', profile.business_id)
      .order('created_at', { ascending: false }),
  ])

  // 고객별 계약 매핑
  type ContractRow = NonNullable<typeof contracts>[number]
  const contractByCustomer: Record<string, ContractRow[]> = {}
  for (const c of contracts ?? []) {
    if (!contractByCustomer[c.customer_id]) contractByCustomer[c.customer_id] = []
    contractByCustomer[c.customer_id]!.push(c)
  }

  const filtered = (customers ?? []).filter((c) => {
    if (filterType === 'recurring') return c.type === 'recurring'
    if (filterType === 'one_time') return c.type === 'one_time'
    return true
  })

  const totalCount = customers?.length ?? 0
  const recurringCount = customers?.filter((c) => c.type === 'recurring').length ?? 0
  const oneTimeCount = customers?.filter((c) => c.type === 'one_time').length ?? 0

  // 확정 정기 매출 (활성 계약 합산)
  const monthlyRevenue = (contracts ?? [])
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + c.contract_price, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">고객 관리</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            정기·일회성 고객과 계약 현황을 한눈에 확인하세요
          </p>
        </div>
        {/* 직접 추가용 — 주요 동선은 CRM → 고객 등록 */}
        <AddCustomerForm variant="outline" />
      </div>

      {/* 매출 요약 카드 */}
      {monthlyRevenue > 0 && (
        <div className="rounded-xl border bg-gradient-to-r from-green-50 to-emerald-50 p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <p className="text-sm text-green-700 font-medium">확정 정기 매출</p>
            <p className="text-2xl font-bold text-green-800">
              {monthlyRevenue.toLocaleString('ko-KR')}원
              <span className="text-sm font-normal text-green-600 ml-1">/ 월</span>
            </p>
          </div>
          <p className="ml-auto text-xs text-green-600">활성 계약 기준</p>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 border-b">
        {[
          { key: undefined,   label: `전체 (${totalCount})`,         href: '/dashboard/customers' },
          { key: 'recurring', label: `정기 고객 (${recurringCount})`, href: '/dashboard/customers?type=recurring' },
          { key: 'one_time',  label: `일회성 (${oneTimeCount})`,     href: '/dashboard/customers?type=one_time' },
        ].map((tab) => {
          const isActive = (filterType ?? undefined) === tab.key
          return (
            <a
              key={tab.label}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </a>
          )
        })}
      </div>

      {/* 고객 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">등록된 고객이 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">
            영업 CRM에서 계약완료된 업체의 <strong>"고객 등록"</strong> 버튼을 눌러 전환하거나, 직접 추가하세요
          </p>
          <Link
            href="/dashboard/crm"
            className="inline-block mt-3 text-xs text-primary hover:underline"
          >
            → 영업 CRM으로 이동
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((customer) => {
            const customerContracts = contractByCustomer[customer.id] ?? []
            const activeContract = customerContracts.find((c) => c.status === 'active')
            const isRecurring = customer.type === 'recurring'
            const hasAnyContract = customerContracts.length > 0

            return (
              <div
                key={customer.id}
                className={`rounded-lg border p-4 hover:border-primary/20 transition-colors ${
                  isRecurring ? 'border-l-4 border-l-blue-400' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* 고객 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{customer.name}</p>
                      {customer.category && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{customer.category}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isRecurring ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isRecurring ? '정기 고객' : '일회성'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{customer.phone}</p>
                    {customer.address && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{customer.address}</p>
                    )}
                  </div>

                  {/* 계약 정보 + 액션 버튼 */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {/* 수정/삭제 버튼 */}
                    <div className="flex items-center gap-1">
                      <EditCustomerButton customer={customer} />
                      <DeleteCustomerButton
                        customerId={customer.id}
                        customerName={customer.name}
                        hasContract={hasAnyContract}
                      />
                    </div>

                    {/* 계약 정보 */}
                    {activeContract ? (
                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums">
                          {activeContract.contract_price.toLocaleString('ko-KR')}원
                          <span className="text-xs font-normal text-muted-foreground ml-1">/ 월</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeContract.service_type} · {FREQUENCY_LABEL[activeContract.frequency] ?? activeContract.frequency}
                        </p>
                        <div className="mt-1">
                          <ContractStatusSelect
                            contractId={activeContract.id}
                            currentStatus={activeContract.status}
                          />
                        </div>
                      </div>
                    ) : isRecurring ? (
                      // 정기 고객인데 계약 없는 경우 → 계약 추가 버튼
                      <AddContractButton customerId={customer.id} customerName={customer.name} />
                    ) : null}
                  </div>
                </div>

                {/* 비활성 계약 표시 (해지/중단) */}
                {!activeContract && customerContracts.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      {customerContracts[0]!.service_type} · {FREQUENCY_LABEL[customerContracts[0]!.frequency]} ·{' '}
                      <span className="text-red-500">
                        {customerContracts[0]!.status === 'terminated' ? '해지됨' : '중단됨'}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
