'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface CopyLinkButtonProps {
  url: string
}

export function CopyLinkButton({ url }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono truncate">
        {url}
      </code>
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        {copied ? '복사됨' : '복사'}
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={url} target="_blank">
          <ExternalLink className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
