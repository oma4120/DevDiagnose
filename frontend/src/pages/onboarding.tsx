import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Plus,
  Trash2,
  Users,
  FolderPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input, Label, Select, Textarea } from '@/components/ui/field'
import type { Role } from '@/lib/types'

const steps = [
  { id: 1, label: 'Company', icon: Building2 },
  { id: 2, label: 'Team', icon: Users },
  { id: 3, label: 'First Project', icon: FolderPlus },
]

interface Invite {
  email: string
  role: Role
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [hasQA, setHasQA] = useState(true)
  const [invites, setInvites] = useState<Invite[]>([
    { email: 'sara@northwind.dev', role: 'QA' },
    { email: 'marcus@northwind.dev', role: 'Developer' },
  ])

  const addInvite = () => setInvites((p) => [...p, { email: '', role: 'Developer' }])
  const removeInvite = (i: number) => setInvites((p) => p.filter((_, idx) => idx !== i))
  const updateInvite = (i: number, patch: Partial<Invite>) =>
    setInvites((p) => p.map((inv, idx) => (idx === i ? { ...inv, ...patch } : inv)))

  const next = () => (step < 3 ? setStep(step + 1) : navigate('/dashboard'))
  const back = () => step > 1 && setStep(step - 1)

  const roleOptions: Role[] = hasQA ? ['Admin', 'QA', 'Developer'] : ['Admin', 'Developer']

  return (
    <div className="relative min-h-dvh bg-background">
      <div className="tech-grid absolute inset-x-0 top-0 h-48 opacity-40" aria-hidden />

      <header className="relative flex h-14 items-center gap-2 px-6">
        <span className="flex size-7 items-center justify-center rounded-md bg-indigo text-white">
          <Activity className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">DevDiagnose</span>
      </header>

      <div className="relative mx-auto max-w-2xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Set up your workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A few quick steps to get your team tracking bugs.
          </p>
        </div>

        {/* Stepper */}
        <ol className="mb-8 flex items-center">
          {steps.map((s, i) => {
            const done = step > s.id
            const active = step === s.id
            const Icon = s.icon
            return (
              <li key={s.id} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full border text-sm font-medium transition-colors',
                      done && 'border-emerald-500 bg-emerald-500 text-white',
                      active && 'border-indigo bg-indigo text-white',
                      !done && !active && 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <span className={cn('mx-3 h-px flex-1', step > s.id ? 'bg-emerald-400' : 'bg-border')} aria-hidden />
                )}
              </li>
            )
          })}
        </ol>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Company details</h2>
                <p className="text-sm text-muted-foreground">Tell us about your organization.</p>
              </div>
              <div>
                <Label htmlFor="company">Company name</Label>
                <Input id="company" defaultValue="Northwind Labs" placeholder="Acme Inc." />
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Invite your team</h2>
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
                <button
                  role="switch"
                  aria-checked={hasQA}
                  onClick={() => setHasQA((v) => !v)}
                  className={cn(
                    'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
                    hasQA ? 'bg-indigo' : 'bg-muted-foreground/30',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform',
                      hasQA ? 'translate-x-5' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>

              <div className="space-y-2">
                {invites.map((inv, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={inv.email}
                      onChange={(e) => updateInvite(i, { email: e.target.value })}
                      placeholder="teammate@company.com"
                      className="flex-1"
                    />
                    <Select
                      value={inv.role}
                      onChange={(e) => updateInvite(i, { role: e.target.value as Role })}
                      className="w-36"
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                    <button
                      onClick={() => removeInvite(i)}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-error"
                      aria-label="Remove invite"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addInvite}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:border-indigo hover:text-indigo"
              >
                <Plus className="size-4" />
                Add member
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Create your first project</h2>
                <p className="text-sm text-muted-foreground">
                  Projects hold the context the AI uses to analyze bugs. You can add full details
                  later.
                </p>
              </div>
              <div>
                <Label htmlFor="pname">Project name</Label>
                <Input id="pname" placeholder="E-Commerce Platform" defaultValue="E-Commerce Platform" />
              </div>
              <div>
                <Label htmlFor="pdesc">Brief description</Label>
                <Textarea
                  id="pdesc"
                  placeholder="What does this project do?"
                  defaultValue="Online marketplace for customers to browse, purchase, and track orders."
                />
              </div>
              <div>
                <Label htmlFor="ptype">Project type</Label>
                <Select id="ptype" defaultValue="Web Application">
                  <option>Web Application</option>
                  <option>Mobile Application</option>
                  <option>API / Backend</option>
                  <option>Desktop Application</option>
                  <option>Other</option>
                </Select>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-indigo/20 bg-accent/50 p-3 text-xs text-accent-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0" />
                You&apos;ll configure the full project context (tech stack, architecture, business
                rules) on the next screen so the AI can analyze bugs accurately.
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <button
              onClick={back}
              disabled={step === 1}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
            >
              {step === 3 ? 'Finish setup' : 'Continue'}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}