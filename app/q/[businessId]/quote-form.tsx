'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createQuoteAction } from '@/lib/actions/quotes'

const phoneRegex = /^(010|011|016|017|018|019|02|0[3-9]\d)\d{7,8}$/

const schema = z.object({
  customer_name: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  customer_phone: z
    .string()
    .min(1, '연락처를 입력해주세요')
    .transform((val) => val.replace(/-/g, ''))
    .refine((val) => phoneRegex.test(val), '올바른 전화번호 형식이 아닙니다'),
  cleaning_type: z.string().min(1, '서비스를 선택해주세요'),
  space_size: z.coerce.number().min(1).max(300).optional().or(z.literal('')),
  preferred_date: z.string().optional(),
  extra_notes: z.string().max(500).optional(),
})

type FormInput = z.infer<typeof schema>

interface ServiceItem {
  id: string
  name: string
  base_price: number
  unit: string
}

interface QuoteFormProps {
  businessId: string
  services: ServiceItem[]
}

export function QuoteForm({ businessId, services }: QuoteFormProps) {
  const [submitted, setSubmitted] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(schema),
  })

  const { execute, isPending } = useAction(createQuoteAction, {
    onSuccess: () => setSubmitted(true),
    onError: ({ error }) => toast.error(error.serverError ?? '견적 요청에 실패했습니다'),
  })

  const onSubmit = (data: FormInput) => {
    execute({
      business_id: businessId,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      cleaning_type: data.cleaning_type,
      space_size: data.space_size ? Number(data.space_size) : undefined,
      preferred_date: data.preferred_date || undefined,
      extra_notes: data.extra_notes || undefined,
    })
  }

  if (submitted) {
    return (
      <div className="text-center py-10 space-y-3">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-bold">견적 요청이 완료됐습니다</h2>
        <p className="text-muted-foreground text-sm">
          담당자가 확인 후 빠르게 연락드리겠습니다.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* 고객 정보 */}
      <div className="space-y-1">
        <Label htmlFor="customer_name">이름 *</Label>
        <Input id="customer_name" placeholder="홍길동" {...register('customer_name')} />
        {errors.customer_name && (
          <p className="text-xs text-destructive">{errors.customer_name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="customer_phone">연락처 *</Label>
        <Input id="customer_phone" type="tel" placeholder="010-1234-5678" {...register('customer_phone')} />
        {errors.customer_phone && (
          <p className="text-xs text-destructive">{errors.customer_phone.message}</p>
        )}
      </div>

      {/* 서비스 선택 */}
      <div className="space-y-1">
        <Label htmlFor="cleaning_type">서비스 선택 *</Label>
        {services.length > 0 ? (
          <select
            id="cleaning_type"
            {...register('cleaning_type')}
            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            defaultValue=""
          >
            <option value="" disabled>서비스를 선택해주세요</option>
            {services.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} — {s.base_price.toLocaleString()}원/{s.unit}부터
              </option>
            ))}
          </select>
        ) : (
          <Input id="cleaning_type" placeholder="원하시는 서비스를 입력해주세요" {...register('cleaning_type')} />
        )}
        {errors.cleaning_type && (
          <p className="text-xs text-destructive">{errors.cleaning_type.message}</p>
        )}
      </div>

      {/* 평수 */}
      <div className="space-y-1">
        <Label htmlFor="space_size">평수 (선택)</Label>
        <Input id="space_size" type="number" placeholder="예) 25" {...register('space_size')} />
      </div>

      {/* 희망일 */}
      <div className="space-y-1">
        <Label htmlFor="preferred_date">희망 날짜 (선택)</Label>
        <Input id="preferred_date" type="date" {...register('preferred_date')} />
      </div>

      {/* 메모 */}
      <div className="space-y-1">
        <Label htmlFor="extra_notes">추가 요청사항 (선택)</Label>
        <textarea
          id="extra_notes"
          {...register('extra_notes')}
          placeholder="특이사항이나 요청사항을 입력해주세요"
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? '요청 중...' : '견적 요청하기'}
      </Button>
    </form>
  )
}
