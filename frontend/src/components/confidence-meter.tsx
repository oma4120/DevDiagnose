import { cn } from '@/lib/utils'

export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  const level = value >= 80 ? 'high' : value >= 55 ? 'medium' : 'low'
  const color =
    level === 'high' ? 'bg-success' : level === 'medium' ? 'bg-warning' : 'bg-error'
  const label =
    level === 'high' ? 'High confidence' : level === 'medium' ? 'Moderate confidence' : 'Low confidence'

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground">{value}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`AI confidence ${value} percent`}
      >
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}