import type { Dispatch, SetStateAction } from 'react'
import { Input, Label, Textarea, FieldHint, FieldError } from '@/components/ui/field'
import { TagInput } from '@/components/ui/tag-input'
import { StepShell } from './step-shell'
import type { Quality } from './types'

export function QualitySection({
  quality,
  setQuality,
  repoError,
  docsError,
}: {
  quality: Quality
  setQuality: Dispatch<SetStateAction<Quality>>
  repoError: string | null
  docsError: string | null
}) {
  return (
    <StepShell title="Quality & References" desc="Testing setup and helpful links.">
      <div><Label>Testing tools</Label><TagInput value={quality.testingTools} onChange={(v) => setQuality({ ...quality, testingTools: v })} placeholder="Postman, Pytest…" /></div>
      <div><Label>Testing frameworks</Label><TagInput value={quality.frameworks} onChange={(v) => setQuality({ ...quality, frameworks: v })} placeholder="Vitest, Playwright…" /></div>
      <div><Label>Coding conventions</Label><Textarea value={quality.conventions} onChange={(e) => setQuality({ ...quality, conventions: e.target.value })} /></div>
      <div><Label>Development constraints</Label><Textarea value={quality.constraints} onChange={(e) => setQuality({ ...quality, constraints: e.target.value })} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="repo-url">Repository URL (optional)</Label>
          <Input id="repo-url" value={quality.repoUrl} onChange={(e) => setQuality({ ...quality, repoUrl: e.target.value })} placeholder="https://github.com/…" aria-invalid={Boolean(repoError)} />
          <FieldHint>Leave empty if there is no repository.</FieldHint>
          <FieldError>{repoError}</FieldError>
        </div>
        <div>
          <Label htmlFor="docs-url">Documentation URL (optional)</Label>
          <Input id="docs-url" value={quality.docsUrl} onChange={(e) => setQuality({ ...quality, docsUrl: e.target.value })} placeholder="https://docs…" aria-invalid={Boolean(docsError)} />
          <FieldHint>Leave empty if there is no documentation yet.</FieldHint>
          <FieldError>{docsError}</FieldError>
        </div>
      </div>
    </StepShell>
  )
}
