import { createPortal } from 'react-dom'
import { Trash2, UserPlus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, FieldHint } from '@/components/ui/field'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Member, Role } from '@/lib/types'
import { StepShell } from './step-shell'

const roleBadge: Record<Role, string> = {
  Admin: 'border-amber-200 bg-amber-50 text-amber-700',
  QA: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  Developer: 'border-indigo bg-indigo-50 text-indigo',
}

export function TeamSection({
  teamMembers,
  isAdmin,
  addOpen,
  addQuery,
  availableEmployees,
  filteredEmployees,
  onAddOpenChange,
  onAddQueryChange,
  onAddSelected,
  onRemoveMember,
  onOpenAdd,
}: {
  teamMembers: Member[]
  isAdmin: boolean
  addOpen: boolean
  addQuery: string
  availableEmployees: Member[]
  filteredEmployees: Member[]
  onAddOpenChange: (open: boolean) => void
  onAddQueryChange: (query: string) => void
  onAddSelected: (m: Member) => void
  onRemoveMember: (id: string) => void
  onOpenAdd: () => void
}) {
  return (
    <>
      {addOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => onAddOpenChange(false)}>
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between !py-4">
                  <CardTitle>Add team member</CardTitle>
                  <button onClick={() => onAddOpenChange(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
                    <X className="size-4" />
                  </button>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Add a registered employee by name. They&apos;ll get access to this project.
                  </p>
                  <Input
                    autoFocus
                    placeholder="Search by name or email…"
                    value={addQuery}
                    onChange={(e) => onAddQueryChange(e.target.value)}
                    className="mb-3"
                  />
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {filteredEmployees.length === 0 ? (
                      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        {availableEmployees.length === 0
                          ? 'Every registered employee is already on this team.'
                          : 'No employee matches that name.'}
                      </p>
                    ) : (
                      filteredEmployees.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => onAddSelected(m)}
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
                        </button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>,
          document.body,
        )}

      <StepShell title="Team" desc={`${teamMembers.length} registered employee${teamMembers.length === 1 ? '' : 's'} selected for this project.`}>
        <div className="space-y-2">
          {teamMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
              <Avatar name={m.name} color={m.avatarColor} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{m.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
              </span>
              <span className={cn('inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium', roleBadge[m.role])}>
                {m.role}
              </span>
              <button
                onClick={() => onRemoveMember(m.id)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-error"
                aria-label={`Remove ${m.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {teamMembers.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No team members selected yet.
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={onOpenAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:border-indigo hover:text-indigo"
          >
            <UserPlus className="size-4" />Add member
          </button>
        )}
        <FieldHint>Employees are selected from members registered in this workspace.</FieldHint>
      </StepShell>
    </>
  )
}
