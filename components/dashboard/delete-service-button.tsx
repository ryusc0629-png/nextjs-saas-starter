'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteServiceItemAction } from '@/lib/actions/services'

export function DeleteServiceButton({ id }: { id: string }) {
  const { execute, isPending } = useAction(deleteServiceItemAction, {
    onSuccess: () => toast.success('서비스가 삭제되었습니다'),
    onError: ({ error }) => toast.error(error.serverError ?? '삭제에 실패했습니다'),
  })

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (confirm('이 서비스를 삭제하시겠습니까?')) execute({ id })
      }}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
