import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { CategoryBadge } from '@/components/badges'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { statusLabel } from '@/lib/status-rules'
import type { Bug, BugStatus, Member } from '@/lib/types'

function timelineColor(kind: Bug['timeline'][number]['kind']) {
  switch (kind) {
    case 'ai':
      return 'bg-violet-500'
    case 'resolved':
    case 'validated':
      return 'bg-emerald-500'
    case 'assigned':
      return 'bg-blue-500'
    case 'closed':
      return 'bg-slate-400'
    case 'edited':
      return 'bg-amber-500'
    default:
      return 'bg-indigo'
  }
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

export function SidebarCards({
  bug,
  reporter,
  assignees,
  validator,
  statusOptions,
  hasQA,
  canValidate,
  canReject,
  onStatusChange,
}: {
  bug: Bug
  reporter: Member | undefined
  assignees: Member[]
  validator: Member | undefined
  statusOptions: BugStatus[]
  hasQA: boolean
  canValidate: boolean
  canReject: boolean
  onStatusChange: (status: BugStatus) => void
}) {
  return (
    <aside className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <MetaRow label="Reporter">
            {reporter && (
              <span className="flex items-center gap-1.5"><Avatar name={reporter.name} color={reporter.avatarColor} size="xs" />{reporter.name}</span>
            )}
          </MetaRow>
          <MetaRow label="Assignee">
            {assignees.length ? (
              <span className="flex items-center gap-1.5"><Avatar name={assignees[0].name} color={assignees[0].avatarColor} size="xs" />{assignees[0].name}</span>
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </MetaRow>
          {validator && (
            <MetaRow label="Validator">
              <span className="flex items-center gap-1.5"><Avatar name={validator.name} color={validator.avatarColor} size="xs" />{validator.name}</span>
            </MetaRow>
          )}
          <MetaRow label="Category"><CategoryBadge category={bug.category} /></MetaRow>
          <MetaRow label="Created"><span className="text-muted-foreground">{bug.createdAt}</span></MetaRow>
          <MetaRow label="Updated"><span className="text-muted-foreground">{bug.updatedAt}</span></MetaRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {statusOptions.length > 0 ? (
            <Select
              value={bug.status}
              onChange={(e) => onStatusChange(e.target.value as BugStatus)}
            >
              {[bug.status, ...statusOptions.filter((s) => s !== bug.status)].map((s) => (
                <option key={s} value={s}>{statusLabel(s, hasQA)}</option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              No status actions available for your role.
            </p>
          )}
          {(canValidate || canReject) && (
            <div className="grid grid-cols-2 gap-2">
              {canValidate && (
                <button onClick={() => onStatusChange('Closed')} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-600/90">
                  <Check className="size-4" />Validate
                </button>
              )}
              {canReject && (
                <button onClick={() => onStatusChange('In Progress')} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                  Reject
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {bug.timeline.map((t, i) => (
              <li key={t.id} className="relative flex gap-3 pb-1">
                {i < bug.timeline.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden />}
                <span className={cn('mt-1 size-3.5 shrink-0 rounded-full ring-4 ring-card', timelineColor(t.kind))} />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.actor} · {t.at}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </aside>
  )
}
