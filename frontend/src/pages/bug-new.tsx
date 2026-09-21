import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Bug as BugIcon,
  Code2,
  FileText,
  Info,
  ListChecks,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select, Textarea, FieldHint, MonoTextarea } from '@/components/ui/field'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useData } from '@/lib/data-context'
import type { Category, EvidenceType, Priority, Severity } from '@/lib/types'

const evidenceTypes: EvidenceType[] = [
  'Screenshot',
  'Console Error',
  'API Response',
  'Server Log',
  'Stack Trace',
  'Relevant Code',
  'Other',
]
const severities: Severity[] = ['Critical', 'High', 'Medium', 'Low']
const priorities: Priority[] = ['Urgent', 'High', 'Medium', 'Low']
const categories: Category[] = [
  'Frontend',
  'Backend',
  'Database',
  'API',
  'Authentication',
  'Security',
  'Performance',
  'UI/UX',
  'Other',
]

interface EvidenceDraft {
  id: number
  type: EvidenceType
  title: string
  content: string
}

const codeLikeTypes: EvidenceType[] = ['Console Error', 'API Response', 'Server Log', 'Stack Trace', 'Relevant Code']

export default function NewBugPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { projects, currentUser, createBug, analyzeBug } = useData()

  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? '',
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
  const [draft, setDraft] = useState<{ type: EvidenceType; title: string; content: string }>({
    type: 'Console Error',
    title: '',
    content: '',
  })
  const [analyzeOnSubmit, setAnalyzeOnSubmit] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const addEvidence = () => {
    if (!draft.content.trim()) {
      toast({ kind: 'warning', title: 'Nothing to attach', description: 'Add some content before attaching evidence.' })
      return
    }
    setEvidence((e) => [...e, { id: Date.now(), ...draft, title: draft.title.trim() || draft.type }])
    setDraft({ type: draft.type, title: '', content: '' })
    toast({ kind: 'success', title: 'Evidence attached', description: 'The AI will consider it during analysis.' })
  }

  const removeEvidence = (id: number) => setEvidence((e) => e.filter((x) => x.id !== id))

  const canSubmit = form.title.trim() && form.description.trim() && form.projectId

  const submit = async () => {
    if (!canSubmit) {
      toast({ kind: 'error', title: 'Missing required fields', description: 'A title, description, and project are required.' })
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
          addedBy: currentUser.id,
          addedAt: 'just now',
        })),
        reporterId: currentUser.id,
        assigneeIds: [],
        status: 'Submitted',
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
    } catch {
      toast({ kind: 'error', title: 'Could not submit bug', description: 'Please try again.' })
      setSubmitting(false)
    }
  }

  const isCodeLike = codeLikeTypes.includes(draft.type)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Report a Bug"
        description="Describe the problem clearly. The AI diagnoses it against this project's full context."
      />

      <div className="flex items-start gap-2 rounded-lg border border-indigo/20 bg-accent/50 p-3 text-xs text-accent-foreground">
        <Sparkles className="mt-0.5 size-3.5 shrink-0" />
        The more precise your reproduction steps and evidence, the more accurate the AI diagnosis. Everything you enter is analyzed alongside the project&apos;s tech stack and business rules.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main form */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" />Bug details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="project">Project</Label>
                <Select id="project" value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <FieldHint>Determines which context the AI uses to diagnose this bug.</FieldHint>
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Checkout returns HTTP 500 when cart is empty" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is happening, where, and why it matters." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-muted-foreground" />Reproduction</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="steps">Steps to reproduce</Label>
                <Textarea id="steps" value={form.stepsToReproduce} onChange={(e) => set('stepsToReproduce', e.target.value)} placeholder={'1. Sign in as any customer with an empty cart.\n2. POST to /v1/checkout.\n3. Observe the response.'} className="min-h-28" />
                <FieldHint>One step per line. Numbered lists work best.</FieldHint>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="expected">Expected result</Label>
                  <Textarea id="expected" value={form.expectedResult} onChange={(e) => set('expectedResult', e.target.value)} placeholder="What should happen." className="min-h-20" />
                </div>
                <div>
                  <Label htmlFor="actual">Actual result</Label>
                  <Textarea id="actual" value={form.actualResult} onChange={(e) => set('actualResult', e.target.value)} placeholder="What actually happens." className="min-h-20" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="env">Environment</Label>
                  <Input id="env" value={form.environment} onChange={(e) => set('environment', e.target.value)} placeholder="Staging — staging.shop.northwind.dev" />
                </div>
                <div>
                  <Label htmlFor="browser">Browser / device</Label>
                  <Input id="browser" value={form.browserDevice} onChange={(e) => set('browserDevice', e.target.value)} placeholder="Chrome 128 / macOS" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Paperclip className="size-4 text-muted-foreground" />Evidence</CardTitle>
              <span className="text-xs text-muted-foreground">{evidence.length} attached</span>
            </CardHeader>
            <CardContent className="space-y-4">
              {evidence.length > 0 && (
                <ul className="space-y-2">
                  {evidence.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md', codeLikeTypes.includes(e.type) ? 'bg-navy text-slate-100' : 'bg-accent text-accent-foreground')}>
                        {codeLikeTypes.includes(e.type) ? <Code2 className="size-4" /> : <Paperclip className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{e.title}</span>
                          <span className="rounded-md bg-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{e.type}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 font-mono text-xs text-muted-foreground">{e.content}</p>
                      </div>
                      <button onClick={() => removeEvidence(e.id)} className="rounded-md p-1 text-muted-foreground hover:text-error" aria-label="Remove evidence"><Trash2 className="size-4" /></button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded-lg border border-dashed border-border p-3">
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <div>
                    <Label>Type</Label>
                    <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as EvidenceType })}>
                      {evidenceTypes.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Label</Label>
                    <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Server traceback" />
                  </div>
                </div>
                <div className="mt-3">
                  <Label>Content</Label>
                  {isCodeLike ? (
                    <MonoTextarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="Paste the log, trace, response, or code snippet…" />
                  ) : (
                    <Textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="Describe or paste the evidence…" />
                  )}
                </div>
                <button onClick={addEvidence} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  <Plus className="size-4" />Attach evidence
                </button>
              </div>

              {evidence.length === 0 && (
                <EmptyState icon={Paperclip} title="No evidence yet" description="Logs, stack traces, API responses, and code make AI diagnosis far more accurate." className="border-0 py-6" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: classification + submit */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BugIcon className="size-4 text-muted-foreground" />Classification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onChange={(e) => set('severity', e.target.value as Severity)}>
                  {severities.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                  {priorities.map((p) => <option key={p}>{p}</option>)}
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-indigo/20 bg-accent/40 p-2.5 text-[11px] text-accent-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                The AI may recommend a different severity and priority after analyzing the evidence.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={analyzeOnSubmit} onChange={(e) => setAnalyzeOnSubmit(e.target.checked)} className="mt-0.5 size-4 rounded border-input text-indigo focus-visible:ring-2 focus-visible:ring-ring/30" />
                <span className="text-sm">
                  <span className="font-medium text-foreground">Run AI analysis on submit</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Generate a root-cause diagnosis immediately using project context.</span>
                </span>
              </label>
              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzeOnSubmit ? <Sparkles className="size-4" /> : <BugIcon className="size-4" />}
                {analyzeOnSubmit ? 'Submit & Analyze' : 'Submit Bug'}
              </button>
              <button
                onClick={() => navigate('/bugs')}
                className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}