import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Bell, CheckCheck, Sparkles, ShieldCheck, UserPlus, Cog } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useData } from '@/lib/data-context'
import type { NotificationItem } from '@/lib/types'

const categoryMeta: Record<
  NotificationItem['category'],
  { icon: typeof Bell; cls: string }
> = {
  Assignment: { icon: UserPlus, cls: 'bg-violet-50 text-violet-600 border-violet-200' },
  AI: { icon: Sparkles, cls: 'bg-indigo-50 text-indigo border-indigo-200' },
  Validation: { icon: ShieldCheck, cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  System: { icon: Cog, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const filters = ['All', 'Assignment', 'AI', 'Validation', 'System'] as const

export default function NotificationsPage() {
  const { notifications, markAllNotificationsRead } = useData()
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')

  const shown = filter === 'All' ? notifications : notifications.filter((n) => n.category === filter)
  const markAll = () => markAllNotificationsRead()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Notifications"
        description="Assignments, AI activity, and validation updates."
        actions={
          <button
            onClick={markAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            <CheckCheck className="size-4" />
            Mark all read
          </button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              filter === f
                ? 'border-indigo bg-indigo text-white'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-border overflow-hidden">
        {shown.map((n) => {
          const meta = categoryMeta[n.category]
          const Icon = meta.icon
          const body = (
            <div className={cn('flex items-start gap-3 px-4 py-3.5', !n.read && 'bg-accent/30')}>
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg border', meta.cls)}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{n.message}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {n.category} · {n.at}
                </p>
              </div>
              {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo" />}
            </div>
          )
          return n.bugRef ? (
            <Link key={n.id} to={`/bugs/b${n.bugRef.replace('#', '')}`} className="block hover:bg-soft">
              {body}
            </Link>
          ) : (
            <div key={n.id}>{body}</div>
          )
        })}
      </Card>
    </div>
  )
}