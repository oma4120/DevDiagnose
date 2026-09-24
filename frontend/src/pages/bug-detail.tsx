import { Link, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  ClipboardCheck,
  Code2,
  Copy,
  Download,
  FlaskConical,
  ListChecks,
  MessageSquarePlus,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
  UserPlus,
  Wand2,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs } from '@/components/ui/tabs'
import {
  CategoryBadge,
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
} from '@/components/badges'
import { Avatar } from '@/components/ui/avatar'
import { CodeBlock } from '@/components/ui/code-block'
import { MonoTextarea, Select } from '@/components/ui/field'
import { WorkflowTracker } from '@/components/workflow-tracker'
import { ConfidenceMeter } from '@/components/confidence-meter'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useBug, useData, useProject } from '@/lib/data-context'
import type { AIAnalysis, Bug, Comment, Project, Role } from '@/lib/types'

const roleBadge: Record<Role, string> = {
  Admin: 'border-amber-200 bg-amber-50 text-amber-700',
  QA: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  Developer: 'border-indigo-200 bg-indigo-50 text-indigo-700',
}

const commentAccent: Record<Comment['authorKind'], string> = {
  QA: 'bg-cyan',
  Developer: 'bg-indigo',
  System: 'bg-slate-400',
  AI: 'bg-violet-500',
}

function buildAgentPrompt(bug: Bug, project: Project | undefined, analysis?: AIAnalysis) {
  const stack = project
    ? [...project.frontend, ...project.backend, ...project.database, ...project.auth].join(', ')
    : 'Unknown stack'
  const rules = project?.businessRules.map((r) => `- ${r.title}: ${r.description}`).join('\n') || '- None specified'
  const evidence = bug.evidence
    .map((e) => `### ${e.title} (${e.type})\n\`\`\`${e.language ?? ''}\n${e.content}\n\`\`\``)
    .join('\n\n')

  return `You are a senior engineer fixing a production bug. Implement a complete, tested fix.

## Bug ${bug.ref}: ${bug.title}
${bug.description}

## Project context
- Project: ${project?.name ?? 'Unknown'} (${project?.type ?? ''})
- Tech stack: ${stack}
- Architecture: ${project?.architecture ?? 'n/a'}
- Conventions: ${project?.conventions ?? 'n/a'}
- Constraints: ${project?.constraints ?? 'n/a'}

## Business rules to respect
${rules}

## Steps to reproduce
${bug.stepsToReproduce.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Expected vs. actual
- Expected: ${bug.expectedResult}
- Actual: ${bug.actualResult}
- Environment: ${bug.environment} (${bug.browserDevice})
${
  analysis
    ? `
## AI root-cause diagnosis (confidence ${analysis.confidence}%)
${analysis.rootCause}

Suggested fix:
${analysis.suggestedFix.summary || analysis.suggestedFix.steps.join('\n')}
${analysis.suggestedFix.code ? `\n\`\`\`\n${analysis.suggestedFix.code}\n\`\`\`` : ''}

Recommended tests:
${analysis.recommendedTests.map((t) => `- ${t}`).join('\n')}`
    : ''
}

## Evidence
${evidence || 'No evidence attached.'}

## Deliverables
1. Identify the exact file(s) and line(s) to change.
2. Provide the minimal, correct fix as a diff.
3. Add or update tests that prove the fix and prevent regression.
4. Note any follow-up risks or related code paths to review.`
}

export default function BugWorkspacePage() {
  const params = useParams<{ id: string }>()
  const bug = useBug(params.id)
  const { toast } = useToast()
  const { members, addComment, setBugStatus, analyzeBug, currentUser, hasQA, assignBug } = useData()
  const [tab, setTab] = useState('investigation')
  const [assignOpen, setAssignOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)

  const project = useProject(bug?.projectId)
  const memberById = (id: string | undefined) => (id ? members.find((m) => m.id === id) : undefined)
  const reporter = memberById(bug?.reporterId)
  const assignees = (bug?.assigneeIds ?? [])
    .map((id) => memberById(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
  const validator = memberById(bug?.validatorId)
  const analyses = bug?.analyses ?? []
  const [analysisVersion, setAnalysisVersion] = useState(analyses.length ? analyses[analyses.length - 1].version : 0)
  const analysis = analyses.find((a) => a.version === analysisVersion)

  const [analyzing, setAnalyzing] = useState(false)
  const [comment, setComment] = useState('')
  const [copied, setCopied] = useState(false)

  const prompt = useMemo(
    () => (bug && analysis ? buildAgentPrompt(bug, project, analysis) : ''),
    [bug, project, analysis],
  )
  const [promptDraft, setPromptDraft] = useState(prompt)

  if (!bug) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <EmptyState
          icon={Sparkles}
          title="Bug not found"
          description="This bug may have been deleted or the link is incorrect."
          action={
            <Link
              to="/bugs"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
              Back to bugs
            </Link>
          }
        />
      </div>
    )
  }

  // Evidence added after the latest analysis -> suggest re-analysis (demo heuristic)
  const staleAnalysis = analysis && bug.evidence.length > analysis.evidenceConsidered.length

  const runAnalysis = async () => {
    setAnalyzing(true)
    toast({ kind: 'info', title: 'AI analysis started', description: 'Diagnosing with full project context…' })
    try {
      const newAnalysis = await analyzeBug(bug.id)
      setAnalysisVersion(newAnalysis.version)
      setTab('analysis')
      toast({ kind: 'success', title: `Analysis v${newAnalysis.version} ready`, description: 'Root cause and suggested fix generated.' })
    } catch {
      toast({ kind: 'error', title: 'Analysis failed', description: 'Please check the backend connection and try again.' })
    } finally {
      setAnalyzing(false)
    }
  }

  const addCommentHere = async () => {
    if (!comment.trim()) return
    const body = comment.trim()
    setComment('')
    try {
      await addComment(bug.id, body)
      toast({ kind: 'success', title: 'Comment added' })
    } catch {
      setComment(body)
      toast({ kind: 'error', title: 'Could not add comment', description: 'Please try again.' })
    }
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptDraft)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast({ kind: 'success', title: 'Prompt copied', description: 'Paste it into your coding agent.' })
    } catch {
      toast({ kind: 'error', title: 'Copy failed', description: 'Clipboard is unavailable.' })
    }
  }

  const changeStatus = async (status: Bug['status']) => {
    try {
      await setBugStatus(bug.id, status)
      toast({ kind: 'success', title: 'Status updated' })
    } catch {
      toast({ kind: 'error', title: 'Could not update status' })
    }
  }

  const teamMembers = (project?.memberIds ?? [])
    .map((id) => memberById(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))

  const toggleMember = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const saveAssign = async () => {
    setAssigning(true)
    try {
      await assignBug(bug.id, selected)
      setAssignOpen(false)
      toast({ kind: 'success', title: 'Assignee updated' })
    } catch (err) {
      toast({ kind: 'error', title: 'Could not assign', description: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setAssigning(false)
    }
  }

  const tabs = [
    { id: 'investigation', label: 'Investigation' },
    { id: 'evidence', label: 'Evidence', count: bug.evidence.length },
    { id: 'analysis', label: 'AI Analysis', count: analyses.length || undefined },
    { id: 'prompt', label: 'Coding Prompt' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <Link to="/bugs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />Back to bugs
      </Link>

      <PageHeader
        title={bug.title}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelected(bug.assigneeIds)
                setAssignOpen(true)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              <UserPlus className="size-4" />Assign
            </button>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:opacity-60"
            >
              {analyzing ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {analyzing ? 'Analyzing…' : analyses.length ? 'Re-analyze' : 'Run AI Analysis'}
            </button>
          </div>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{bug.ref}</span>
          <span className="text-muted-foreground">·</span>
          <Link to={`/projects/${bug.projectId}`} className="text-sm font-medium text-indigo hover:underline">{project?.name}</Link>
          <StatusBadge status={bug.status} />
          <SeverityBadge severity={bug.severity} />
          <PriorityBadge priority={bug.priority} />
          <CategoryBadge category={bug.category} />
        </div>
      </PageHeader>

      {assignOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAssignOpen(false)}>
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between !py-4">
                  <CardTitle>Assign bug</CardTitle>
                  <button onClick={() => setAssignOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
                    <X className="size-4" />
                  </button>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Pick from the {project?.name ?? 'project'} team - only team members can be assigned.
                  </p>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {teamMembers.length === 0 ? (
                      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No team members yet — add them from the project&apos;s Team tab.
                      </p>
                    ) : (
                      teamMembers.map((m) => {
                        const on = selected.includes(m.id)
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleMember(m.id)}
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
                            <span className={cn('flex size-5 shrink-0 items-center justify-center rounded border', on ? 'border-indigo bg-indigo text-white' : 'border-border')}>
                              {on && <Check className="size-3.5" />}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setAssignOpen(false)}
                      className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void saveAssign()}
                      disabled={assigning}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:bg-indigo/90 disabled:opacity-60"
                    >
                      <UserPlus className="size-4" />
                      {assigning ? 'Saving…' : 'Save assignees'}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>,
          document.body,
        )}

      <Card className="p-4">
        <WorkflowTracker
          status={bug.status}
          hasQA={hasQA}
          fixer={assignees[0]?.name}
          validator={validator?.name}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'investigation' && (
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Description</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{bug.description}</p></CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-muted-foreground" />Steps to reproduce</CardTitle></CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {bug.stepsToReproduce.map((s, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-soft text-[11px] font-medium text-foreground">{i + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Expected vs. actual</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Expected</p>
                      <p className="mt-1 text-muted-foreground">{bug.expectedResult}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-error">Actual</p>
                      <p className="mt-1 text-muted-foreground">{bug.actualResult}</p>
                    </div>
                    <div className="border-t border-border pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Environment</p>
                      <p className="mt-1 text-muted-foreground">{bug.environment}</p>
                      <p className="text-xs text-muted-foreground">{bug.browserDevice}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Discussion */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquarePlus className="size-4 text-muted-foreground" />Discussion</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {bug.comments.length ? (
                    <ul className="space-y-4">
                      {bug.comments.map((c) => (
                        <li key={c.id} className="flex gap-3">
                          {c.authorKind === 'AI' ? (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white"><Bot className="size-4" /></span>
                          ) : c.authorKind === 'System' ? (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600"><Check className="size-4" /></span>
                          ) : (
                            <Avatar name={c.authorName} size="md" color={c.authorKind === 'QA' ? '#06b6d4' : '#6366f1'} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{c.authorName}</span>
                              <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white', commentAccent[c.authorKind])}>{c.authorKind}</span>
                              <span className="text-xs text-muted-foreground">{c.at}</span>
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No comments yet. Start the investigation below.</p>
                  )}

                  <div className="flex items-start gap-3 border-t border-border pt-4">
                    <Avatar name="You" color="#6366f1" size="md" />
                    <div className="flex-1">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Add a comment or investigation note…"
                        className="min-h-16 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={addCommentHere}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo px-3 text-xs font-medium text-white hover:bg-indigo/90"
                        >
                          <Send className="size-3.5" />Comment
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 'evidence' && (
            <div className="space-y-4">
              {bug.evidence.length ? (
                bug.evidence.map((e) => {
                  const addedBy = memberById(e.addedBy)
                  return (
                    <Card key={e.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {e.language ? <Code2 className="size-4 text-muted-foreground" /> : <Paperclip className="size-4 text-muted-foreground" />}
                          {e.title}
                          <span className="rounded-md bg-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{e.type}</span>
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">{addedBy?.name} · {e.addedAt}</span>
                      </CardHeader>
                      <CardContent>
                        {e.language ? (
                          <CodeBlock code={e.content} language={e.language} label={e.type} />
                        ) : (
                          <p className="text-sm leading-relaxed text-muted-foreground">{e.content}</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <EmptyState icon={Paperclip} title="No evidence attached" description="Add logs, stack traces, or code to improve AI diagnosis." />
              )}
            </div>
          )}

          {tab === 'analysis' && (
            <div className="space-y-4">
              {analysis ? (
                <>
                  {staleAnalysis && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>New evidence was added after this analysis. <button onClick={runAnalysis} className="font-semibold underline">Re-run analysis</button> to incorporate it.</span>
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-indigo" />AI Diagnosis</CardTitle>
                      <div className="flex items-center gap-2">
                        {analyses.length > 1 && (
                          <Select
                            value={String(analysisVersion)}
                            onChange={(e) => setAnalysisVersion(Number(e.target.value))}
                            className="h-8 w-auto text-xs"
                          >
                            {analyses.map((a) => <option key={a.id} value={a.version}>Version {a.version}</option>)}
                          </Select>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Bot className="size-3.5" />{analysis.model}</span>
                        <span>{analysis.generatedAt}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-indigo/20 bg-accent px-2 py-0.5 text-accent-foreground">{analysis.contextVersion}</span>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Classification</p>
                          <p className="text-sm text-foreground">{analysis.classification}</p>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs text-muted-foreground">AI recommends:</span>
                            <SeverityBadge severity={analysis.severityRec} />
                            <PriorityBadge priority={analysis.priorityRec} />
                          </div>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <ConfidenceMeter value={analysis.confidence} />
                        </div>
                      </div>

                      <AnalysisSection icon={AlertTriangle} title="Root cause">
                        <p className="text-sm leading-relaxed text-muted-foreground">{analysis.rootCause}</p>
                      </AnalysisSection>

                      <AnalysisSection icon={Sparkles} title="Explanation">
                        <p className="text-sm leading-relaxed text-muted-foreground">{analysis.explanation}</p>
                      </AnalysisSection>

                      <AnalysisSection icon={ListChecks} title="Investigation steps">
                        <ol className="space-y-1.5">
                          {analysis.investigationSteps.map((s, i) => (
                            <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-soft text-[11px] font-medium text-foreground">{i + 1}</span>{s}
                            </li>
                          ))}
                        </ol>
                      </AnalysisSection>

                      <AnalysisSection icon={Wand2} title="Suggested fix">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {analysis.suggestedFix.summary}
                        </p>
                        {analysis.suggestedFix.steps.length > 0 && (
                          <ol className="mt-3 space-y-1.5">
                            {analysis.suggestedFix.steps.map((s, i) => (
                              <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-soft text-[11px] font-medium text-foreground">{i + 1}</span>{s}
                              </li>
                            ))}
                          </ol>
                        )}
                        {analysis.suggestedFix.code && (
                          <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-navy p-3 text-xs leading-relaxed text-slate-200">
                            <code>{analysis.suggestedFix.code}</code>
                          </pre>
                        )}
                      </AnalysisSection>

                      <AnalysisSection icon={FlaskConical} title="Recommended tests">
                        <ul className="space-y-1.5">
                          {analysis.recommendedTests.map((t, i) => (
                            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />{t}
                            </li>
                          ))}
                        </ul>
                      </AnalysisSection>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Uncertainty</p>
                          <p className="mt-1.5 text-xs leading-relaxed text-amber-800">
                            {analysis.uncertainty ?? 'No open questions recorded.'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence considered</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {analysis.evidenceConsidered.map((e) => (
                              <span key={e} className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-medium text-slate-700">{e}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                        <button onClick={() => setTab('prompt')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:bg-indigo/90">
                          <Terminal className="size-4" />Generate coding prompt
                        </button>
                        <button onClick={() => toast({ kind: 'success', title: 'Marked helpful', description: 'Feedback improves future analyses.' })} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                          <Check className="size-4" />Helpful
                        </button>
                        <button onClick={runAnalysis} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                          <RefreshCw className="size-4" />Re-analyze
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="No AI analysis yet"
                  description="Run an analysis to get a root-cause diagnosis, suggested fix, and recommended tests using this project's full context."
                  action={
                    <button onClick={runAnalysis} disabled={analyzing} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:bg-indigo/90 disabled:opacity-60">
                      {analyzing ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {analyzing ? 'Analyzing…' : 'Run AI Analysis'}
                    </button>
                  }
                />
              )}
            </div>
          )}

          {tab === 'prompt' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-indigo/20 bg-accent/50 p-3 text-xs text-accent-foreground">
                <Terminal className="mt-0.5 size-3.5 shrink-0" />
                A ready-to-paste prompt for a coding agent. It bundles the bug, project context, evidence, and the AI diagnosis. Edit before copying if needed.
              </div>

              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <Card className="lg:sticky lg:top-6 lg:self-start">
                  <CardHeader><CardTitle className="text-xs uppercase tracking-wide">Included context</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <ContextRow label="Bug details" ok />
                    <ContextRow label="Reproduction steps" ok={bug.stepsToReproduce.length > 0} />
                    <ContextRow label="Project stack & rules" ok={!!project} />
                    <ContextRow label={`Evidence (${bug.evidence.length})`} ok={bug.evidence.length > 0} />
                    <ContextRow label="AI diagnosis" ok={!!analysis} />
                    <button
                      onClick={() => setPromptDraft(prompt)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                    >
                      <RefreshCw className="size-3.5" />Regenerate
                    </button>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Code2 className="size-4 text-muted-foreground" />Coding-agent prompt</CardTitle>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toast({ kind: 'info', title: 'Exported', description: 'Prompt saved as bug-' + bug.ref.replace('#', '') + '.md' })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted">
                        <Download className="size-3.5" />Export
                      </button>
                      <button onClick={copyPrompt} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo px-2.5 text-xs font-medium text-white hover:bg-indigo/90">
                        {copied ? <ClipboardCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                        {copied ? 'Copied' : 'Copy prompt'}
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <MonoTextarea value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} className="min-h-[28rem]" />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <MetaRow label="Reporter">
                {reporter && (
                  <span className="flex items-center gap-1.5"><Avatar name={reporter.name} color={reporter.avatarColor} size="xs" />{reporter.name}</span>
                )}
              </MetaRow>
              <MetaRow label="Assignee">
                {assignees.length ? (
                  <span className="flex items-center gap-1.5"><Avatar name={assignees[0].name} color={assignees[0].avatarColor} size="xs" />{assignees[0].name}</span>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </MetaRow>
              {validator && (
                <MetaRow label="Validator">
                  <span className="flex items-center gap-1.5"><Avatar name={validator.name} color={validator.avatarColor} size="xs" />{validator.name}</span>
                </MetaRow>
              )}
              <MetaRow label="Category"><CategoryBadge category={bug.category} /></MetaRow>
              <MetaRow label="Created"><span className="text-muted-foreground">{bug.createdAt}</span></MetaRow>
              <MetaRow label="Updated"><span className="text-muted-foreground">{bug.updatedAt}</span></MetaRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={bug.status}
                onChange={(e) => changeStatus(e.target.value as Bug['status'])}
                disabled={currentUser.role === 'QA' && bug.status === 'In Progress'}
              >
                {['Submitted', 'Assigned', 'In Progress', 'Resolved', 'QA Validation', 'Closed'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              {bug.status === 'Resolved' && hasQA && currentUser.role !== 'Developer' && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => changeStatus('Closed')} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-600/90">
                    <Check className="size-4" />Validate
                  </button>
                  <button onClick={() => changeStatus('In Progress')} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                    Reject
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {bug.timeline.map((t, i) => (
                  <li key={t.id} className="relative flex gap-3 pb-1">
                    {i < bug.timeline.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden />}
                    <span className={cn('mt-1 size-3.5 shrink-0 rounded-full ring-4 ring-card', timelineColor(t.kind))} />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.actor} · {t.at}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function timelineColor(kind: Bug['timeline'][number]['kind']) {
  switch (kind) {
    case 'ai':
      return 'bg-violet-500'
    case 'resolved':
    case 'validated':
      return 'bg-emerald-500'
    case 'assigned':
      return 'bg-blue-500'
    case 'closed':
      return 'bg-slate-400'
    default:
      return 'bg-indigo'
  }
}

function AnalysisSection({ icon: Icon, title, children }: { icon: typeof Sparkles; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="size-3.5 text-muted-foreground" />{title}</p>
      {children}
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

function ContextRow({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('flex size-4 items-center justify-center rounded-full', ok ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground')}>
        {ok ? <Check className="size-2.5" /> : <span className="size-1 rounded-full bg-current" />}
      </span>
      <span className={cn('text-sm', ok ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
    </div>
  )
}