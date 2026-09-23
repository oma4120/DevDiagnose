import { useState } from 'react'
import { Building2, Bell, Check, Copy, Plus, User } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/field'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useData } from '@/lib/data-context'
import type { InviteResult, Role } from '@/lib/types'

const sections = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-indigo' : 'bg-muted-foreground/30')}
      >
        <span className={cn('absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [active, setActive] = useState('profile')
  const { toast } = useToast()
  const { company, currentUser, inviteMemberByEmail } = useData()
  const [emailNotif, setEmailNotif] = useState(true)
  const [aiNotif, setAiNotif] = useState(true)

  const isAdmin = currentUser.role === 'Admin'
  const [hasQA, setHasQA] = useState(true)

  const [empEmail, setEmpEmail] = useState('')
  const [empRole, setEmpRole] = useState<Role>('Developer')
  const [empBusy, setEmpBusy] = useState(false)
  const [empError, setEmpError] = useState<string | null>(null)
  const [lastInvite, setLastInvite] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  const save = () => toast({ kind: 'success', title: 'Settings saved' })

  const sendInvite = async () => {
    if (!empEmail.trim()) return
    setEmpError(null)
    setEmpBusy(true)
    try {
      const result = await inviteMemberByEmail(empEmail.trim(), empRole)
      setLastInvite(result)
      setEmpEmail('')
      toast({
        kind: 'success',
        title: 'Invitation sent',
        description: result.emailSent
          ? `${result.email} was emailed a setup link.`
          : 'Invitation created. Add SMTP settings to actually email the link.',
      })
    } catch (err) {
      setEmpError(err instanceof Error ? err.message : 'Could not send the invitation')
    } finally {
      setEmpBusy(false)
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
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Settings" description="Manage your profile and preferences." />

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto scroll-thin md:flex-col md:overflow-visible">
          {sections.filter((s) => isAdmin || s.id !== 'company').map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active === s.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {s.label}
              </button>
            )
          })}
        </nav>

        <div className="space-y-6">
          {active === 'profile' && (
            <Card>
              <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar name={currentUser.name} color={currentUser.avatarColor} size="lg" />
                  <button className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">Change avatar</button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label htmlFor="name">Full name</Label><Input id="name" defaultValue={currentUser.name} /></div>
                  <div><Label htmlFor="email">Email</Label><Input id="email" type="email" defaultValue={currentUser.email} /></div>
                </div>
                <SaveButton onClick={save} />
                <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <div><Label htmlFor="cur">Current password</Label><Input id="cur" type="password" placeholder="••••••••" /></div>
                  <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="new">New password</Label><Input id="new" type="password" placeholder="••••••••" /></div>
                    <div><Label htmlFor="conf">Confirm password</Label><Input id="conf" type="password" placeholder="••••••••" /></div>
                  </div>
                </div>
                <SaveButton onClick={save} label="Update password" />
              </CardContent>
            </Card>
          )}

          {active === 'company' && (
            <Card>
              <CardHeader><CardTitle>Company</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold">Company details</h3>
                  <p className="text-sm text-muted-foreground">Tell us about your organization.</p>
                </div>
                <div><Label htmlFor="cname">Company name</Label><Input id="cname" defaultValue={company.name} /></div>
                <div><Label htmlFor="ws">Workspace URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">devdiagnose.app/</span>
                    <Input id="ws" defaultValue={company.workspace} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="logo">Company logo (optional)</Label>
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 items-center justify-center rounded-lg bg-cyan text-lg font-bold text-white">
                      N
                    </span>
                    <button className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                      Upload logo
                    </button>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h3 className="text-base font-semibold">Team</h3>
                  <p className="text-sm text-muted-foreground">
                    Add teammates and assign their roles. You can change these later.
                  </p>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-soft p-3">
                  <div>
                    <p className="text-sm font-medium">Does this company have QA members?</p>
                    <p className="text-xs text-muted-foreground">
                      If disabled, DevDiagnose uses a developer-driven workflow with no QA validation
                      stage.
                    </p>
                  </div>
                  <Toggle checked={hasQA} onChange={() => setHasQA((v) => !v)} label="QA members" />
                </div>

                <div>
                  <Label htmlFor="empEmail">Add employee by email</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    An email with a setup link will be sent to this address. The employee picks their
                    name and password, then signs in.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      id="empEmail"
                      type="email"
                      value={empEmail}
                      onChange={(e) => setEmpEmail(e.target.value)}
                      placeholder="teammate@company.com"
                      className="flex-1"
                    />
                    <Select value={empRole} onChange={(e) => setEmpRole(e.target.value as Role)} className="w-32">
                      <option>Developer</option>
                      <option>QA</option>
                    </Select>
                    <button
                      onClick={sendInvite}
                      disabled={empBusy || !empEmail.trim()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:opacity-60"
                    >
                      <Plus className="size-4" />
                      {empBusy ? 'Sending…' : 'Invite'}
                    </button>
                  </div>
                  {empError && <p className="mt-2 text-sm text-error">{empError}</p>}
                </div>

                {lastInvite && (
                  <div className="rounded-lg border border-border bg-soft p-3">
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

                <div className="border-t border-border pt-4"><SaveButton onClick={save} /></div>
              </CardContent>
            </Card>
          )}

          {active === 'notifications' && (
            <Card>
              <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
              <CardContent className="divide-y divide-border">
                <Toggle checked={emailNotif} onChange={() => setEmailNotif(!emailNotif)} label="Email notifications" hint="Assignments and validation requests." />
                <Toggle checked={aiNotif} onChange={() => setAiNotif(!aiNotif)} label="AI analysis alerts" hint="Notify me when analysis completes." />
                <div className="pt-3"><SaveButton onClick={save} /></div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function SaveButton({ onClick, label = 'Save changes' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-lg bg-indigo px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
    >
      {label}
    </button>
  )
}