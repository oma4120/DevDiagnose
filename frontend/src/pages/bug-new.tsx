import { useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import {
  Bug as BugIcon,
  Code2,
  FileText,
  Image as ImageIcon,
  Info,
  ListChecks,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select, Textarea, FieldHint, FieldError, MonoTextarea } from '@/components/ui/field'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useData, useVisibleProjects } from '@/lib/data-context'
import { checkLength, errorMessage, RULES } from '@/lib/validation'
import type { Category, EvidenceType, Priority, Severity } from '@/lib/types'

const evidenceTypes: EvidenceType[] = [
  'Screenshot',
  'Console Error',
  'API Response',
  'Server Log',
  'Stack Trace',
  'Relevant Code',
  'Network Request',
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
  'Regression',
  'Network',
  'Other',
]

interface EvidenceDraft {
  id: number
  type: EvidenceType
  title: string
  content: string
  fileUrl?: string
}

const codeLikeTypes: EvidenceType[] = ['Console Error', 'API Response', 'Server Log', 'Stack Trace', 'Relevant Code']

/** Reads an image file and downscales it to a JPEG data URL (display-only storage). */
function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Only image files are supported'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Image must be smaller than 8 MB'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

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
  const imageRef = useRef<HTMLInputElement>(null)
  const [analyzeOnSubmit, setAnalyzeOnSubmit] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const isScreenshot = draft.type === 'Screenshot'

  const pickScreenshot = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await readImageFile(file)
      setDraft((d) => ({ ...d, fileUrl: dataUrl }))
    } catch (err) {
      toast({ kind: 'error', title: 'Could not attach image', description: err instanceof Error ? err.message : undefined })
    }
  }

  const addEvidence = () => {
    if (isScreenshot) {
      if (!draft.fileUrl) {
        toast({ kind: 'warning', title: 'No image selected', description: 'Choose a screenshot image before attaching.' })
        return
      }
      setEvidence((e) => [...e, { id: Date.now(), ...draft, title: draft.title.trim() || draft.type }])
      setDraft({ type: draft.type, title: '', content: '', fileUrl: undefined })
      toast({ kind: 'success', title: 'Screenshot attached', description: 'Shown for display only - the AI will not analyze it.' })
      return
    }
    if (!draft.content.trim()) {
      toast({ kind: 'warning', title: 'Nothing to attach', description: 'Add some content before attaching evidence.' })
      return
    }
    setEvidence((e) => [...e, { id: Date.now(), ...draft, title: draft.title.trim() || draft.type }])
    setDraft({ type: draft.type, title: '', content: '', fileUrl: undefined })
    toast({ kind: 'success', title: 'Evidence attached', description: 'The AI will consider it during analysis.' })
  }

  const removeEvidence = (id: number) => setEvidence((e) => e.filter((x) => x.id !== id))

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
    } catch (err) {
      toast({ kind: 'error', title: 'Could not submit bug', description: errorMessage(err) })
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
        The more precise your reproduction steps and evidence, the more accurate the AI diagnosis. Everything you enter is analyzed alongside the project&apos;s tech stack and business rules - except screenshots, which are display only.
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
                  {visibleProjects.length === 0 ? (
                    <option value="" disabled>No accessible projects - ask an admin to add you to a team</option>
                  ) : (
                    visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                  )}
                </Select>
                <FieldHint>Determines which context the AI uses to diagnose this bug.</FieldHint>
                <FieldError>{touched ? projectError : null}</FieldError>
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="e.g. Checkout returns HTTP 500 when cart is empty"
                  aria-invalid={Boolean(touched && titleError)}
                />
                <FieldHint>At least {RULES.bugTitle.min} characters. One clear sentence works best.</FieldHint>
                <FieldError>{touched ? titleError : null}</FieldError>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="What is happening, where, and why it matters."
                  aria-invalid={Boolean(touched && descriptionError)}
                />
                <FieldHint>
                  At least {RULES.bugDescription.min} characters - the AI skips analysis of placeholder text.
                </FieldHint>
                <FieldError>{touched ? descriptionError : null}</FieldError>
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
                  <Input id="env" value={form.environment} onChange={(e) => set('environment', e.target.value)} placeholder="Staging - staging.shop.northwind.dev" />
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
                      {e.fileUrl ? (
                        <img src={e.fileUrl} alt="" className="mt-0.5 size-10 shrink-0 rounded-md border border-border object-cover" />
                      ) : (
                        <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md', codeLikeTypes.includes(e.type) ? 'bg-navy text-slate-100' : 'bg-accent text-accent-foreground')}>
                          {codeLikeTypes.includes(e.type) ? <Code2 className="size-4" /> : <Paperclip className="size-4" />}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{e.title}</span>
                          <span className="rounded-md bg-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{e.type}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 font-mono text-xs text-muted-foreground">
                          {e.fileUrl ? 'Display only - not analyzed by the AI' : e.content}
                        </p>
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
                    <Select
                      value={draft.type}
                      onChange={(e) => setDraft({ type: e.target.value as EvidenceType, title: draft.title, content: draft.content, fileUrl: undefined })}
                    >
                      {evidenceTypes.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Label</Label>
                    <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Server traceback" />
                  </div>
                </div>
                <div className="mt-3">
                  <Label>{isScreenshot ? 'Image' : 'Content'}</Label>
                  {isScreenshot ? (
                    <div className="space-y-2">
                      {draft.fileUrl ? (
                        <div className="flex items-start gap-3">
                          <img src={draft.fileUrl} alt="Screenshot preview" className="max-h-44 rounded-lg border border-border object-contain" />
                          <div className="space-y-1">
                            <button type="button" onClick={() => imageRef.current?.click()} className="block text-xs font-medium text-indigo hover:underline">
                              Replace image
                            </button>
                            <button type="button" onClick={() => setDraft((d) => ({ ...d, fileUrl: undefined }))} className="block text-xs font-medium text-error hover:underline">
                              Remove image
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => imageRef.current?.click()}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground hover:border-indigo/40 hover:text-indigo"
                        >
                          <ImageIcon className="size-4" />Choose image…
                        </button>
                      )}
                      <input
                        ref={imageRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          void pickScreenshot(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        PNG or JPG, auto-resized. Display only - not sent to the AI analysis.
                      </p>
                    </div>
                  ) : isCodeLike ? (
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
                disabled={submitting}
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