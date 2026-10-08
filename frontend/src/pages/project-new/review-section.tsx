import { Sparkles } from 'lucide-react'
import { Chip } from '@/components/badges'
import type { Member } from '@/lib/types'
import { StepShell } from './step-shell'
import type { BasicInfo, TechStack, Architecture, Rule } from './types'

export function ReviewSection({
  isEdit,
  basic,
  tech,
  arch,
  rules,
  teamMembers,
}: {
  isEdit: boolean
  basic: BasicInfo
  tech: TechStack
  arch: Architecture
  rules: Rule[]
  teamMembers: Member[]
}) {
  return (
    <StepShell title="Review" desc={isEdit ? 'Confirm the project context before saving.' : 'Confirm the project context before creating.'}>
      <div className="space-y-3">
        <ReviewRow label="Name" value={basic.name} />
        <ReviewRow label="Type" value={basic.type} />
        <ReviewRow label="Description" value={basic.description} />
        <ReviewRow label="Purpose" value={basic.purpose} />
        <ReviewChips label="Frontend" items={tech.frontend} />
        <ReviewChips label="Backend" items={tech.backend} />
        <ReviewChips label="Database" items={tech.database} />
        <ReviewChips label="Auth" items={tech.auth} />
        <ReviewRow label="Team" value={teamMembers.map((m) => `${m.name} (${m.role})`).join(', ')} />
        <ReviewRow label="Architecture" value={arch.style} />
        <ReviewChips label="Modules" items={arch.modules} />
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business rules</p>
          <ul className="mt-1.5 space-y-1">
            {rules.map((r, i) => (
              <li key={i} className="text-sm text-foreground">
                <span className="font-medium">{r.title || 'Untitled rule'}</span>
                {r.description && <span className="text-muted-foreground"> - {r.description}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-indigo/20 bg-accent/50 p-3 text-xs text-accent-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" />
          This full context becomes the AI&apos;s knowledge base for every bug in this project.
        </div>
      </div>
    </StepShell>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-border pb-2 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || '-'}</span>
    </div>
  )
}

function ReviewChips({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-border pb-2 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="flex flex-wrap gap-1">{items.length ? items.map((t) => <Chip key={t}>{t}</Chip>) : '-'}</span>
    </div>
  )
}
