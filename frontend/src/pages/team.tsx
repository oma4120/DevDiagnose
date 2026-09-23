import { useState } from 'react'
import { MoreHorizontal, UserPlus, X } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/field'
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
  const { currentUser, members, addMemberByName } = useData()
  const isAdmin = currentUser.role === 'Admin'

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [empRole, setEmpRole] = useState<Role>('Developer')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const member = await addMemberByName({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), role: empRole })
      toast({ kind: 'success', title: 'Employee added', description: `${member.name} was added to your team.` })
      setOpen(false)
      setFirstName('')
      setLastName('')
      setEmail('')
      setEmpRole('Developer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the employee')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Team"
        description="Manage members and roles across your workspace."
        actions={
          isAdmin ? (
            <button
              onClick={() => setOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
            >
              <UserPlus className="size-4" />
              Add employee
            </button>
          ) : undefined
        }
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between !py-4">
                <CardTitle>Add employee by name</CardTitle>
                <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
                  <X className="size-4" />
                </button>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Add someone who is already part of the company. Their profile is stored
                    immediately — no invitation email is sent.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="mfname">First name</Label>
                      <Input id="mfname" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ada" />
                    </div>
                    <div>
                      <Label htmlFor="mlname">Last name</Label>
                      <Input id="mlname" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Lovelace" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="memail">Email</Label>
                    <Input id="memail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ada@company.com" />
                  </div>

                  <div>
                    <Label htmlFor="mrole">Role</Label>
                    <Select id="mrole" value={empRole} onChange={(e) => setEmpRole(e.target.value as Role)}>
                      <option>Developer</option>
                      <option>QA</option>
                    </Select>
                  </div>

                  {error && <p className="text-sm text-error">{error}</p>}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:opacity-60"
                    >
                      {busy ? 'Adding…' : 'Add employee'}
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

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
                      <Avatar name={m.name || m.email} color={m.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{m.name || m.email}</p>
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
                      aria-label={`Actions for ${m.name || m.email}`}
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