import type { Dispatch, SetStateAction } from 'react'
import { Input, Label, Select, Textarea, FieldHint, FieldError } from '@/components/ui/field'
import { StepShell } from './step-shell'
import type { BasicInfo } from './types'

export function BasicInfoSection({
  basic,
  setBasic,
  nameError,
}: {
  basic: BasicInfo
  setBasic: Dispatch<SetStateAction<BasicInfo>>
  nameError: string | null
}) {
  return (
    <StepShell title="Basic Information" desc="Identify the project and its purpose.">
      <div><Label htmlFor="project-name">Project name</Label><Input id="project-name" value={basic.name} onChange={(e) => setBasic({ ...basic, name: e.target.value })} aria-invalid={Boolean(nameError)} /><FieldHint>At least 2 characters - shown everywhere in the app.</FieldHint><FieldError>{nameError}</FieldError></div>
      <div><Label>Brief description</Label><Textarea value={basic.description} onChange={(e) => setBasic({ ...basic, description: e.target.value })} /></div>
      <div><Label>Project purpose</Label><Textarea value={basic.purpose} onChange={(e) => setBasic({ ...basic, purpose: e.target.value })} /><FieldHint>What problem does this project solve? The AI uses this for context.</FieldHint></div>
      <div><Label>Project type</Label>
        <Select value={basic.type} onChange={(e) => setBasic({ ...basic, type: e.target.value })}>
          <option>Web Application</option><option>Mobile Application</option><option>API / Backend</option><option>Desktop Application</option><option>Other</option>
        </Select>
      </div>
    </StepShell>
  )
}
