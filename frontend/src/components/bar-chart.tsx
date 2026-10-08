import { cn } from '@/lib/utils'

export interface BarDatum {
  label: string
  value: number
  color: string
}

export function BarChart({ data, className }: { data: BarDatum[]; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className={cn('space-y-3', className)}>
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[110px_1fr_32px] items-center gap-3">
          <span className="truncate text-xs font-medium text-muted-foreground">{d.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
            />
          </div>
          <span className="text-right font-mono text-xs font-medium text-foreground">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DonutChart({
  data,
  total,
  centerLabel,
}: {
  data: BarDatum[]
  total: number
  centerLabel?: string
}) {
  const sum = data.reduce((a, b) => a + b.value, 0) || 1
  let offset = 0
  const radius = 42
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--muted)" strokeWidth="12" />
          {data.map((d) => {
            const len = (d.value / sum) * circumference
            const seg = (
              <circle
                key={d.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth="12"
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return seg
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-foreground">{total}</span>
          {centerLabel && <span className="text-[11px] text-muted-foreground">{centerLabel}</span>}
        </div>
      </div>
      <ul className="flex-1 space-y-1.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
              <span className="text-muted-foreground">{d.label}</span>
            </span>
            <span className="font-mono font-medium text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}