import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const sizes = {
  xs: 'size-5 text-[10px]',
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
}

export function Avatar({
  name,
  color = '#6366f1',
  size = 'md',
  className,
}: {
  name: string
  color?: string
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-background',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color }}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
}: {
  people: { name: string; color?: string }[]
  max?: number
  size?: keyof typeof sizes
}) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} color={p.color} size={size} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-background',
            sizes[size],
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}