import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { useToast } from '@/components/ui/toast'
import { useData, useVisibleProjects } from '@/lib/data-context'
import { checkLength, errorMessage, RULES } from '@/lib/validation'
import type { Category, EvidenceType, Priority, Severity } from '@/lib/types'
import { DetailsCard } from './bug-new/details-card'
import { ReproductionCard } from './bug-new/reproduction-card'
import { EvidenceCard, type EvidenceDraft } from './bug-new/evidence-card'
import { SubmitSidebar } from './bug-new/submit-sidebar'

export default function NewBugPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { currentUser, createBug, analyzeBug } = useData()
  const visibleProjects = useVisibleProjects(currentUser.role)

  const [form, setForm] = useState({
    projectId: visibleProjects[0]?.id ?? '',
    title: '',
    description: '',
    stepsToReproduce: '',
    expectedResult: '',
    actualResult: '',
    severity: 'Medium' as Severity,
    priority: 'Medium' as Priority,
    category: 'Backend' as Category,
    environment: '',
    browserDevice: '',
  })
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([])
  const [draft, setDraft] = useState<{ type: EvidenceType; title: string; content: string; fileUrl?: string }>({
    type: 'Console Error',
    title: '',
    content: '',
  })
  const [analyzeOnSubmit, setAnalyzeOnSubmit] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const titleError = checkLength(form.title, RULES.bugTitle.min, 'Title', RULES.bugTitle.max)
  const descriptionError = checkLength(
    form.description,
    RULES.bugDescription.min,
    'Description',
    RULES.bugDescription.max,
  )
  const projectError = form.projectId ? null : 'Choose a project before submitting.'
  const canSubmit = !titleError && !descriptionError && !projectError

  const submit = async () => {
    if (!canSubmit) {
      setTouched(true)
      toast({
        kind: 'error',
        title: 'Check the highlighted fields',
        description: titleError ?? descriptionError ?? projectError ?? undefined,
      })
      return
    }
    setSubmitting(true)
    try {
      const bug = await createBug({
        projectId: form.projectId,
        title: form.title.trim(),
        description: form.description.trim(),
        stepsToReproduce: form.stepsToReproduce.split('\n').map((s) => s.trim()).filter(Boolean),
        expectedResult: form.expectedResult,
        actualResult: form.actualResult,
        severity: form.severity,
        priority: form.priority,
        category: form.category,
        environment: form.environment,
        browserDevice: form.browserDevice,
        evidence: evidence.map((e) => ({
          id: `e-${e.id}`,
          type: e.type,
          title: e.title,
          content: e.content,
          fileUrl: e.fileUrl,
          addedBy: currentUser.id,
          addedAt: 'just now',
        })),
        // reporterId and status are set by the API from the token and the
        // workflow - sending them here is ignored.
        assigneeIds: [],
      })
      toast({
        kind: 'success',
        title: 'Bug reported',
        description: analyzeOnSubmit ? 'Running AI analysis with project context…' : 'Bug submitted to the backlog.',
      })
      navigate(`/bugs/${bug.id}`)
      if (analyzeOnSubmit) {
        analyzeBug(bug.id).catch(() => {
          /* analysis also available via the Run AI Analysis button on the bug page */
        })
      }
    } catch (err) {
      toast({ kind: 'error', title: 'Could not submit bug', description: errorMessage(err) })
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Report a Bug"
        description="Describe the problem clearly. The AI diagnoses it against this project's full context."
      />

      <div className="flex items-start gap-2 rounded-lg border border-indigo/20 bg-accent/50 p-3 text-xs text-accent-foreground">
        <Sparkles className="mt-0.5 size-3.5 shrink-0" />
        The more precise your reproduction steps and evidence, the more accurate the AI diagnosis. Everything you enter is analyzed alongside the project&apos;s tech stack and business rules - except screenshots, which are display only.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main form */}
        <div className="space-y-6">
          <DetailsCard
            visibleProjects={visibleProjects}
            projectId={form.projectId}
            title={form.title}
            description={form.description}
            set={set}
            touched={touched}
            setTouched={setTouched}
            projectError={projectError}
            titleError={titleError}
            descriptionError={descriptionError}
          />
          <ReproductionCard
            stepsToReproduce={form.stepsToReproduce}
            expectedResult={form.expectedResult}
            actualResult={form.actualResult}
            environment={form.environment}
            browserDevice={form.browserDevice}
            set={set}
          />
          <EvidenceCard evidence={evidence} setEvidence={setEvidence} draft={draft} setDraft={setDraft} />
        </div>

        <SubmitSidebar
          severity={form.severity}
          priority={form.priority}
          category={form.category}
          set={set}
          analyzeOnSubmit={analyzeOnSubmit}
          setAnalyzeOnSubmit={setAnalyzeOnSubmit}
          submitting={submitting}
          onSubmit={submit}
          onCancel={() => navigate('/bugs')}
        />
      </div>
    </div>
  )
}
