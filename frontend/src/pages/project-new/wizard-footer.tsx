import { ArrowLeft, ArrowRight } from 'lucide-react'

export function WizardFooter({
  step,
  isEdit,
  submitting,
  onBack,
  onNext,
}: {
  step: number
  isEdit: boolean
  submitting: boolean
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"><ArrowLeft className="size-4" />Back</button>
      <button onClick={onNext} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:opacity-50">
        {step === 8 ? (isEdit ? 'Save Changes' : 'Create Project') : 'Continue'}
        {step !== 8 && <ArrowRight className="size-4" />}
      </button>
    </div>
  )
}
