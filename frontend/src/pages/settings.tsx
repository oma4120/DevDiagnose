import { useState } from 'react'
import { User } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, FieldHint, Input, Label } from '@/components/ui/field'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useData } from '@/lib/data-context'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/validation'

const sections = [{ id: 'profile', label: 'Profile', icon: User }]

export default function SettingsPage() {
  const [active, setActive] = useState('profile')
  const { toast } = useToast()
  const { currentUser } = useData()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  // Same policy as the invite screen (and backend/app/schemas.py).
  const rules = [
    { label: 'At least 8 characters', ok: next.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(next) },
    { label: 'One number', ok: /\d/.test(next) },
    { label: 'One symbol (!@#$)', ok: /[^A-Za-z0-9]/.test(next) },
    { label: 'Passwords match', ok: confirm.length > 0 && next === confirm },
  ]
  const rulesOk = rules.every((r) => r.ok)
  const currentError = touched && !current ? 'Enter your current password' : null

  const save = async () => {
    setTouched(true)
    if (!current) return
    if (!rulesOk) {
      toast({ kind: 'error', title: 'Password does not meet the rules', description: 'Check every rule below the new password field.' })
      return
    }
    setSaving(true)
    try {
      await api.auth.changePassword({ currentPassword: current, newPassword: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      setTouched(false)
      toast({ kind: 'success', title: 'Password updated', description: 'Use the new password the next time you sign in.' })
    } catch (err) {
      toast({ kind: 'error', title: 'Could not update password', description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Settings" description="Manage your profile and preferences." />

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
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{currentUser.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{currentUser.email}</p>
                    <p className="text-xs text-muted-foreground">{currentUser.role}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-foreground">Change password</h3>
                  <div className="mt-3 space-y-3">
                    <div>
                      <Label htmlFor="cur">Current password</Label>
                      <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={Boolean(currentError)} />
                      <FieldError>{currentError}</FieldError>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="new">New password</Label>
                        <Input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
                        <FieldHint>Use the same policy as invitations.</FieldHint>
                      </div>
                      <div>
                        <Label htmlFor="conf">Confirm password</Label>
                        <Input id="conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {rules.map((r) => (
                        <li key={r.label} className={cn('text-xs', r.ok ? 'text-emerald-600' : 'text-muted-foreground')}>
                          {r.ok ? '✓' : '○'} {r.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex h-9 items-center rounded-lg bg-indigo px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:opacity-60"
                >
                  {saving ? 'Updating…' : 'Update password'}
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
