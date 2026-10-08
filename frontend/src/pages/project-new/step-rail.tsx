import {
  Boxes,
  Check,
  FileText,
  Layers,
  ScrollText,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const steps = [
  { id: 1, label: 'Basic Information', icon: FileText },
  { id: 2, label: 'Technology', icon: Boxes },
  { id: 3, label: 'Team', icon: Users },
  { id: 4, label: 'Environment', icon: Server },
  { id: 5, label: 'Architecture', icon: Layers },
  { id: 6, label: 'Business Rules', icon: ScrollText },
  { id: 7, label: 'Quality & References', icon: ShieldCheck },
  { id: 8, label: 'Review', icon: Check },
]

export function StepRail({ step, onSelect }: { step: number; onSelect: (id: number) => void }) {
  return (
    <ol className="hidden space-y-1 md:block">
      {steps.map((s) => {
        const done = step > s.id
        const active = step === s.id
        return (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs',
                  done && 'border-emerald-500 bg-emerald-500 text-white',
                  active && 'border-indigo bg-indigo text-white',
                  !done && !active && 'border-border text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" /> : s.id}
              </span>
              {s.label}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
