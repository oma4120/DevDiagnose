import { cn } from '@/lib/utils'
import { useData } from '@/lib/data-context'
import { statusLabel } from '@/lib/status-rules'
import type { BugStatus, Category, Priority, Severity } from '@/lib/types'

const base =
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap'

function Dot({ className }: { className?: string }) {
  return <span className={cn('size-1.5 rounded-full', className)} aria-hidden />
}

const statusStyles: Record<BugStatus, { cls: string; dot: string }> = {
  Draft: { cls: 'border-border bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  Submitted: { cls: 'border-slate-200 bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
  Assigned: { cls: 'border-violet-200 bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  'In Progress': { cls: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  Resolved: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  'QA Validation': { cls: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  Closed: { cls: 'border-slate-200 bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
}

export function StatusBadge({ status, className }: { status: BugStatus; className?: string }) {
  const { hasQA } = useData()
  const s = statusStyles[status]
  return (
    <span className={cn(base, s.cls, className)}>
      <Dot className={s.dot} />
      {statusLabel(status, hasQA)}
    </span>
  )
}

const severityStyles: Record<Severity, string> = {
  Critical: 'border-red-200 bg-red-50 text-red-700',
  High: 'border-orange-200 bg-orange-50 text-orange-700',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  Low: 'border-slate-200 bg-slate-100 text-slate-600',
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return <span className={cn(base, severityStyles[severity], className)}>{severity}</span>
}

const priorityStyles: Record<Priority, string> = {
  Urgent: 'border-red-200 bg-red-50 text-red-700',
  High: 'border-orange-200 bg-orange-50 text-orange-700',
  Medium: 'border-blue-200 bg-blue-50 text-blue-700',
  Low: 'border-slate-200 bg-slate-100 text-slate-600',
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return <span className={cn(base, priorityStyles[priority], className)}>{priority}</span>
}

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cn(base, 'border-border bg-muted text-muted-foreground', className)}>
      {category}
    </span>
  )
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-soft px-2 py-0.5 text-xs font-medium text-slate-700',
        className,
      )}
    >
      {children}
    </span>
  )
}