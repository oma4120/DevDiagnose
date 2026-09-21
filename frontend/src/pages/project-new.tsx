import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  FileText,
  Info,
  Layers,
  Plus,
  ScrollText,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label, Select, Textarea, FieldHint } from '@/components/ui/field'
import { TagInput } from '@/components/ui/tag-input'
import { Chip } from '@/components/badges'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useData } from '@/lib/data-context'
import type { Role } from '@/lib/types'

const steps = [
  { id: 1, label: 'Basic Information', icon: FileText },
  { id: 2, label: 'Technology', icon: Boxes },
  { id: 3, label: 'Team', icon: Users },
  { id: 4, label: 'Environment', icon: Server },
  { id: 5, label: 'Architecture', icon: Layers },
  { id: 6, label: 'Business Rules', icon: ScrollText },
  { id: 7, label: 'Quality & References', icon: ShieldCheck },
  { id: 8, label: 'Review', icon: Check },
]

interface TeamRow {
  name: string
  role: Role | 'Other'
}
interface Rule {
  title: string
  description: string
}

export default function NewProjectPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { currentUser, createProject } = useData()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [basic, setBasic] = useState({
    name: 'Billing Service',
    description: 'Subscription billing and invoicing microservice.',
    purpose: 'Handle recurring charges, proration, and invoice generation reliably.',
    type: 'API / Backend',
  })
  const [tech, setTech] = useState({
    frontend: ['React', 'TypeScript'] as string[],
    backend: ['FastAPI', 'Python'] as string[],
    database: ['MongoDB'] as string[],
    services: ['Stripe'] as string[],
    auth: ['JWT'] as string[],
    deployment: ['Vercel'] as string[],
    other: [] as string[],
  })
  const [team, setTeam] = useState<TeamRow[]>([
    { name: 'Omar Haddad', role: 'Developer' },
    { name: 'Sara Nasser', role: 'QA' },
  ])
  const [env, setEnv] = useState({
    development: 'localhost + Docker',
    staging: 'staging.billing.northwind.dev',
    production: 'billing.northwind.dev',
    browsers: [] as string[],
    platforms: ['Server'] as string[],
    os: ['Linux'] as string[],
  })
  const [arch, setArch] = useState({
    style: 'Event-driven microservice',
    modules: ['Charges', 'Invoices', 'Webhooks'] as string[],
    apiPatterns: 'REST with idempotency keys, versioned under /v1.',
  })
  const [rules, setRules] = useState<Rule[]>([
    { title: 'Empty carts cannot be checked out', description: 'Checkout must reject empty carts with a 422.' },
  ])
  const [quality, setQuality] = useState({
    testingTools: ['Postman', 'Pytest'] as string[],
    frameworks: ['Vitest'] as string[],
    conventions: 'PEP 8, conventional commits.',
    constraints: 'p95 under 800ms.',
    repoUrl: '',
    docsUrl: '',
  })

  const next = async () => {
    if (step < 8) {
      setStep(step + 1)
      return
    }
    setSubmitting(true)
    try {
      const project = await createProject({
        name: basic.name,
        description: basic.description,
        purpose: basic.purpose,
        type: basic.type,
        frontend: tech.frontend,
        backend: tech.backend,
        database: tech.database,
        services: tech.services,
        auth: tech.auth,
        deployment: tech.deployment,
        architecture: arch.style,
        modules: arch.modules,
        apiPatterns: arch.apiPatterns,
        environments: env,
        browsers: env.browsers,
        platforms: env.platforms,
        businessRules: rules.map((r, i) => ({ id: `br-${Date.now()}-${i}`, title: r.title, description: r.description })),
        testingTools: [...quality.testingTools, ...quality.frameworks],
        conventions: quality.conventions,
        constraints: quality.constraints,
        repoUrl: quality.repoUrl || undefined,
        docsUrl: quality.docsUrl || undefined,
        memberIds: [currentUser.id],
      })
      toast({ kind: 'success', title: 'Project created', description: `${basic.name} is ready. Add bugs to begin.` })
      navigate(`/projects/${project.id}`)
    } catch {
      toast({ kind: 'error', title: 'Could not create project', description: 'Please try again.' })
      setSubmitting(false)
    }
  }
  const back = () => (step > 1 ? setStep(step - 1) : navigate('/projects'))

  const updateTeam = (i: number, patch: Partial<TeamRow>) =>
    setTeam((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const updateRule = (i: number, patch: Partial<Rule>) =>
    setRules((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Create Project"
        description="Configure the AI's knowledge base for this project — not just a folder."
      />

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Step rail */}
        <ol className="hidden space-y-1 md:block">
          {steps.map((s) => {
            const done = step > s.id
            const active = step === s.id
            return (
              <li key={s.id}>
                <button
                  onClick={() => setStep(s.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs',
                      done && 'border-emerald-500 bg-emerald-500 text-white',
                      active && 'border-indigo bg-indigo text-white',
                      !done && !active && 'border-border text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : s.id}
                  </span>
                  {s.label}
                </button>
              </li>
            )
          })}
        </ol>

        {/* Content */}
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-xs font-medium text-muted-foreground">
                Step {step} of 8
              </span>
            </div>

            {step === 1 && (
              <StepShell title="Basic Information" desc="Identify the project and its purpose.">
                <div><Label>Project name</Label><Input value={basic.name} onChange={(e) => setBasic({ ...basic, name: e.target.value })} /></div>
                <div><Label>Brief description</Label><Textarea value={basic.description} onChange={(e) => setBasic({ ...basic, description: e.target.value })} /></div>
                <div><Label>Project purpose</Label><Textarea value={basic.purpose} onChange={(e) => setBasic({ ...basic, purpose: e.target.value })} /><FieldHint>What problem does this project solve? The AI uses this for context.</FieldHint></div>
                <div><Label>Project type</Label>
                  <Select value={basic.type} onChange={(e) => setBasic({ ...basic, type: e.target.value })}>
                    <option>Web Application</option><option>Mobile Application</option><option>API / Backend</option><option>Desktop Application</option><option>Other</option>
                  </Select>
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell title="Technology" desc="Structured tech stack the AI reasons about.">
                {([
                  ['Frontend technologies', 'frontend'],
                  ['Backend technologies', 'backend'],
                  ['Database', 'database'],
                  ['APIs / Services', 'services'],
                  ['Authentication', 'auth'],
                  ['Deployment', 'deployment'],
                  ['Other technologies', 'other'],
                ] as const).map(([label, key]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <TagInput value={tech[key]} onChange={(v) => setTech({ ...tech, [key]: v })} placeholder="Add a technology…" />
                  </div>
                ))}
              </StepShell>
            )}

            {step === 3 && (
              <StepShell title="Team" desc={`${team.length} members on this project.`}>
                <div className="space-y-2">
                  {team.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={row.name} onChange={(e) => updateTeam(i, { name: e.target.value })} placeholder="Member name" className="flex-1" />
                      <Select value={row.role} onChange={(e) => updateTeam(i, { role: e.target.value as Role })} className="w-36">
                        <option>Developer</option><option>QA</option><option>Other</option>
                      </Select>
                      <button onClick={() => setTeam((p) => p.filter((_, idx) => idx !== i))} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-error" aria-label="Remove member"><Trash2 className="size-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTeam((p) => [...p, { name: '', role: 'Developer' }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:border-indigo hover:text-indigo"><Plus className="size-4" />Add member</button>
              </StepShell>
            )}

            {step === 4 && (
              <StepShell title="Environment" desc="Where the project runs and is tested.">
                <div><Label>Development environment</Label><Input value={env.development} onChange={(e) => setEnv({ ...env, development: e.target.value })} /></div>
                <div><Label>Staging environment</Label><Input value={env.staging} onChange={(e) => setEnv({ ...env, staging: e.target.value })} /></div>
                <div><Label>Production environment</Label><Input value={env.production} onChange={(e) => setEnv({ ...env, production: e.target.value })} /></div>
                <div><Label>Browsers</Label><TagInput value={env.browsers} onChange={(v) => setEnv({ ...env, browsers: v })} placeholder="Chrome, Firefox…" /></div>
                <div><Label>Platforms</Label><TagInput value={env.platforms} onChange={(v) => setEnv({ ...env, platforms: v })} placeholder="Web, iOS…" /></div>
                <div><Label>Operating systems</Label><TagInput value={env.os} onChange={(v) => setEnv({ ...env, os: v })} placeholder="Linux, macOS…" /></div>
              </StepShell>
            )}

            {step === 5 && (
              <StepShell title="Architecture" desc="High-level structure the AI considers.">
                <div><Label>Main architecture style</Label><Input value={arch.style} onChange={(e) => setArch({ ...arch, style: e.target.value })} /></div>
                <div><Label>Important modules / features</Label><TagInput value={arch.modules} onChange={(v) => setArch({ ...arch, modules: v })} placeholder="Add a module…" /></div>
                <div><Label>API patterns</Label><Textarea value={arch.apiPatterns} onChange={(e) => setArch({ ...arch, apiPatterns: e.target.value })} /></div>
              </StepShell>
            )}

            {step === 6 && (
              <StepShell title="Business Rules" desc="Domain rules the AI applies when diagnosing bugs.">
                <div className="flex items-start gap-2 rounded-lg border border-indigo/20 bg-accent/50 p-3 text-xs text-accent-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Project context will be used by the AI when analyzing bugs. Clear business rules improve diagnosis accuracy.
                </div>
                <div className="space-y-3">
                  {rules.map((r, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Input value={r.title} onChange={(e) => updateRule(i, { title: e.target.value })} placeholder="Rule title" className="flex-1 font-medium" />
                        <button onClick={() => setRules((p) => p.filter((_, idx) => idx !== i))} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-error" aria-label="Remove rule"><Trash2 className="size-4" /></button>
                      </div>
                      <Textarea value={r.description} onChange={(e) => updateRule(i, { description: e.target.value })} placeholder="Describe the rule…" className="mt-2 min-h-16" />
                    </div>
                  ))}
                </div>
                <button onClick={() => setRules((p) => [...p, { title: '', description: '' }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:border-indigo hover:text-indigo"><Plus className="size-4" />Add rule</button>
              </StepShell>
            )}

            {step === 7 && (
              <StepShell title="Quality & References" desc="Testing setup and helpful links.">
                <div><Label>Testing tools</Label><TagInput value={quality.testingTools} onChange={(v) => setQuality({ ...quality, testingTools: v })} placeholder="Postman, Pytest…" /></div>
                <div><Label>Testing frameworks</Label><TagInput value={quality.frameworks} onChange={(v) => setQuality({ ...quality, frameworks: v })} placeholder="Vitest, Playwright…" /></div>
                <div><Label>Coding conventions</Label><Textarea value={quality.conventions} onChange={(e) => setQuality({ ...quality, conventions: e.target.value })} /></div>
                <div><Label>Development constraints</Label><Textarea value={quality.constraints} onChange={(e) => setQuality({ ...quality, constraints: e.target.value })} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Repository URL (optional)</Label><Input value={quality.repoUrl} onChange={(e) => setQuality({ ...quality, repoUrl: e.target.value })} placeholder="https://github.com/…" /></div>
                  <div><Label>Documentation URL (optional)</Label><Input value={quality.docsUrl} onChange={(e) => setQuality({ ...quality, docsUrl: e.target.value })} placeholder="https://docs…" /></div>
                </div>
              </StepShell>
            )}

            {step === 8 && (
              <StepShell title="Review" desc="Confirm the project context before creating.">
                <div className="space-y-3">
                  <ReviewRow label="Name" value={basic.name} />
                  <ReviewRow label="Type" value={basic.type} />
                  <ReviewRow label="Description" value={basic.description} />
                  <ReviewRow label="Purpose" value={basic.purpose} />
                  <ReviewChips label="Frontend" items={tech.frontend} />
                  <ReviewChips label="Backend" items={tech.backend} />
                  <ReviewChips label="Database" items={tech.database} />
                  <ReviewChips label="Auth" items={tech.auth} />
                  <ReviewRow label="Team" value={team.map((t) => `${t.name} (${t.role})`).join(', ')} />
                  <ReviewRow label="Architecture" value={arch.style} />
                  <ReviewChips label="Modules" items={arch.modules} />
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business rules</p>
                    <ul className="mt-1.5 space-y-1">
                      {rules.map((r, i) => (
                        <li key={i} className="text-sm text-foreground">
                          <span className="font-medium">{r.title || 'Untitled rule'}</span>
                          {r.description && <span className="text-muted-foreground"> — {r.description}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-indigo/20 bg-accent/50 p-3 text-xs text-accent-foreground">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                    This full context becomes the AI&apos;s knowledge base for every bug in this project.
                  </div>
                </div>
              </StepShell>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <button onClick={back} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"><ArrowLeft className="size-4" />Back</button>
              <button onClick={next} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:opacity-50">
                {step === 8 ? 'Create Project' : 'Continue'}
                {step !== 8 && <ArrowRight className="size-4" />}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StepShell({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-border pb-2 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || '—'}</span>
    </div>
  )
}

function ReviewChips({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-border pb-2 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="flex flex-wrap gap-1">{items.length ? items.map((t) => <Chip key={t}>{t}</Chip>) : '—'}</span>
    </div>
  )
}