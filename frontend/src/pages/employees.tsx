import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Mail, Trash2, UserPlus, X } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/field'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useData } from '@/lib/data-context'
import { useToast } from '@/components/ui/toast'
import { checkEmail, errorMessage } from '@/lib/validation'
import type { InviteResult, Role } from '@/lib/types'

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

export default function EmployeesPage() {
  const { toast } = useToast()
  const { currentUser, members, hasQA, inviteMemberByEmail, removeMember } = useData()
  const isAdmin = currentUser.role === 'Admin'

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [empRole, setEmpRole] = useState<Role>('Developer')
  const [lastInvite, setLastInvite] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!hasQA && empRole === 'QA') setEmpRole('Developer')
  }, [hasQA, empRole])

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setEmpRole('Developer')
    setError(null)
    setLastInvite(null)
    setCopied(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const emailError = checkEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    setBusy(true)
    try {
      const result = await inviteMemberByEmail(email.trim(), empRole, firstName.trim(), lastName.trim())
      setLastInvite(result)
      setEmail('')
      setFirstName('')
      setLastName('')
      toast({
        kind: 'success',
        title: 'Invitation sent',
        description: result.emailSent
          ? `${result.email} was emailed a setup link.`
          : 'Invitation created. Add SMTP settings to actually email the link.',
      })
    } catch (err) {
      setError(errorMessage(err, 'Could not invite the employee'))
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    if (!lastInvite) return
    try {
      await navigator.clipboard.writeText(lastInvite.inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Employees"
        description="Manage employees and roles across your workspace."
        actions={
          isAdmin ? (
            <button
              onClick={() => {
                setOpen(true)
                resetForm()
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
            >
              <UserPlus className="size-4" />
              Add employee
            </button>
          ) : undefined
        }
      />

      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between !py-4">
                <CardTitle>Invite an employee</CardTitle>
                <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
                  <X className="size-4" />
                </button>
              </CardHeader>
              <CardContent>
                {lastInvite && (
                  <div className="mb-4 rounded-lg border border-border bg-soft p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {lastInvite.email} <span className="font-normal text-muted-foreground">· Invited</span>
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">{lastInvite.inviteLink}</p>
                      </div>
                      <button
                        onClick={copyLink}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
                      >
                        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                        {copied ? 'Copied' : 'Copy link'}
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    They'll receive an email with a link to set up their profile and password.
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
                      {hasQA && <option>QA</option>}
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
                      <Mail className="size-4" />
                      {busy ? 'Sending…' : 'Send invitation'}
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
          </div>,
          document.body,
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
                <th className="px-4 py-2.5"><span className="sr-only">Remove</span></th>
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
                      onClick={async () => {
                        if (!isAdmin) {
                          toast({ kind: 'info', title: 'Remove member', description: 'Only admins can remove members.' })
                          return
                        }
                        if (m.protected) {
                          toast({ kind: 'info', title: 'Protected account', description: `${m.name || m.email} is the default admin and can't be deleted.` })
                          return
                        }
                        if (!window.confirm(`Remove ${m.name || m.email} from the workspace?`)) return
                        try {
                          await removeMember(m.id)
                          toast({ kind: 'success', title: 'Member removed', description: `${m.name || m.email} was removed from the workspace.` })
                        } catch (err) {
                          toast({ kind: 'error', title: 'Could not remove member', description: err instanceof Error ? err.message : 'Unknown error' })
                        }
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-error"
                      aria-label={`Remove ${m.name || m.email}`}
                    >
                      <Trash2 className="size-4" />
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