import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { generateQuotePitch } from '@/lib/ai/quote-pitch'
import { QuoteBookingSection } from '@/components/quote/quote-booking-section'
import type { QuotePitch } from '@/lib/ai/quote-pitch'
import type { Json } from '@/lib/types/database'
import { Shield, Clock, Star } from 'lucide-react'

interface PageProps {
  params: Promise<{ businessId: string; quoteId: string }>
}

export default async function QuoteLandingPage({ params }: PageProps) {
  const { businessId, quoteId } = await params
  const db = createServiceClient()

  // 견적 + 업체 정보 동시 조회
  const [{ data: quote }, { data: business }] = await Promise.all([
    db
      .from('quotes')
      .select('id, cleaning_type, space_size, preferred_date, good_price, better_price, best_price, status, customer_name, customer_phone, ai_pitch')
      .eq('id', quoteId)
      .eq('business_id', businessId)
      .maybeSingle(),
    db
      .from('businesses')
      .select('name, phone, description, slug')
      .eq('id', businessId)
      .maybeSingle(),
  ])

  if (!quote || !business) notFound()

  // AI 피치 — 캐시된 값 우선 사용, 없으면 생성 후 저장
  let pitch: QuotePitch
  if (quote.ai_pitch && typeof quote.ai_pitch === 'object' && 'headline' in quote.ai_pitch) {
    pitch = quote.ai_pitch as unknown as QuotePitch
  } else {
    pitch = await generateQuotePitch({
      businessName: business.name,
      category:     business.description ?? null,
      serviceName:  quote.cleaning_type ?? '청소 서비스',
      spaceSize:    quote.space_size ?? null,
    })
    // 백그라운드로 캐시 저장 (실패해도 OK)
    db.from('quotes').update({ ai_pitch: pitch as unknown as Json }).eq('id', quoteId).then()
  }

  const tiers = [
    { tier: 'good',   label: '기본',     price: quote.good_price   ?? 0, highlight: false },
    { tier: 'better', label: '추천',     price: quote.better_price ?? 0, highlight: true  },
    { tier: 'best',   label: '프리미엄', price: quote.best_price   ?? 0, highlight: false },
  ]

  const isBooked = quote.status === 'booked'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* 상단 업체 헤더 */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">{business.name}</p>
            {business.phone && (
              <a href={`tel:${business.phone}`} className="text-xs text-primary hover:underline">
                {business.phone}
              </a>
            )}
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            맞춤 견적서
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-16">
        {/* 히어로 섹션 */}
        <section className="pt-10 pb-8 text-center space-y-3">
          <h1 className="text-2xl font-extrabold leading-tight text-balance">
            {pitch.headline}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {pitch.subheadline}
          </p>
          {quote.space_size && (
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full">
              <span>{quote.cleaning_type}</span>
              <span>·</span>
              <span>{quote.space_size}평 맞춤 견적</span>
            </div>
          )}
        </section>

        {/* 왜 필요한가 — 3가지 이유 */}
        <section className="mb-10 space-y-3">
          {pitch.reasons.map((reason, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-2xl bg-white border p-4 shadow-sm"
            >
              <span className="text-2xl leading-none shrink-0 mt-0.5">{reason.emoji}</span>
              <div>
                <p className="font-semibold text-sm">{reason.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {reason.description}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* 신뢰 배지 */}
        <section className="mb-10">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Shield,  label: '전문 자격증 보유' },
              { icon: Star,    label: '고객 만족 보장' },
              { icon: Clock,   label: '당일 예약 가능' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-white border p-3 text-center shadow-sm">
                <Icon className="h-5 w-5 text-primary" />
                <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 긴급성 배너 */}
        <div className="mb-8 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-orange-800">⏰ {pitch.urgencyText}</p>
        </div>

        {/* 예약 섹션 또는 완료 메시지 */}
        {isBooked ? (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-8 text-center space-y-3">
            <div className="text-4xl">✅</div>
            <h2 className="font-bold text-lg">이미 예약 완료된 견적입니다</h2>
            <p className="text-sm text-muted-foreground">담당자가 곧 연락드릴 예정입니다.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border-2 border-primary/20 p-6 shadow-sm">
            <QuoteBookingSection
              quoteId={quoteId}
              tiers={tiers}
              defaultName={quote.customer_name ?? undefined}
              defaultPhone={quote.customer_phone ?? undefined}
            />
          </div>
        )}

        {/* 하단 업체 정보 */}
        <div className="mt-10 text-center space-y-1">
          <p className="text-xs text-muted-foreground">{business.name}이 준비한 견적입니다</p>
          {business.phone && (
            <p className="text-xs text-muted-foreground">
              문의: <a href={`tel:${business.phone}`} className="text-primary hover:underline">{business.phone}</a>
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
