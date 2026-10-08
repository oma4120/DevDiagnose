import { FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select, Textarea, FieldHint, FieldError } from '@/components/ui/field'
import { RULES } from '@/lib/validation'
import type { Project } from '@/lib/types'

type DetailsCardProps = {
  visibleProjects: Project[]
  projectId: string
  title: string
  description: string
  set: (key: 'projectId' | 'title' | 'description', value: string) => void
  touched: boolean
  setTouched: (value: boolean) => void
  projectError: string | null
  titleError: string | null
  descriptionError: string | null
}

export function DetailsCard({
  visibleProjects,
  projectId,
  title,
  description,
  set,
  touched,
  setTouched,
  projectError,
  titleError,
  descriptionError,
}: DetailsCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" />Bug details</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="project">Project</Label>
          <Select id="project" value={projectId} onChange={(e) => set('projectId', e.target.value)}>
            {visibleProjects.length === 0 ? (
              <option value="" disabled>No accessible projects - ask an admin to add you to a team</option>
            ) : (
              visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
            )}
          </Select>
          <FieldHint>Determines which context the AI uses to diagnose this bug.</FieldHint>
          <FieldError>{touched ? projectError : null}</FieldError>
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => set('title', e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Checkout returns HTTP 500 when cart is empty"
            aria-invalid={Boolean(touched && titleError)}
          />
          <FieldHint>At least {RULES.bugTitle.min} characters. One clear sentence works best.</FieldHint>
          <FieldError>{touched ? titleError : null}</FieldError>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => set('description', e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="What is happening, where, and why it matters."
            aria-invalid={Boolean(touched && descriptionError)}
          />
          <FieldHint>
            At least {RULES.bugDescription.min} characters - the AI skips analysis of placeholder text.
          </FieldHint>
          <FieldError>{touched ? descriptionError : null}</FieldError>
        </div>
      </CardContent>
    </Card>
  )
}
