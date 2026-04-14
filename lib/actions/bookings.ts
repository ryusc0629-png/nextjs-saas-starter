'use server'

import { z } from 'zod'
import { action } from '@/lib/safe-action'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 한국 전화번호 검증
const phoneRegex = /^(010|011|016|017|018|019|02|0[3-9]\d)\d{7,8}$/

// 수동 예약 추가 스키마 (사장님이 전화로 받은 예약)
const addBookingSchema = z.object({
  customer_name: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  customer_phone: z
    .string()
    .min(1, '연락처를 입력해주세요')
    .transform((val) => val.replace(/-/g, ''))
    .refine((val) => phoneRegex.test(val), '올바른 전화번호 형식이 아닙니다'),
  service_address: z.string().min(5, '주소를 입력해주세요'),
  cleaning_type: z.string().min(1, '서비스명을 입력해주세요'),
  scheduled_at: z.string().min(1, '예약 일시를 입력해주세요'),
  final_price: z.coerce.number().min(0, '0 이상의 금액을 입력해주세요'),
  memo: z.string().max(500).optional(),
})

// 예약 상태 변경 스키마
const VALID_STATUSES = ['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] as const

const updateBookingStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.string().refine(
    (val): val is typeof VALID_STATUSES[number] => (VALID_STATUSES as readonly string[]).includes(val),
    '올바른 상태값이 아닙니다'
  ),
})

// 수동 예약 추가 액션 (사장님 전용)
export const addBookingAction = action
  .schema(addBookingSchema)
  .action(async ({ parsedInput }) => {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) throw new Error('[APP] 로그인이 필요합니다')

    const db = createServiceClient()
    const { data: profile } = await db
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.business_id) throw new Error('[APP] 업체 정보를 찾을 수 없습니다')

    const { error } = await db.from('bookings').insert({
      business_id: profile.business_id,
      quote_id: null,
      customer_name: parsedInput.customer_name,
      customer_phone: parsedInput.customer_phone,
      service_address: parsedInput.service_address,
      scheduled_at: new Date(parsedInput.scheduled_at).toISOString(),
      selected_tier: 'good',
      final_price: parsedInput.final_price,
      memo: parsedInput.memo ?? null,
      status: 'confirmed',
    })

    if (error) throw new Error('[APP] 예약 추가에 실패했습니다')

    revalidatePath('/dashboard/bookings')
    return { success: true }
  })

// 예약 상태 변경 액션 (사장님 전용)
export const updateBookingStatusAction = action
  .schema(updateBookingStatusSchema)
  .action(async ({ parsedInput }) => {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) throw new Error('[APP] 로그인이 필요합니다')

    const db = createServiceClient()
    const { data: profile } = await db
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.business_id) throw new Error('[APP] 업체 정보를 찾을 수 없습니다')

    // 본인 업체 예약인지 확인 후 상태 업데이트
    const { error } = await db
      .from('bookings')
      .update({
        status: parsedInput.status,
        ...(parsedInput.status === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
      })
      .eq('id', parsedInput.id)
      .eq('business_id', profile.business_id)

    if (error) throw new Error('[APP] 상태 변경에 실패했습니다')

    revalidatePath('/dashboard/bookings')
    return { success: true }
  })
