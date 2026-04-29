'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { deleteCustomerAction } from '@/lib/actions/customers'
import { Trash2 } from 'lucide-react'

interface DeleteCustomerButtonProps {
  customerId: string
  customerName: string
  hasContract: boolean
}

export function DeleteCustomerButton({ customerId, customerName, hasContract }: DeleteCustomerButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    const message = hasContract
      ? `"${customerName}" 고객을 삭제하시겠습니까?\n\n연결된 계약 정보도 함께 삭제됩니다.`
      : `"${customerName}" 고객을 삭제하시겠습니까?`

    if (!window.confirm(message)) return

    startTransition(async () => {
      const result = await deleteCustomerAction({ customerId })
      if (result?.serverError) {
        toast.error(result.serverError)
      } else {
        toast.success('고객이 삭제되었습니다')
      }
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
      title="삭제"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
