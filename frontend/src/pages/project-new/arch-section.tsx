import type { Dispatch, SetStateAction } from 'react'
import { Input, Label, Textarea } from '@/components/ui/field'
import { TagInput } from '@/components/ui/tag-input'
import { StepShell } from './step-shell'
import type { Architecture } from './types'

export function ArchSection({
  arch,
  setArch,
}: {
  arch: Architecture
  setArch: Dispatch<SetStateAction<Architecture>>
}) {
  return (
    <StepShell title="Architecture" desc="High-level structure the AI considers.">
      <div><Label>Main architecture style</Label><Input value={arch.style} onChange={(e) => setArch({ ...arch, style: e.target.value })} /></div>
      <div><Label>Important modules / features</Label><TagInput value={arch.modules} onChange={(v) => setArch({ ...arch, modules: v })} placeholder="Add a module…" /></div>
      <div><Label>API patterns</Label><Textarea value={arch.apiPatterns} onChange={(e) => setArch({ ...arch, apiPatterns: e.target.value })} /></div>
    </StepShell>
  )
}
