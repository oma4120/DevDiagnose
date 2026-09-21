import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BugStatus } from '@/lib/types'

const fullFlow: BugStatus[] = [
  'Draft',
  'Submitted',
  'Assigned',
  'In Progress',
  'Resolved',
  'QA Validation',
  'Closed',
]

const noQAFlow: BugStatus[] = ['Draft', 'Submitted', 'Assigned', 'In Progress', 'Resolved']

export function WorkflowTracker({
  status,
  hasQA = true,
  fixer,
  validator,
}: {
  status: BugStatus
  hasQA?: boolean
  fixer?: string
  validator?: string
}) {
  const flow = hasQA ? fullFlow : noQAFlow
  const currentIndex = Math.max(0, flow.indexOf(status))

  return (
    <div className="space-y-3">
      <ol className="scroll-thin flex items-center gap-1 overflow-x-auto pb-1">
        {flow.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          return (
            <li key={step} className="flex items-center gap-1">
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                  done && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  active && 'border-indigo bg-indigo text-white shadow-sm',
                  !done && !active && 'border-border bg-card text-muted-foreground',
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full text-[10px]',
                    done && 'bg-emerald-500 text-white',
                    active && 'bg-white/25 text-white',
                    !done && !active && 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-2.5" /> : i + 1}
                </span>
                {step}
              </div>
              {i < flow.length - 1 && (
                <span className={cn('h-px w-4 shrink-0', done ? 'bg-emerald-300' : 'bg-border')} aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
      {(fixer || validator) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {fixer && (
            <span className="text-muted-foreground">
              Fixer: <span className="font-medium text-foreground">{fixer}</span>
            </span>
          )}
          {validator && (
            <span className="text-muted-foreground">
              Validator: <span className="font-medium text-foreground">{validator}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}