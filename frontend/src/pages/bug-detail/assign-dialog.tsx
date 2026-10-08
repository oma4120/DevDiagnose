import { createPortal } from 'react-dom'
import { Check, UserPlus, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Member, Role } from '@/lib/types'

const roleBadge: Record<Role, string> = {
  Admin: 'border-amber-200 bg-amber-50 text-amber-700',
  QA: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  Developer: 'border-indigo-200 bg-indigo-50 text-indigo-700',
}

export function AssignDialog({
  projectName,
  teamMembers,
  selected,
  onToggle,
  assigning,
  onSave,
  onClose,
}: {
  projectName?: string
  teamMembers: Member[]
  selected: string[]
  onToggle: (id: string) => void
  assigning: boolean
  onSave: () => void
  onClose: () => void
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between !py-4">
            <CardTitle>Assign bug</CardTitle>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
              <X className="size-4" />
            </button>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Pick from the {projectName ?? 'project'} team - only team members can be assigned.
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {teamMembers.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No team members yet - add them from the project&apos;s Team tab.
                </p>
              ) : (
                teamMembers.map((m) => {
                  const on = selected.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => onToggle(m.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <Avatar name={m.name} color={m.avatarColor} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{m.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                      </span>
                      <span className={cn('inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium', roleBadge[m.role])}>
                        {m.role}
                      </span>
                      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded border', on ? 'border-indigo bg-indigo text-white' : 'border-border')}>
                        {on && <Check className="size-3.5" />}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={assigning}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:bg-indigo/90 disabled:opacity-60"
              >
                <UserPlus className="size-4" />
                {assigning ? 'Saving…' : 'Save assignees'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>,
    document.body,
  )
}
