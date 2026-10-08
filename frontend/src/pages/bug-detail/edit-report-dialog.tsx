import { createPortal } from 'react-dom'
import { AlertTriangle, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldHint, FieldError, Input, Label, Select, Textarea } from '@/components/ui/field'
import { RULES } from '@/lib/validation'
import type { Bug } from '@/lib/types'

const categoryOptions: Bug['category'][] = [
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

export interface EditReportForm {
  title: string
  description: string
  category: Bug['category']
  stepsToReproduce: string
  expectedResult: string
  actualResult: string
  environment: string
  browserDevice: string
}

export function EditReportDialog({
  bugRef,
  form,
  setForm,
  titleError,
  descriptionError,
  saving,
  onSave,
  onClose,
}: {
  bugRef: string
  form: EditReportForm
  setForm: React.Dispatch<React.SetStateAction<EditReportForm>>
  titleError: string | null
  descriptionError: string | null
  saving: boolean
  onSave: () => void
  onClose: () => void
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between !py-4">
            <CardTitle>Edit report - {bugRef}</CardTitle>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
              <X className="size-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Add anything you learned since filing - new error output, failed fix attempts, exact steps.
                The current AI analysis will be marked stale so you can re-run it with the updated report.
              </span>
            </div>
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  aria-invalid={Boolean(titleError)}
                />
                <FieldHint>At least {RULES.bugTitle.min} characters.</FieldHint>
                <FieldError>{titleError}</FieldError>
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  id="edit-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Bug['category'] }))}
                >
                  {categoryOptions.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="min-h-24"
                  aria-invalid={Boolean(descriptionError)}
                />
                <FieldHint>At least {RULES.bugDescription.min} characters - placeholder text blocks AI analysis.</FieldHint>
                <FieldError>{descriptionError}</FieldError>
              </div>
              <div>
                <Label htmlFor="edit-steps">Steps to reproduce</Label>
                <Textarea
                  id="edit-steps"
                  value={form.stepsToReproduce}
                  onChange={(e) => setForm((f) => ({ ...f, stepsToReproduce: e.target.value }))}
                  placeholder="One step per line."
                  className="min-h-24"
                />
                <FieldHint>One step per line. Numbered lists work best.</FieldHint>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit-expected">Expected result</Label>
                  <Textarea
                    id="edit-expected"
                    value={form.expectedResult}
                    onChange={(e) => setForm((f) => ({ ...f, expectedResult: e.target.value }))}
                    className="min-h-20"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-actual">Actual result</Label>
                  <Textarea
                    id="edit-actual"
                    value={form.actualResult}
                    onChange={(e) => setForm((f) => ({ ...f, actualResult: e.target.value }))}
                    placeholder="Include any new error text here."
                    className="min-h-20"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit-env">Environment</Label>
                  <Input
                    id="edit-env"
                    value={form.environment}
                    onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-browser">Browser / device</Label>
                  <Input
                    id="edit-browser"
                    value={form.browserDevice}
                    onChange={(e) => setForm((f) => ({ ...f, browserDevice: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:bg-indigo/90 disabled:opacity-60"
              >
                <Check className="size-4" />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>,
    document.body,
  )
}
