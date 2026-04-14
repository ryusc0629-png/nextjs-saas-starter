'use server'

import { z } from 'zod'
import { createSafeActionClient } from 'next-safe-action'
import { createServiceClient } from '@/lib/supabase/server'

// 공개 폼용 액션 클라이언트 (인증 불필요)
const publicAction = createSafeActionClient({
  handleServerError(e) {
    if (e.message.startsWith('[APP]')) return e.message.replace('[APP] ', '')
    console.error('[PublicAction Error]', e)
    return '요청 처리 중 오류가 발생했습니다'
  },
})

// 한국 전화번호 검증
const phoneRegex = /^(010|011|016|017|018|019|02|0[3-9]\d)\d{7,8}$/

// 기본 quote_tiers fallback (업체가 tiers를 아직 설정하지 않은 경우)
const DEFAULT_TIERS = [
  { tier: 'good',   label: '기본',     price_multiplier: 1.0, highlight: false },
  { tier: 'better', label: '추천',     price_multiplier: 1.2, highlight: true },
  { tier: 'best',   label: '프리미엄', price_multiplier: 1.5, highlight: false },
] as const

// Step 1: 가격 계산 + 견적 생성 (익명, 개인정보 없음)
const calculateAndCreateQuoteSchema = z.object({
  business_id: z.string().uuid('올바른 업체 정보가 아닙니다'),
  service_id: z.string().uuid('서비스를 선택해주세요'),
  space_size: z.coerce.number().min(1).max(300).optional(),
  preferred_date: z.string().optional(),
  extra_notes: z.string().max(500).optional(),
})

export const calculateAndCreateQuoteAction = publicAction
  .schema(calculateAndCreateQuoteSchema)
  .action(async ({ parsedInput }) => {
    const db = createServiceClient()

    // 업체 존재 확인
    const { data: business } = await db
      .from('businesses')
      .select('id')
      .eq('id', parsedInput.business_id)
      .maybeSingle()

    if (!business) throw new Error('[APP] 존재하지 않는 업체입니다')

    // 선택한 서비스 조회
    const { data: service } = await db
      .from('service_items')
      .select('id, name, base_price, unit')
      .eq('id', parsedInput.service_id)
      .eq('business_id', parsedInput.business_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (!service) throw new Error('[APP] 선택한 서비스를 찾을 수 없습니다')

    // 기본 금액 계산 (평당 단위면 평수 곱하기)
    const baseCalc =
      service.unit === '평당'
        ? service.base_price * (parsedInput.space_size || 1)
        : service.base_price

    // 업체의 quote_tiers 조회 (없으면 기본값 사용)
    const { data: dbTiers } = await db
      .from('quote_tiers')
      .select('tier, label, price_multiplier, highlight')
      .eq('business_id', parsedInput.business_id)
      .order('sort_order')

    const tiers = dbTiers && dbTiers.length > 0 ? dbTiers : DEFAULT_TIERS

    // 각 tier 가격 계산 (천 원 단위 반올림)
    const roundToThousand = (n: number) => Math.round(n / 1000) * 1000

    const goodTier   = tiers.find((t) => t.tier === 'good')
    const betterTier = tiers.find((t) => t.tier === 'better')
    const bestTier   = tiers.find((t) => t.tier === 'best')

    const goodPrice   = roundToThousand(baseCalc * Number(goodTier?.price_multiplier   ?? 1.0))
    const betterPrice = roundToThousand(baseCalc * Number(betterTier?.price_multiplier ?? 1.2))
    const bestPrice   = roundToThousand(baseCalc * Number(bestTier?.price_multiplier   ?? 1.5))

    // 견적 생성 (개인정보 없음 — customer_name/phone은 null)
    const { data: quote, error } = await db
      .from('quotes')
      .insert({
        business_id: parsedInput.business_id,
        cleaning_type: service.name,
        space_size: parsedInput.space_size ?? null,
        preferred_date: parsedInput.preferred_date ?? null,
        extra_notes: parsedInput.extra_notes ?? null,
        good_price: goodPrice,
        better_price: betterPrice,
        best_price: bestPrice,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) throw new Error('[APP] 견적 생성에 실패했습니다')

    // 클라이언트에 반환 (가격 카드 렌더링용)
    return {
      quoteId: quote.id,
      tiers: tiers.map((t) => ({
        tier: t.tier,
        label: t.label,
        price:
          t.tier === 'good'   ? goodPrice :
          t.tier === 'better' ? betterPrice :
          bestPrice,
        highlight: t.highlight,
      })),
    }
  })


// Step 2: 예약 확정 (플랜 선택 + 개인정보 입력)
const createBookingSchema = z.object({
  quote_id: z.string().uuid('올바른 견적 정보가 아닙니다'),
  selected_tier: z.string().refine(
    (val): val is 'good' | 'better' | 'best' => ['good', 'better', 'best'].includes(val),
    '올바른 플랜을 선택해주세요'
  ),
  customer_name: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  customer_phone: z
    .string()
    .min(1, '연락처를 입력해주세요')
    .transform((val) => val.replace(/-/g, ''))
    .refine((val) => phoneRegex.test(val), '올바른 전화번호 형식이 아닙니다'),
  service_address: z.string().min(5, '주소를 입력해주세요'),
})

export const createBookingAction = publicAction
  .schema(createBookingSchema)
  .action(async ({ parsedInput }) => {
    const db = createServiceClient()

    // 견적 조회 (pending 상태인지 확인)
    const { data: quote } = await db
      .from('quotes')
      .select('id, business_id, good_price, better_price, best_price, preferred_date, status')
      .eq('id', parsedInput.quote_id)
      .maybeSingle()

    if (!quote) throw new Error('[APP] 견적 정보를 찾을 수 없습니다')
    if (quote.status !== 'pending') throw new Error('[APP] 이미 처리된 견적입니다')

    // 선택한 tier에 맞는 금액 추출
    const finalPrice =
      parsedInput.selected_tier === 'good'   ? (quote.good_price   ?? 0) :
      parsedInput.selected_tier === 'better' ? (quote.better_price ?? 0) :
      (quote.best_price ?? 0)

    // 예약 생성
    const scheduledAt = quote.preferred_date
      ? new Date(quote.preferred_date).toISOString()
      : new Date().toISOString()

    const { error: bookingError } = await db.from('bookings').insert({
      business_id: quote.business_id,
      quote_id: quote.id,
      customer_name: parsedInput.customer_name,
      customer_phone: parsedInput.customer_phone,
      service_address: parsedInput.service_address,
      scheduled_at: scheduledAt,
      selected_tier: parsedInput.selected_tier,
      final_price: finalPrice,
      status: 'confirmed',
    })

    if (bookingError) throw new Error('[APP] 예약 생성에 실패했습니다')

    // 견적 상태를 'booked'로 업데이트
    await db
      .from('quotes')
      .update({ status: 'booked' })
      .eq('id', quote.id)

    return { success: true }
  })
