import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'text-muted-foreground',
  hint,
}: {
  label: string
  value: string | number
  icon?: LucideIcon
  accent?: string
  hint?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn('size-4', accent)} />}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}