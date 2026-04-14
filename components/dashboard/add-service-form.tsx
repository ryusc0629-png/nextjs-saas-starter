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
import { createServiceItemAction } from '@/lib/actions/services'
import { Plus, X } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, '서비스명을 입력해주세요'),
  category: z.string().optional(),
  base_price: z.coerce.number().min(0, '0 이상의 금액을 입력해주세요'),
  unit: z.enum(['회', '㎡', '시간', '개']),
})

type FormInput = z.infer<typeof schema>

export function AddServiceForm() {
  const [open, setOpen] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { unit: '회', base_price: 0 },
  })

  const { execute, isPending } = useAction(createServiceItemAction, {
    onSuccess: () => {
      toast.success('서비스가 추가되었습니다')
      reset()
      setOpen(false)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? '서비스 추가에 실패했습니다')
    },
  })

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="h-4 w-4 mr-1" />
        서비스 추가
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit((data) => execute(data))}
      className="rounded-lg border bg-card p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">새 서비스 추가</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 서비스명 */}
        <div className="col-span-2 space-y-1">
          <Label htmlFor="name">서비스명 *</Label>
          <Input id="name" placeholder="예) 가정집 청소" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* 카테고리 */}
        <div className="space-y-1">
          <Label htmlFor="category">카테고리</Label>
          <Input id="category" placeholder="예) 청소/소독" {...register('category')} />
        </div>

        {/* 단위 */}
        <div className="space-y-1">
          <Label htmlFor="unit">단위 *</Label>
          <select
            id="unit"
            {...register('unit')}
            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="회">회</option>
            <option value="㎡">㎡ (평방미터)</option>
            <option value="시간">시간</option>
            <option value="개">개</option>
          </select>
        </div>

        {/* 기본가 */}
        <div className="col-span-2 space-y-1">
          <Label htmlFor="base_price">기본 가격 (원) *</Label>
          <Input
            id="base_price"
            type="number"
            placeholder="예) 80000"
            {...register('base_price')}
          />
          {errors.base_price && (
            <p className="text-xs text-destructive">{errors.base_price.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          취소
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? '추가 중...' : '추가'}
        </Button>
      </div>
    </form>
  )
}
