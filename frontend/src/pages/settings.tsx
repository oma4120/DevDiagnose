import { useState } from 'react'
import { Building2, Bell, Lock, User, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/field'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useRole } from '@/components/role-context'
import { useToast } from '@/components/ui/toast'
import { useData } from '@/lib/data-context'

const sections = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'workflow', label: 'Workflow', icon: Workflow },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Lock },
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
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [active, setActive] = useState('profile')
  const { hasQA, setHasQA } = useRole()
  const { toast } = useToast()
  const { company, currentUser } = useData()
  const [emailNotif, setEmailNotif] = useState(true)
  const [aiNotif, setAiNotif] = useState(true)

  const save = () => toast({ kind: 'success', title: 'Settings saved' })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Settings" description="Manage your profile, company, and workflow preferences." />

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto scroll-thin md:flex-col md:overflow-visible">
          {sections.map((s) => {
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
              </CardContent>
            </Card>
          )}

          {active === 'company' && (
            <Card>
              <CardHeader><CardTitle>Company</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label htmlFor="cname">Company name</Label><Input id="cname" defaultValue={company.name} /></div>
                <div><Label htmlFor="ws">Workspace URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">devdiagnose.app/</span>
                    <Input id="ws" defaultValue={company.workspace} className="flex-1" />
                  </div>
                </div>
                <SaveButton onClick={save} />
              </CardContent>
            </Card>
          )}

          {active === 'workflow' && (
            <Card>
              <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
              <CardContent className="divide-y divide-border">
                <Toggle
                  checked={hasQA}
                  onChange={() => setHasQA(!hasQA)}
                  label="Enable QA validation workflow"
                  hint="When off, bugs skip the QA Validation stage and use a developer-driven flow."
                />
                <div className="py-3">
                  <Label htmlFor="defsev">Default severity for new bugs</Label>
                  <Select id="defsev" defaultValue="Medium" className="max-w-xs">
                    <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                  </Select>
                </div>
                <div className="py-3">
                  <Label htmlFor="defstatus">Default status</Label>
                  <Select id="defstatus" defaultValue="Submitted" className="max-w-xs">
                    <option>Draft</option><option>Submitted</option>
                  </Select>
                </div>
                <div className="pt-3"><SaveButton onClick={save} /></div>
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

          {active === 'security' && (
            <Card>
              <CardHeader><CardTitle>Security</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label htmlFor="cur">Current password</Label><Input id="cur" type="password" placeholder="••••••••" /></div>
                  <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="new">New password</Label><Input id="new" type="password" placeholder="••••••••" /></div>
                    <div><Label htmlFor="conf">Confirm password</Label><Input id="conf" type="password" placeholder="••••••••" /></div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-soft p-3 text-sm">
                  <p className="font-medium text-foreground">Active session</p>
                  <p className="mt-0.5 text-xs text-muted-foreground font-mono">Chrome · macOS · staging.shop.northwind.dev · started 2h ago</p>
                </div>
                <SaveButton onClick={save} label="Update password" />
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