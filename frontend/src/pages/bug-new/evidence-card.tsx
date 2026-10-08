import { useRef, type Dispatch, type SetStateAction } from 'react'
import { Code2, Image as ImageIcon, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select, Textarea, MonoTextarea } from '@/components/ui/field'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { checkImageDataUrl } from '@/lib/validation'
import type { EvidenceType } from '@/lib/types'

const evidenceTypes: EvidenceType[] = [
  'Screenshot',
  'Console Error',
  'API Response',
  'Server Log',
  'Stack Trace',
  'Relevant Code',
  'Network Request',
  'Other',
]

export interface EvidenceDraft {
  id: number
  type: EvidenceType
  title: string
  content: string
  fileUrl?: string
}

const codeLikeTypes: EvidenceType[] = ['Console Error', 'API Response', 'Server Log', 'Stack Trace', 'Relevant Code']

/** Reads an image file and downscales it to a JPEG data URL (display-only storage). */
function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Only image files are supported'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Image must be smaller than 8 MB'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(img.width, img.height))
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
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

type EvidenceCardProps = {
  evidence: EvidenceDraft[]
  setEvidence: Dispatch<SetStateAction<EvidenceDraft[]>>
  draft: { type: EvidenceType; title: string; content: string; fileUrl?: string }
  setDraft: Dispatch<SetStateAction<{ type: EvidenceType; title: string; content: string; fileUrl?: string }>>
}

export function EvidenceCard({ evidence, setEvidence, draft, setDraft }: EvidenceCardProps) {
  const { toast } = useToast()
  const imageRef = useRef<HTMLInputElement>(null)
  const isScreenshot = draft.type === 'Screenshot'
  const isCodeLike = codeLikeTypes.includes(draft.type)

  const pickScreenshot = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await readImageFile(file)
      // Check the encoded length here rather than discovering it as a 422 after
      // the whole report has been submitted.
      const sizeError = checkImageDataUrl(dataUrl, 'Screenshot')
      if (sizeError) {
        toast({ kind: 'error', title: 'Image too large', description: sizeError })
        return
      }
      setDraft((d) => ({ ...d, fileUrl: dataUrl }))
    } catch (err) {
      toast({ kind: 'error', title: 'Could not attach image', description: err instanceof Error ? err.message : undefined })
    }
  }

  const addEvidence = () => {
    if (isScreenshot) {
      if (!draft.fileUrl) {
        toast({ kind: 'warning', title: 'No image selected', description: 'Choose a screenshot image before attaching.' })
        return
      }
      setEvidence((e) => [...e, { id: Date.now(), ...draft, title: draft.title.trim() || draft.type }])
      setDraft({ type: draft.type, title: '', content: '', fileUrl: undefined })
      toast({ kind: 'success', title: 'Screenshot attached', description: 'Shown for display only - the AI will not analyze it.' })
      return
    }
    if (!draft.content.trim()) {
      toast({ kind: 'warning', title: 'Nothing to attach', description: 'Add some content before attaching evidence.' })
      return
    }
    setEvidence((e) => [...e, { id: Date.now(), ...draft, title: draft.title.trim() || draft.type }])
    setDraft({ type: draft.type, title: '', content: '', fileUrl: undefined })
    toast({ kind: 'success', title: 'Evidence attached', description: 'The AI will consider it during analysis.' })
  }

  const removeEvidence = (id: number) => setEvidence((e) => e.filter((x) => x.id !== id))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Paperclip className="size-4 text-muted-foreground" />Evidence</CardTitle>
        <span className="text-xs text-muted-foreground">{evidence.length} attached</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {evidence.length > 0 && (
          <ul className="space-y-2">
            {evidence.map((e) => (
              <li key={e.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                {e.fileUrl ? (
                  <img src={e.fileUrl} alt="" className="mt-0.5 size-10 shrink-0 rounded-md border border-border object-cover" />
                ) : (
                  <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md', codeLikeTypes.includes(e.type) ? 'bg-navy text-slate-100' : 'bg-accent text-accent-foreground')}>
                    {codeLikeTypes.includes(e.type) ? <Code2 className="size-4" /> : <Paperclip className="size-4" />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{e.title}</span>
                    <span className="rounded-md bg-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{e.type}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 font-mono text-xs text-muted-foreground">
                    {e.fileUrl ? 'Display only - not analyzed by the AI' : e.content}
                  </p>
                </div>
                <button onClick={() => removeEvidence(e.id)} className="rounded-md p-1 text-muted-foreground hover:text-error" aria-label="Remove evidence"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg border border-dashed border-border p-3">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div>
              <Label>Type</Label>
              <Select
                value={draft.type}
                onChange={(e) => setDraft({ type: e.target.value as EvidenceType, title: draft.title, content: draft.content, fileUrl: undefined })}
              >
                {evidenceTypes.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <Label>Label</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Server traceback" />
            </div>
          </div>
          <div className="mt-3">
            <Label>{isScreenshot ? 'Image' : 'Content'}</Label>
            {isScreenshot ? (
              <div className="space-y-2">
                {draft.fileUrl ? (
                  <div className="flex items-start gap-3">
                    <img src={draft.fileUrl} alt="Screenshot preview" className="max-h-44 rounded-lg border border-border object-contain" />
                    <div className="space-y-1">
                      <button type="button" onClick={() => imageRef.current?.click()} className="block text-xs font-medium text-indigo hover:underline">
                        Replace image
                      </button>
                      <button type="button" onClick={() => setDraft((d) => ({ ...d, fileUrl: undefined }))} className="block text-xs font-medium text-error hover:underline">
                        Remove image
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground hover:border-indigo/40 hover:text-indigo"
                  >
                    <ImageIcon className="size-4" />Choose image…
                  </button>
                )}
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void pickScreenshot(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  PNG or JPG, auto-resized. Display only - not sent to the AI analysis.
                </p>
              </div>
            ) : isCodeLike ? (
              <MonoTextarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="Paste the log, trace, response, or code snippet…" />
            ) : (
              <Textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="Describe or paste the evidence…" />
            )}
          </div>
          <button onClick={addEvidence} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
            <Plus className="size-4" />Attach evidence
          </button>
        </div>

        {evidence.length === 0 && (
          <EmptyState icon={Paperclip} title="No evidence yet" description="Logs, stack traces, API responses, and code make AI diagnosis far more accurate." className="border-0 py-6" />
        )}
      </CardContent>
    </Card>
  )
}
