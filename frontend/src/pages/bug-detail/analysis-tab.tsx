import {
  AlertTriangle,
  Bot,
  Check,
  FlaskConical,
  ListChecks,
  RefreshCw,
  Sparkles,
  Terminal,
  Wand2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { PriorityBadge, SeverityBadge } from '@/components/badges'
import { ConfidenceMeter } from '@/components/confidence-meter'
import { EmptyState } from '@/components/empty-state'
import { useToast } from '@/components/ui/toast'
import type { AIAnalysis } from '@/lib/types'

function AnalysisSection({ icon: Icon, title, children }: { icon: typeof Sparkles; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="size-3.5 text-muted-foreground" />{title}</p>
      {children}
    </div>
  )
}

export function AnalysisTab({
  analysis,
  analyses,
  analysisVersion,
  onVersionChange,
  staleReport,
  staleEvidence,
  onRunAnalysis,
  analyzing,
  onShowPrompt,
}: {
  analysis: AIAnalysis | undefined
  analyses: AIAnalysis[]
  analysisVersion: number
  onVersionChange: (version: number) => void
  staleReport: boolean
  staleEvidence: boolean
  onRunAnalysis: () => void
  analyzing: boolean
  onShowPrompt: () => void
}) {
  const { toast } = useToast()
  const staleAnalysis = staleEvidence || staleReport

  return (
    <div className="space-y-4">
      {analysis ? (
        <>
          {staleAnalysis && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {staleReport && staleEvidence
                  ? 'The report and evidence changed after this analysis. '
                  : staleReport
                    ? 'The report was edited after this analysis. '
                    : 'New evidence was added after this analysis. '}
                <button onClick={onRunAnalysis} className="font-semibold underline">Re-run analysis</button> to incorporate it.
              </span>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-indigo" />AI Diagnosis</CardTitle>
              <div className="flex items-center gap-2">
                {analyses.length > 1 && (
                  <Select
                    value={String(analysisVersion)}
                    onChange={(e) => onVersionChange(Number(e.target.value))}
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
                <button onClick={onShowPrompt} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:bg-indigo/90">
                  <Terminal className="size-4" />Generate coding prompt
                </button>
                <button onClick={() => toast({ kind: 'success', title: 'Marked helpful', description: 'Feedback improves future analyses.' })} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                  <Check className="size-4" />Helpful
                </button>
                <button onClick={onRunAnalysis} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
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
            <button onClick={onRunAnalysis} disabled={analyzing} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:bg-indigo/90 disabled:opacity-60">
              {analyzing ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {analyzing ? 'Analyzing…' : 'Run AI Analysis'}
            </button>
          }
        />
      )}
    </div>
  )
}
