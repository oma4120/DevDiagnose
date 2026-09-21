import { MoreHorizontal, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toast'
import type { Role } from '@/lib/types'

const roleBadge: Record<Role, string> = {
  Admin: 'border-amber-200 bg-amber-50 text-amber-700',
  QA: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  Developer: 'border-indigo-200 bg-indigo-50 text-indigo',
}

const statusBadge: Record<string, string> = {
  Active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Invited: 'border-slate-200 bg-slate-100 text-slate-600',
  Inactive: 'border-red-200 bg-red-50 text-red-700',
}

export default function TeamPage() {
  const { toast } = useToast()
  const { members } = useData()

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Team"
        description="Manage members and roles across your workspace."
        actions={
          <button
            onClick={() => toast({ kind: 'success', title: 'Invite sent', description: 'A workspace invitation was emailed.' })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
          >
            <UserPlus className="size-4" />
            Invite Member
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-soft text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Assigned</th>
                <th className="px-4 py-2.5 text-right font-medium">Resolved</th>
                <th className="px-4 py-2.5 font-medium">Last active</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-soft/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} color={m.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', roleBadge[m.role])}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', statusBadge[m.status])}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{m.assignedBugs}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{m.resolvedBugs}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.lastActive}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toast({ kind: 'info', title: 'Member actions', description: 'Edit role, deactivate, or view profile.' })}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Actions for ${m.name}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}