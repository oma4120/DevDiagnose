import { Link } from 'react-router-dom'
import { MessageSquare, Paperclip, Sparkles } from 'lucide-react'
import { AvatarGroup } from '@/components/ui/avatar'
import { CategoryBadge, PriorityBadge, SeverityBadge } from '@/components/badges'
import { cn } from '@/lib/utils'
import type { Bug, BugStatus, Member } from '@/lib/types'

export const BOARD_COLUMNS = [
  { id: 'pending', label: 'Pending', statuses: ['Draft', 'Submitted', 'Assigned'] as BugStatus[], dot: 'bg-violet-500' },
  { id: 'in-progress', label: 'In Progress', statuses: ['In Progress'] as BugStatus[], dot: 'bg-blue-500' },
  { id: 'review', label: 'Review', statuses: ['QA Validation'] as BugStatus[], dot: 'bg-amber-500' },
  { id: 'done', label: 'Done', statuses: ['Resolved', 'Closed'] as BugStatus[], dot: 'bg-emerald-500' },
]

const allStatuses: BugStatus[] = ['Draft', 'Submitted', 'Assigned', 'In Progress', 'Resolved', 'QA Validation', 'Closed']

export interface BugBoardProps {
  bugs: Bug[]
  members: Member[]
  onStatusChange?: (id: string, status: BugStatus) => void
  className?: string
}

export function BugBoard({ bugs, members, onStatusChange, className }: BugBoardProps) {
  return (
    <div className={cn('grid gap-3 overflow-x-auto pb-1 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {BOARD_COLUMNS.map((col) => {
        const items = bugs.filter((b) => col.statuses.includes(b.status))
        return (
          <div key={col.id} className="flex min-w-[240px] flex-col rounded-xl border border-border bg-soft/50">
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
              <span className={cn('size-2 rounded-full', col.dot)} />
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{col.label}</span>
              <span className="ml-auto rounded-full bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="space-y-2 p-2">
              {items.map((b) => (
                <BugBoardCard key={b.id} bug={b} members={members} onStatusChange={onStatusChange} />
              ))}
              {items.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
                  Nothing here
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BugBoardCard({
  bug,
  members,
  onStatusChange,
}: {
  bug: Bug
  members: Member[]
  onStatusChange?: (id: string, status: BugStatus) => void
}) {
  const people = bug.assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => ({ name: m.name, color: m.avatarColor }))

  return (
    <div className="group rounded-lg border border-border bg-card p-2.5 shadow-sm transition-colors hover:border-indigo/40">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/bugs/${bug.id}`} className="font-mono text-[11px] text-muted-foreground group-hover:text-indigo">
          {bug.ref}
        </Link>
        {bug.analyses.length > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-indigo/20 bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
            <Sparkles className="size-2.5" />AI
          </span>
        )}
      </div>
      <Link to={`/bugs/${bug.id}`} className="mt-1 block text-sm font-medium leading-snug text-foreground hover:text-indigo">
        {bug.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SeverityBadge severity={bug.severity} />
        <PriorityBadge priority={bug.priority} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <CategoryBadge category={bug.category} />
        <span className="text-[11px] text-muted-foreground">{bug.updatedAt}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        {people.length ? (
          <AvatarGroup people={people} size="xs" max={3} />
        ) : (
          <span className="text-[11px] text-muted-foreground">Unassigned</span>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {bug.evidence.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px]">
              <Paperclip className="size-3" />
              {bug.evidence.length}
            </span>
          )}
          {bug.comments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px]">
              <MessageSquare className="size-3" />
              {bug.comments.length}
            </span>
          )}
        </div>
      </div>
      {onStatusChange && (
        <select
          value={bug.status}
          onChange={(e) => onStatusChange(bug.id, e.target.value as BugStatus)}
          aria-label={`Move ${bug.ref}`}
          className="mt-2 h-7 w-full cursor-pointer rounded-md border border-border bg-soft px-1.5 text-[11px] font-medium text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {allStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}