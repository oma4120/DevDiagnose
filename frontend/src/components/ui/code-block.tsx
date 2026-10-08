import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CodeBlock({
  code,
  label,
  language,
  className,
}: {
  code: string
  label?: string
  language?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-slate-800 bg-navy', className)}>
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-slate-400">
          {label ?? language ?? 'code'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="scroll-thin overflow-x-auto p-3">
        <code className="font-mono text-xs leading-relaxed text-slate-100">{code}</code>
      </pre>
    </div>
  )
}