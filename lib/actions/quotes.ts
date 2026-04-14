'use server'

import { z } from 'zod'
import { createSafeActionClient } from 'next-safe-action'
import { createServiceClient } from '@/lib/supabase/server'

// 공개 폼용 액션 클라이언트 (인증 불필요)
const publicAction = createSafeActionClient({
  handleServerError(e) {
    return e.message
  },
})

// 한국 전화번호 검증
const phoneRegex = /^(010|011|016|017|018|019|02|0[3-9]\d)\d{7,8}$/

// 견적 요청 스키마 (고객이 공개 폼에서 제출)
const createQuoteSchema = z.object({
  business_id: z.string().uuid('올바른 업체 정보가 아닙니다'),
  customer_name: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  customer_phone: z
    .string()
    .min(1, '연락처를 입력해주세요')
    .transform((val) => val.replace(/-/g, ''))
    .refine((val) => phoneRegex.test(val), '올바른 전화번호 형식이 아닙니다'),
  cleaning_type: z.string().min(1, '서비스를 선택해주세요'),
  space_size: z.coerce.number().min(1).max(300).optional(),
  preferred_date: z.string().optional(),
  extra_notes: z.string().max(500).optional(),
})

// 공개 견적 요청 액션 — 비로그인 고객이 사용
export const createQuoteAction = publicAction
  .schema(createQuoteSchema)
  .action(async ({ parsedInput }) => {
    const db = createServiceClient()

    // 업체 존재 여부 확인
    const { data: business } = await db
      .from('businesses')
      .select('id')
      .eq('id', parsedInput.business_id)
      .maybeSingle()

    if (!business) throw new Error('존재하지 않는 업체입니다')

    // 견적 생성
    const { error } = await db.from('quotes').insert({
      business_id: parsedInput.business_id,
      customer_name: parsedInput.customer_name,
      customer_phone: parsedInput.customer_phone,
      cleaning_type: parsedInput.cleaning_type,
      space_size: parsedInput.space_size ?? null,
      preferred_date: parsedInput.preferred_date ?? null,
      extra_notes: parsedInput.extra_notes ?? null,
      status: 'pending',
    })

    if (error) throw new Error('견적 요청에 실패했습니다')

    return { success: true }
  })
