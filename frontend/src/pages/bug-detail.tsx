import { Link, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { ArrowLeft, Pencil, RefreshCw, Sparkles, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card } from '@/components/ui/card'
import { Tabs } from '@/components/ui/tabs'
import {
  CategoryBadge,
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
} from '@/components/badges'
import { WorkflowTracker } from '@/components/workflow-tracker'
import { EmptyState } from '@/components/empty-state'
import { useToast } from '@/components/ui/toast'
import { useBug, useData, useProject } from '@/lib/data-context'
import { allowedStatuses, statusLabel } from '@/lib/status-rules'
import { checkLength, errorMessage, RULES } from '@/lib/validation'
import type { Bug } from '@/lib/types'
import { buildAgentPrompt } from './bug-detail/prompt'
import { AssignDialog } from './bug-detail/assign-dialog'
import { EditReportDialog } from './bug-detail/edit-report-dialog'
import type { EditReportForm } from './bug-detail/edit-report-dialog'
import { InvestigationTab } from './bug-detail/investigation-tab'
import { EvidenceTab } from './bug-detail/evidence-tab'
import { AnalysisTab } from './bug-detail/analysis-tab'
import { PromptTab } from './bug-detail/prompt-tab'
import { SidebarCards } from './bug-detail/sidebar-cards'

export default function BugWorkspacePage() {
  const params = useParams<{ id: string }>()
  const bug = useBug(params.id)
  const { toast } = useToast()
  const { members, addComment, updateBug, setBugStatus, analyzeBug, currentUser, hasQA, assignBug } = useData()
  const [tab, setTab] = useState('investigation')
  const [assignOpen, setAssignOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState<EditReportForm>({
    title: '',
    description: '',
    category: 'Other' as Bug['category'],
    stepsToReproduce: '',
    expectedResult: '',
    actualResult: '',
    environment: '',
    browserDevice: '',
  })

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

  // Evidence or report content changed after the latest analysis -> suggest
  // re-analysis. Screenshots are display-only and never analyzed, so they
  // don't count. Report edits bump bug.reportRevision (see backend patch_bug).
  const analyzedEvidence = bug.evidence.filter((e) => e.type !== 'Screenshot').length
  const staleEvidence = analysis ? analyzedEvidence > analysis.evidenceConsidered.length : false
  const staleReport = analysis ? (bug.reportRevision ?? 0) > (analysis.reportRevision ?? 0) : false

  const canEditReport =
    currentUser.role === 'Admin' ||
    bug.reporterId === currentUser.id ||
    bug.assigneeIds.includes(currentUser.id) ||
    (project?.memberIds ?? []).includes(currentUser.id)

  const openEdit = () => {
    setEditForm({
      title: bug.title,
      description: bug.description,
      category: bug.category,
      stepsToReproduce: bug.stepsToReproduce.join('\n'),
      expectedResult: bug.expectedResult,
      actualResult: bug.actualResult,
      environment: bug.environment,
      browserDevice: bug.browserDevice,
    })
    setEditOpen(true)
  }

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
    const body = comment.trim()
    if (!body) return
    if (body.length > RULES.comment.max) {
      toast({
        kind: 'error',
        title: 'Comment too long',
        description: `Comments are limited to ${RULES.comment.max} characters.`,
      })
      return
    }
    setComment('')
    try {
      await addComment(bug.id, body)
      toast({ kind: 'success', title: 'Comment added' })
    } catch (err) {
      setComment(body)
      toast({ kind: 'error', title: 'Could not add comment', description: errorMessage(err) })
    }
  }

  const exportPrompt = () => {
    const blob = new Blob([promptDraft], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bug-${bug.ref.replace('#', '')}-agent-prompt.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast({ kind: 'success', title: 'Exported', description: `Saved as bug-${bug.ref.replace('#', '')}-agent-prompt.txt` })
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
      const updated = await setBugStatus(bug.id, status)
      let description: string | undefined
      if (updated.status !== status) {
        description =
          updated.status === 'QA Validation' && !hasQA
            ? `Moved to ${statusLabel(updated.status, hasQA)} - waiting for the reporter's validation.`
            : `Moved to ${statusLabel(updated.status, hasQA)} - waiting for QA validation.`
      }
      toast({
        kind: 'success',
        title: 'Status updated',
        description,
      })
    } catch (err) {
      toast({
        kind: 'error',
        title: 'Could not update status',
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const statusOptions = allowedStatuses({
    status: bug.status,
    role: currentUser.role,
    hasQA,
    isTeamMember: currentUser.role === 'Admin' || (project?.memberIds ?? []).includes(currentUser.id),
    // Reporter validates only when someone else made the fix (self-fix = plain dev).
    isReporter: bug.reporterId === currentUser.id && bug.reporterId !== bug.resolvedBy,
  })
  const isValidatable = bug.status === 'Resolved' || bug.status === 'QA Validation'
  // With no QA workflow, the reporter of the bug validates fixes made by others.
  const isReporterValidator =
    !hasQA &&
    currentUser.role !== 'Admin' &&
    bug.reporterId === currentUser.id &&
    bug.reporterId !== bug.resolvedBy
  const canValidate = (hasQA || isReporterValidator) && isValidatable && statusOptions.includes('Closed')
  const canReject = (hasQA || isReporterValidator) && isValidatable && statusOptions.includes('In Progress') && canValidate
  // No-QA workspace: when the fix is made by someone other than the reporter,
  // the reporter takes the QA role and validates it (self-fixed bugs skip this).
  const reporterValidates =
    !hasQA &&
    (bug.status === 'QA Validation' ||
      (bug.status !== 'Resolved' &&
        bug.status !== 'Closed' &&
        bug.assigneeIds.some((id) => id !== bug.reporterId)))

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

  const editTitleError = checkLength(editForm.title, RULES.bugTitle.min, 'Title', RULES.bugTitle.max)
  const editDescriptionError = checkLength(
    editForm.description,
    RULES.bugDescription.min,
    'Description',
    RULES.bugDescription.max,
  )

  const saveEdit = async () => {
    if (editTitleError || editDescriptionError) {
      toast({
        kind: 'error',
        title: 'Check the highlighted fields',
        description: editTitleError ?? editDescriptionError ?? undefined,
      })
      return
    }
    setSavingEdit(true)
    try {
      await updateBug(bug.id, {
        title: editForm.title.trim(),
        description: editForm.description,
        category: editForm.category,
        stepsToReproduce: editForm.stepsToReproduce
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        expectedResult: editForm.expectedResult,
        actualResult: editForm.actualResult,
        environment: editForm.environment,
        browserDevice: editForm.browserDevice,
      })
      setEditOpen(false)
      toast({
        kind: 'success',
        title: 'Report updated',
        description: analyses.length
          ? 'The current AI analysis is now marked stale - re-run it to incorporate your changes.'
          : undefined,
      })
    } catch (err) {
      toast({
        kind: 'error',
        title: 'Could not update report',
        description: errorMessage(err, 'Unknown error'),
      })
    } finally {
      setSavingEdit(false)
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
            {canEditReport && (
              <button
                onClick={openEdit}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
              >
                <Pencil className="size-4" />Edit report
              </button>
            )}
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
              onClick={() => void runAnalysis()}
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

      {assignOpen && (
        <AssignDialog
          projectName={project?.name}
          teamMembers={teamMembers}
          selected={selected}
          onToggle={toggleMember}
          assigning={assigning}
          onSave={() => void saveAssign()}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {editOpen && (
        <EditReportDialog
          bugRef={bug.ref}
          form={editForm}
          setForm={setEditForm}
          titleError={editTitleError}
          descriptionError={editDescriptionError}
          saving={savingEdit}
          onSave={() => void saveEdit()}
          onClose={() => setEditOpen(false)}
        />
      )}

      <Card className="p-4">
        <WorkflowTracker
          status={bug.status}
          hasQA={hasQA || reporterValidates}
          fixer={assignees[0]?.name}
          validator={validator?.name ?? (reporterValidates ? reporter?.name : undefined)}
          validationLabel={statusLabel('QA Validation', hasQA)}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'investigation' && (
            <InvestigationTab
              bug={bug}
              comment={comment}
              onCommentChange={setComment}
              onAddComment={() => void addCommentHere()}
            />
          )}

          {tab === 'evidence' && <EvidenceTab bug={bug} memberById={memberById} />}

          {tab === 'analysis' && (
            <AnalysisTab
              analysis={analysis}
              analyses={analyses}
              analysisVersion={analysisVersion}
              onVersionChange={setAnalysisVersion}
              staleReport={staleReport}
              staleEvidence={staleEvidence}
              onRunAnalysis={() => void runAnalysis()}
              analyzing={analyzing}
              onShowPrompt={() => setTab('prompt')}
            />
          )}

          {tab === 'prompt' && (
            <PromptTab
              bug={bug}
              project={project}
              analysis={analysis}
              analyzedEvidence={analyzedEvidence}
              promptDraft={promptDraft}
              onPromptChange={setPromptDraft}
              onRegenerate={() => setPromptDraft(prompt)}
              onExport={exportPrompt}
              onCopy={() => void copyPrompt()}
              copied={copied}
            />
          )}
        </div>

        {/* Sidebar */}
        <SidebarCards
          bug={bug}
          reporter={reporter}
          assignees={assignees}
          validator={validator}
          statusOptions={statusOptions}
          hasQA={hasQA}
          canValidate={canValidate}
          canReject={canReject}
          onStatusChange={(s) => void changeStatus(s)}
        />
      </div>
    </div>
  )
}
