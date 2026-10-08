import type { Dispatch, SetStateAction } from 'react'
import { Label } from '@/components/ui/field'
import { TagInput } from '@/components/ui/tag-input'
import { StepShell } from './step-shell'
import type { TechStack } from './types'

export function StackSection({
  tech,
  setTech,
}: {
  tech: TechStack
  setTech: Dispatch<SetStateAction<TechStack>>
}) {
  return (
    <StepShell title="Technology" desc="Structured tech stack the AI reasons about.">
      {([
        ['Frontend technologies', 'frontend'],
        ['Backend technologies', 'backend'],
        ['Database', 'database'],
        ['APIs / Services', 'services'],
        ['Authentication', 'auth'],
        ['Deployment', 'deployment'],
      ] as const).map(([label, key]) => (
        <div key={key}>
          <Label>{label}</Label>
          <TagInput value={tech[key]} onChange={(v) => setTech({ ...tech, [key]: v })} placeholder="Add a technology…" />
        </div>
      ))}
    </StepShell>
  )
}
