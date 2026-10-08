import type { Dispatch, SetStateAction } from 'react'
import { Info, Plus, Trash2 } from 'lucide-react'
import { Input, Textarea, FieldError } from '@/components/ui/field'
import { StepShell } from './step-shell'
import type { Rule } from './types'

export function RulesSection({
  rules,
  setRules,
  ruleError,
  onUpdateRule,
}: {
  rules: Rule[]
  setRules: Dispatch<SetStateAction<Rule[]>>
  ruleError: string | null
  onUpdateRule: (i: number, patch: Partial<Rule>) => void
}) {
  return (
    <StepShell title="Business Rules" desc="Domain rules the AI applies when diagnosing bugs.">
      <div className="flex items-start gap-2 rounded-lg border border-indigo/20 bg-accent/50 p-3 text-xs text-accent-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Project context will be used by the AI when analyzing bugs. Clear business rules improve diagnosis accuracy.
      </div>
      <div className="space-y-3">
        {rules.map((r, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Input value={r.title} onChange={(e) => onUpdateRule(i, { title: e.target.value })} placeholder="Rule title" className="flex-1 font-medium" aria-invalid={Boolean(r.title.length === 0 && ruleError)} />
              <button onClick={() => setRules((p) => p.filter((_, idx) => idx !== i))} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-error" aria-label="Remove rule"><Trash2 className="size-4" /></button>
            </div>
            {!r.title.trim() && <FieldError>{ruleError}</FieldError>}
            <Textarea value={r.description} onChange={(e) => onUpdateRule(i, { description: e.target.value })} placeholder="Describe the rule…" className="mt-2 min-h-16" />
          </div>
        ))}
      </div>
      <button onClick={() => setRules((p) => [...p, { title: '', description: '' }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:border-indigo hover:text-indigo"><Plus className="size-4" />Add rule</button>
    </StepShell>
  )
}
