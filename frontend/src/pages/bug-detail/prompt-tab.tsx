import { Check, ClipboardCheck, Code2, Copy, Download, RefreshCw, Terminal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MonoTextarea } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import type { AIAnalysis, Bug, Project } from '@/lib/types'

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

export function PromptTab({
  bug,
  project,
  analysis,
  analyzedEvidence,
  promptDraft,
  onPromptChange,
  onRegenerate,
  onExport,
  onCopy,
  copied,
}: {
  bug: Bug
  project: Project | undefined
  analysis: AIAnalysis | undefined
  analyzedEvidence: number
  promptDraft: string
  onPromptChange: (value: string) => void
  onRegenerate: () => void
  onExport: () => void
  onCopy: () => void
  copied: boolean
}) {
  return (
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
            <ContextRow label={`Evidence (${analyzedEvidence})`} ok={bug.evidence.length > 0} />
            <ContextRow label="AI diagnosis" ok={!!analysis} />
            <button
              onClick={onRegenerate}
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
              <button onClick={onExport} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted">
                <Download className="size-3.5" />Export
              </button>
              <button onClick={onCopy} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo px-2.5 text-xs font-medium text-white hover:bg-indigo/90">
                {copied ? <ClipboardCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? 'Copied' : 'Copy prompt'}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <MonoTextarea value={promptDraft} onChange={(e) => onPromptChange(e.target.value)} className="min-h-[28rem]" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
