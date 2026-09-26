import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  FileText,
  Folder,
  Info,
  Layers,
  Plus,
  ScrollText,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select, Textarea, FieldHint, FieldError } from '@/components/ui/field'
import { Avatar } from '@/components/ui/avatar'
import { TagInput } from '@/components/ui/tag-input'
import { Chip } from '@/components/badges'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useData, useProject } from '@/lib/data-context'
import { checkProjectName, checkUrl, errorMessage } from '@/lib/validation'
import type { Member, Role } from '@/lib/types'

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

const roleBadge: Record<Role, string> = {
  Admin: 'border-amber-200 bg-amber-50 text-amber-700',
  QA: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  Developer: 'border-indigo bg-indigo-50 text-indigo',
}

interface Rule {
  id?: string
  title: string
  description: string
}

export default function NewProjectPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const isEdit = Boolean(editId)
  const editing = useProject(editId ?? undefined)
  const { toast } = useToast()
  const { currentUser, members, createProject, updateProject } = useData()
  const isAdmin = currentUser.role === 'Admin'
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [basic, setBasic] = useState(() => (
    isEdit && editing
      ? { name: editing.name, description: editing.description, purpose: editing.purpose, type: editing.type }
      : {
        name: 'Billing Service',
        description: 'Subscription billing and invoicing microservice.',
        purpose: 'Handle recurring charges, proration, and invoice generation reliably.',
        type: 'API / Backend',
      }
  ))
  const [tech, setTech] = useState(() => (
    isEdit && editing
      ? {
        frontend: editing.frontend,
        backend: editing.backend,
        database: editing.database,
        services: editing.services,
        auth: editing.auth,
        deployment: editing.deployment,
      }
      : {
        frontend: ['React', 'TypeScript'] as string[],
        backend: ['FastAPI', 'Python'] as string[],
        database: ['MongoDB'] as string[],
        services: ['Stripe'] as string[],
        auth: ['JWT'] as string[],
        deployment: ['Vercel'] as string[],
      }
  ))
  const [teamIds, setTeamIds] = useState<string[]>(() => (
    isEdit && editing ? [...editing.memberIds] : ['u1', 'u2']
  ))
  const [addOpen, setAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [env, setEnv] = useState(() => (
    isEdit && editing
      ? {
        development: editing.environments?.development ?? '',
        staging: editing.environments?.staging ?? '',
        production: editing.environments?.production ?? '',
        browsers: editing.browsers,
        platforms: editing.platforms,
        os: (editing.environments as { os?: string[] } | undefined)?.os ?? [],
      }
      : {
        development: 'localhost + Docker',
        staging: 'staging.billing.northwind.dev',
        production: 'billing.northwind.dev',
        browsers: [] as string[],
        platforms: ['Server'] as string[],
        os: ['Linux'] as string[],
      }
  ))
  const [arch, setArch] = useState(() => (
    isEdit && editing
      ? { style: editing.architecture, modules: editing.modules, apiPatterns: editing.apiPatterns }
      : {
        style: 'Event-driven microservice',
        modules: ['Charges', 'Invoices', 'Webhooks'] as string[],
        apiPatterns: 'REST with idempotency keys, versioned under /v1.',
      }
  ))
  const [rules, setRules] = useState<Rule[]>(() => (
    isEdit && editing
      ? editing.businessRules.map((r) => ({ id: r.id, title: r.title, description: r.description }))
      : [{ title: 'Empty carts cannot be checked out', description: 'Checkout must reject empty carts with a 422.' }]
  ))
  const [quality, setQuality] = useState(() => (
    isEdit && editing
      ? {
        testingTools: editing.testingTools,
        frameworks: [] as string[],
        conventions: editing.conventions,
        constraints: editing.constraints,
        repoUrl: editing.repoUrl ?? '',
        docsUrl: editing.docsUrl ?? '',
      }
      : {
        testingTools: ['Postman', 'Pytest'] as string[],
        frameworks: ['Vitest'] as string[],
        conventions: 'PEP 8, conventional commits.',
        constraints: 'p95 under 800ms.',
        repoUrl: '',
        docsUrl: '',
      }
  ))

  if (isEdit && !editing) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <EmptyState
          icon={Folder}
          title="Project not found"
          description="This project may have been deleted or the link is incorrect."
          action={
            <button
              onClick={() => navigate('/projects')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
              Back to projects
            </button>
          }
        />
      </div>
    )
  }

  const nameError = checkProjectName(basic.name)
  const ruleError = rules.some((r) => !r.title.trim())
    ? 'Each business rule needs a title'
    : null
  const repoError = checkUrl(quality.repoUrl, 'Repository URL')
  const docsError = checkUrl(quality.docsUrl, 'Docs URL')

  const next = async () => {
    if (step === 1 && nameError) {
      toast({ kind: 'error', title: 'Check the project name', description: nameError })
      return
    }
    if (step === 6 && ruleError) {
      toast({ kind: 'error', title: 'Check the business rules', description: ruleError })
      return
    }
    if (step === 7 && (repoError || docsError)) {
      toast({ kind: 'error', title: 'Check the links', description: repoError ?? docsError ?? undefined })
      return
    }
    if (step < 8) {
      setStep(step + 1)
      return
    }
    // The step rail lets people jump around, so re-check everything on submit.
    if (nameError) {
      setStep(1)
      toast({ kind: 'error', title: 'Check the project name', description: nameError })
      return
    }
    if (ruleError) {
      setStep(6)
      toast({ kind: 'error', title: 'Check the business rules', description: ruleError })
      return
    }
    if (repoError || docsError) {
      setStep(7)
      toast({ kind: 'error', title: 'Check the links', description: repoError ?? docsError ?? undefined })
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: basic.name.trim(),
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
        businessRules: rules.map((r, i) => ({ id: r.id ?? `br-${Date.now()}-${i}`, title: r.title, description: r.description })),
        testingTools: [...quality.testingTools, ...quality.frameworks],
        conventions: quality.conventions,
        constraints: quality.constraints,
        repoUrl: quality.repoUrl,
        docsUrl: quality.docsUrl,
        memberIds: [...new Set([currentUser.id, ...teamIds])],
      }
      if (isEdit && editId) {
        const project = await updateProject(editId, payload)
        toast({ kind: 'success', title: 'Project updated', description: `${payload.name} configuration saved.` })
        navigate(`/projects/${project.id}`)
      } else {
        const project = await createProject(payload)
        toast({ kind: 'success', title: 'Project created', description: `${basic.name} is ready. Add bugs to begin.` })
        navigate(`/projects/${project.id}`)
      }
    } catch (err) {
      toast({
        kind: 'error',
        title: isEdit ? 'Could not save changes' : 'Could not create project',
        description: errorMessage(err),
      })
      setSubmitting(false)
    }
  }
  const back = () => (step > 1 ? setStep(step - 1) : navigate(editId ? `/projects/${editId}` : '/projects'))

  const teamMembers = teamIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => Boolean(m))
  const availableEmployees = members.filter((m) => !teamIds.includes(m.id) && m.status !== 'Invited')
  const addQueryTrimmed = addQuery.trim().toLowerCase()
  const filteredEmployees = addQueryTrimmed
    ? availableEmployees.filter(
      (m) =>
        m.name.toLowerCase().includes(addQueryTrimmed) ||
        m.email.toLowerCase().includes(addQueryTrimmed),
    )
    : availableEmployees
  const addSelected = (m: Member) => {
    setTeamIds((p) => [...p, m.id])
    setAddOpen(false)
    setAddQuery('')
  }

  const updateRule = (i: number, patch: Partial<Rule>) =>
    setRules((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={isEdit ? `Edit ${editing?.name ?? 'Project'}` : 'Create Project'}
        description={
          isEdit
            ? 'Update the configuration the AI uses as this project\'s knowledge base.'
            : "Configure the AI's knowledge base for this project - not just a folder."
        }
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
                <div><Label htmlFor="project-name">Project name</Label><Input id="project-name" value={basic.name} onChange={(e) => setBasic({ ...basic, name: e.target.value })} aria-invalid={Boolean(nameError)} /><FieldHint>At least 2 characters - shown everywhere in the app.</FieldHint><FieldError>{nameError}</FieldError></div>
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
                ] as const).map(([label, key]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <TagInput value={tech[key]} onChange={(v) => setTech({ ...tech, [key]: v })} placeholder="Add a technology…" />
                  </div>
                ))}
              </StepShell>
            )}

            {step === 3 && (
              <>
                {addOpen &&
                  createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddOpen(false)}>
                      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between !py-4">
                            <CardTitle>Add team member</CardTitle>
                            <button onClick={() => setAddOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
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
                              onChange={(e) => setAddQuery(e.target.value)}
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
                                    onClick={() => addSelected(m)}
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
                          onClick={() => setTeamIds((p) => p.filter((id) => id !== m.id))}
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
                      onClick={() => {
                        setAddQuery('')
                        setAddOpen(true)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:border-indigo hover:text-indigo"
                    >
                      <UserPlus className="size-4" />Add member
                    </button>
                  )}
                  <FieldHint>Employees are selected from members registered in this workspace.</FieldHint>
                </StepShell>
              </>
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
                        <Input value={r.title} onChange={(e) => updateRule(i, { title: e.target.value })} placeholder="Rule title" className="flex-1 font-medium" aria-invalid={Boolean(r.title.length === 0 && ruleError)} />
                        <button onClick={() => setRules((p) => p.filter((_, idx) => idx !== i))} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-error" aria-label="Remove rule"><Trash2 className="size-4" /></button>
                      </div>
                      {!r.title.trim() && <FieldError>{ruleError}</FieldError>}
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
                  <div>
                    <Label htmlFor="repo-url">Repository URL (optional)</Label>
                    <Input id="repo-url" value={quality.repoUrl} onChange={(e) => setQuality({ ...quality, repoUrl: e.target.value })} placeholder="https://github.com/…" aria-invalid={Boolean(repoError)} />
                    <FieldHint>Leave empty if there is no repository.</FieldHint>
                    <FieldError>{repoError}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="docs-url">Documentation URL (optional)</Label>
                    <Input id="docs-url" value={quality.docsUrl} onChange={(e) => setQuality({ ...quality, docsUrl: e.target.value })} placeholder="https://docs…" aria-invalid={Boolean(docsError)} />
                    <FieldHint>Leave empty if there is no documentation yet.</FieldHint>
                    <FieldError>{docsError}</FieldError>
                  </div>
                </div>
              </StepShell>
            )}

            {step === 8 && (
              <StepShell title="Review" desc={isEdit ? 'Confirm the project context before saving.' : 'Confirm the project context before creating.'}>
                <div className="space-y-3">
                  <ReviewRow label="Name" value={basic.name} />
                  <ReviewRow label="Type" value={basic.type} />
                  <ReviewRow label="Description" value={basic.description} />
                  <ReviewRow label="Purpose" value={basic.purpose} />
                  <ReviewChips label="Frontend" items={tech.frontend} />
                  <ReviewChips label="Backend" items={tech.backend} />
                  <ReviewChips label="Database" items={tech.database} />
                  <ReviewChips label="Auth" items={tech.auth} />
                  <ReviewRow label="Team" value={teamMembers.map((m) => `${m.name} (${m.role})`).join(', ')} />
                  <ReviewRow label="Architecture" value={arch.style} />
                  <ReviewChips label="Modules" items={arch.modules} />
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business rules</p>
                    <ul className="mt-1.5 space-y-1">
                      {rules.map((r, i) => (
                        <li key={i} className="text-sm text-foreground">
                          <span className="font-medium">{r.title || 'Untitled rule'}</span>
                          {r.description && <span className="text-muted-foreground"> - {r.description}</span>}
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
                {step === 8 ? (isEdit ? 'Save Changes' : 'Create Project') : 'Continue'}
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
      <span className="text-foreground">{value || '-'}</span>
    </div>
  )
}

function ReviewChips({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-border pb-2 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="flex flex-wrap gap-1">{items.length ? items.map((t) => <Chip key={t}>{t}</Chip>) : '-'}</span>
    </div>
  )
}
