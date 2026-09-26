import { useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ImagePlus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, FieldHint, FieldError } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useData } from '@/lib/data-context'
import { checkCompanyName, checkWorkspace, errorMessage } from '@/lib/validation'

const MAX_LOGO_BYTES = 1_500_000

function fileToDataUrl(file: File, max = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Image must be smaller than 8 MB'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

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
  const { company, currentUser, hasQA, setHasQA, updateCompany } = useData()
  const [name, setName] = useState(company.name)
  const [workspace, setWorkspace] = useState(company.workspace)
  const [logo, setLogo] = useState<string | null>(company.logo ?? null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (currentUser.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />
  }

  const pickLogo = () => fileRef.current?.click()

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await fileToDataUrl(file)
      if (dataUrl.length > MAX_LOGO_BYTES) {
        toast({ kind: 'error', title: 'Logo too large', description: 'Pick a smaller image (it is resized to 512px, but this one is still too big).' })
        return
      }
      setLogo(dataUrl)
      toast({ kind: 'info', title: 'Logo selected', description: 'Click "Save changes" to apply it.' })
    } catch (err) {
      toast({ kind: 'error', title: 'Upload failed', description: err instanceof Error ? err.message : 'Could not read that image.' })
    }
  }

  const nameError = checkCompanyName(name)
  const workspaceError = checkWorkspace(workspace)

  const save = async () => {
    if (nameError || workspaceError) {
      toast({
        kind: 'error',
        title: 'Check the highlighted fields',
        description: nameError ?? workspaceError ?? undefined,
      })
      return
    }
    setSaving(true)
    try {
      await updateCompany({ name, workspace, hasQA, logo })
      toast({ kind: 'success', title: 'Company settings saved' })
    } catch (err) {
      toast({ kind: 'error', title: 'Save failed', description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

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
          <div><Label htmlFor="cname">Company name</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(nameError)} />
            <FieldHint>At least 2 characters.</FieldHint>
            <FieldError>{nameError}</FieldError>
          </div>
          <div><Label htmlFor="ws">Workspace URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">devdiagnose.app/</span>
              <Input id="ws" value={workspace} onChange={(e) => setWorkspace(e.target.value)} className="flex-1" aria-invalid={Boolean(workspaceError)} />
            </div>
            <FieldHint>Lowercase letters, numbers and hyphens only - e.g. northwind.</FieldHint>
            <FieldError>{workspaceError}</FieldError>
          </div>
          <div>
            <Label htmlFor="logo">Company logo (optional)</Label>
            <div className="flex items-center gap-3">
              {logo ? (
                <img
                  src={logo}
                  alt="Company logo"
                  className="size-12 rounded-lg border border-border bg-card object-contain"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-lg bg-cyan text-lg font-bold text-white">
                  {(name || company.name || '?')[0].toUpperCase()}
                </span>
              )}
              <input
                ref={fileRef}
                id="logo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogoFile}
              />
              <button
                type="button"
                onClick={pickLogo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <ImagePlus className="size-4" />
                {logo ? 'Replace logo' : 'Upload logo'}
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-destructive hover:bg-muted"
                >
                  <Trash2 className="size-4" />
                  Remove
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">PNG or JPG, automatically resized to 512px. Shown in the sidebar workspace switcher.</p>
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
              disabled={saving}
              className="inline-flex h-9 items-center rounded-lg bg-indigo px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}