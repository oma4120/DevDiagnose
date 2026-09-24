import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useData } from '@/lib/data-context'

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-indigo' : 'bg-muted-foreground/30')}
      >
        <span className={cn('absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  )
}

export default function CompanyPage() {
  const { toast } = useToast()
  const { company, currentUser, hasQA, setHasQA } = useData()

  if (currentUser.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />
  }

  const save = () => toast({ kind: 'success', title: 'Company settings saved' })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Company" description="Manage your workspace details." />

      <Card>
        <CardHeader><CardTitle>Company details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Company details</h3>
            <p className="text-sm text-muted-foreground">Tell us about your organization.</p>
          </div>
          <div><Label htmlFor="cname">Company name</Label><Input id="cname" defaultValue={company.name} /></div>
          <div><Label htmlFor="ws">Workspace URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">devdiagnose.app/</span>
              <Input id="ws" defaultValue={company.workspace} className="flex-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="logo">Company logo (optional)</Label>
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-lg bg-cyan text-lg font-bold text-white">
                N
              </span>
              <button className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                Upload logo
              </button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-soft p-3">
            <div>
              <p className="text-sm font-medium">Does this company have QA employees?</p>
              <p className="text-xs text-muted-foreground">
                If disabled, DevDiagnose uses a developer-driven workflow with no QA validation
                stage.
              </p>
            </div>
            <Toggle checked={hasQA} onChange={() => setHasQA(!hasQA)} label="QA members" />
          </div>

          <div className="border-t border-border pt-4">
            <button
              onClick={save}
              className="inline-flex h-9 items-center rounded-lg bg-indigo px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
            >
              Save changes
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}