import { Check } from 'lucide-react'
import DevDiagnoseLogo from '@/components/brand/DevDiagnoseLogo'
import { cn } from '@/lib/utils'

type InviteBrandPanelProps = {
  statusPill: { text: string; dot: string }
  stepIndex: number
  steps: string[]
}

export function InviteBrandPanel({ statusPill, stepIndex, steps }: InviteBrandPanelProps) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden bg-navy p-8 text-white lg:w-[46%] lg:p-12">
      <div className="tech-grid absolute inset-0 opacity-60" aria-hidden />
      <div
        className="login-orb absolute -right-28 -top-24 size-96 rounded-full bg-indigo/25 blur-3xl"
        style={{ animationDuration: '16s' }}
        aria-hidden
      />
      <div
        className="login-orb absolute -bottom-28 -left-16 size-80 rounded-full bg-cyan/15 blur-3xl"
        style={{ animationDuration: '22s', animationDelay: '-7s' }}
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy to-transparent" aria-hidden />

      <div className="relative flex items-center justify-between">
        <DevDiagnoseLogo light className="h-10 w-auto lg:h-12" />
        <span className="hidden items-center gap-1.5 font-mono text-[11px] text-slate-400 sm:flex">
          <span className={cn('size-1.5 animate-pulse rounded-full', statusPill.dot)} />
          {statusPill.text}
        </span>
      </div>

      <div className="relative mt-10 max-w-md">
        <h1 className="login-fade-up text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
          You&apos;ve been{' '}
          <span className="bg-gradient-to-r from-[#60A5FA] via-[#818CF8] to-[#A78BFA] bg-clip-text text-transparent">
            invited
          </span>
        </h1>
        <p className="login-fade-up mt-4 text-sm leading-relaxed text-slate-300" style={{ animationDelay: '0.1s' }}>
          Finish setting up your profile and you&apos;ll be ready to log in and start
          working on bugs with your team.
        </p>

        {/* Onboarding steps - highlights progress live */}
        <div
          className="login-fade-up mt-8 hidden rounded-xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-2xl backdrop-blur sm:block"
          style={{ animationDelay: '0.25s' }}
        >
          <p className="font-mono text-[11px] text-slate-500">// onboarding</p>
          <ol className="mt-3 space-y-3">
            {steps.map((label, i) => {
              const done = i < stepIndex
              const active = i === stepIndex
              return (
                <li key={label} className="relative flex items-center gap-3 text-sm">
                  {i < steps.length - 1 && (
                    <span className="absolute -bottom-3 left-[10px] top-[26px] w-px bg-slate-700" aria-hidden />
                  )}
                  <span
                    className={cn(
                      'flex size-[22px] shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                      done && 'border-success/40 bg-success/15 text-success',
                      active && 'border-indigo bg-indigo text-white shadow-[0_0_0_3px_rgba(99,102,241,0.25)]',
                      !done && !active && 'border-slate-700 bg-slate-800 text-slate-400',
                    )}
                  >
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      done && 'text-slate-300',
                      active && 'font-medium text-white',
                      !done && !active && 'text-slate-500',
                    )}
                  >
                    {label}
                  </span>
                  {active && (
                    <span className="ml-auto animate-pulse font-mono text-[10px] uppercase tracking-wider text-indigo">
                      current
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="login-fade-up mt-8 flex flex-wrap gap-2" style={{ animationDelay: '0.4s' }}>
          {['Evidence-driven', 'Project-aware AI', 'Workflow tracking'].map((t) => (
            <span
              key={t}
              className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-200"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <p className="relative mt-10 font-mono text-xs text-slate-500">Internal engineering platform</p>
    </div>
  )
}
