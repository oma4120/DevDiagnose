import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Folder } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { useToast } from '@/components/ui/toast'
import { useData, useProject } from '@/lib/data-context'
import { checkProjectName, checkUrl, errorMessage } from '@/lib/validation'
import type { Member } from '@/lib/types'
import type { Rule } from './project-new/types'
import { StepRail } from './project-new/step-rail'
import { BasicInfoSection } from './project-new/basic-info'
import { StackSection } from './project-new/stack-section'
import { TeamSection } from './project-new/team-section'
import { EnvSection } from './project-new/env-section'
import { ArchSection } from './project-new/arch-section'
import { RulesSection } from './project-new/rules-section'
import { QualitySection } from './project-new/quality-section'
import { ReviewSection } from './project-new/review-section'
import { WizardFooter } from './project-new/wizard-footer'

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
        // `env` also holds browsers/platforms/os, which have their own top-level
        // fields - sending the whole object would store them twice.
        environments: {
          development: env.development,
          staging: env.staging,
          production: env.production,
        },
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
  const openAdd = () => {
    setAddQuery('')
    setAddOpen(true)
  }
  const removeMember = (id: string) => setTeamIds((p) => p.filter((memberId) => memberId !== id))

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
        <StepRail step={step} onSelect={setStep} />

        {/* Content */}
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-xs font-medium text-muted-foreground">
                Step {step} of 8
              </span>
            </div>

            {step === 1 && <BasicInfoSection basic={basic} setBasic={setBasic} nameError={nameError} />}
            {step === 2 && <StackSection tech={tech} setTech={setTech} />}
            {step === 3 && (
              <TeamSection
                teamMembers={teamMembers}
                isAdmin={isAdmin}
                addOpen={addOpen}
                addQuery={addQuery}
                availableEmployees={availableEmployees}
                filteredEmployees={filteredEmployees}
                onAddOpenChange={setAddOpen}
                onAddQueryChange={setAddQuery}
                onAddSelected={addSelected}
                onRemoveMember={removeMember}
                onOpenAdd={openAdd}
              />
            )}
            {step === 4 && <EnvSection env={env} setEnv={setEnv} />}
            {step === 5 && <ArchSection arch={arch} setArch={setArch} />}
            {step === 6 && (
              <RulesSection rules={rules} setRules={setRules} ruleError={ruleError} onUpdateRule={updateRule} />
            )}
            {step === 7 && (
              <QualitySection quality={quality} setQuality={setQuality} repoError={repoError} docsError={docsError} />
            )}
            {step === 8 && (
              <ReviewSection isEdit={isEdit} basic={basic} tech={tech} arch={arch} rules={rules} teamMembers={teamMembers} />
            )}

            <WizardFooter step={step} isEdit={isEdit} submitting={submitting} onBack={back} onNext={next} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
