import { Bug as BugIcon, Info, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label, Select } from '@/components/ui/field'
import type { Category, Priority, Severity } from '@/lib/types'

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

type SubmitSidebarProps = {
  severity: Severity
  priority: Priority
  category: Category
  set: (key: 'severity' | 'priority' | 'category', value: Severity | Priority | Category) => void
  analyzeOnSubmit: boolean
  setAnalyzeOnSubmit: (value: boolean) => void
  submitting: boolean
  onSubmit: () => void
  onCancel: () => void
}

export function SubmitSidebar({
  severity,
  priority,
  category,
  set,
  analyzeOnSubmit,
  setAnalyzeOnSubmit,
  submitting,
  onSubmit,
  onCancel,
}: SubmitSidebarProps) {
  return (
    <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
      {/* Sidebar: classification + submit */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BugIcon className="size-4 text-muted-foreground" />Classification</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Severity</Label>
            <Select value={severity} onChange={(e) => set('severity', e.target.value as Severity)}>
              {severities.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onChange={(e) => set('priority', e.target.value as Priority)}>
              {priorities.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onChange={(e) => set('category', e.target.value as Category)}>
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
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzeOnSubmit ? <Sparkles className="size-4" /> : <BugIcon className="size-4" />}
            {analyzeOnSubmit ? 'Submit & Analyze' : 'Submit Bug'}
          </button>
          <button
            onClick={onCancel}
            className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
