import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  X,
} from 'lucide-react'
import { Input, Label } from '@/components/ui/field'
import DevDiagnoseLogo from '@/components/brand/DevDiagnoseLogo'
import { api } from '@/lib/api'
import { useData } from '@/lib/data-context'
import { errorMessage } from '@/lib/validation'
import { cn } from '@/lib/utils'

type Phase = 'loading' | 'invalid' | 'ready' | 'saving' | 'done'

export default function InvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { logout } = useData()

  const [phase, setPhase] = useState<Phase>('loading')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    let alive = true
    api.invites
      .get(token)
      .then((info) => {
        if (!alive) return
        setEmail(info.email)
        const parts = (info.name || '').trim().split(/\s+/)
        setFirstName(parts[0] || '')
        setLastName(parts.slice(1).join(' '))
        setPhase('ready')
      })
      .catch(() => {
        if (alive) setPhase('invalid')
      })
    return () => {
      alive = false
    }
  }, [token])

  const passwordRules = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'One number', ok: /\d/.test(password) },
    { label: 'One symbol (!@#$)', ok: /[^A-Za-z0-9]/.test(password) },
    { label: 'Passwords match', ok: confirm.length > 0 && password === confirm },
  ]
  const rulesOk = passwordRules.every((r) => r.ok)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.')
      return
    }
    if (!rulesOk) {
      setError('Make sure every password rule is checked.')
      return
    }
    setPhase('saving')
    try {
      await api.invites.accept({ token, firstName: firstName.trim(), lastName: lastName.trim(), password })
      setPhase('done')
    } catch (err) {
      setError(errorMessage(err, 'Could not complete setup'))
      setPhase('ready')
    }
  }

  const goToLogin = () => {
    logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (phase !== 'done') return
    const timer = setTimeout(goToLogin, 2500)
    return () => clearTimeout(timer)
  }, [phase, navigate, logout])

  const stepIndex = phase === 'done' ? 2 : 1
  const steps = ['Invited by your admin', 'Set up your profile', 'Sign in and start fixing bugs']

  const statusPill =
    phase === 'loading'
      ? { text: 'checking invite…', dot: 'bg-warning' }
      : phase === 'invalid'
        ? { text: 'link invalid', dot: 'bg-error' }
        : { text: 'invite verified', dot: 'bg-success' }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left - brand panel with onboarding steps */}
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

      {/* Right - setup card */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-6 sm:p-10">
        <div
          className="login-orb absolute -left-24 top-8 size-72 rounded-full bg-indigo/10 blur-3xl"
          style={{ animationDuration: '18s' }}
          aria-hidden
        />
        <div
          className="login-orb absolute -right-16 bottom-0 size-64 rounded-full bg-cyan/10 blur-3xl"
          style={{ animationDuration: '24s', animationDelay: '-9s' }}
          aria-hidden
        />

        <div className="relative w-full max-w-sm">
          <div className="login-fade-up relative overflow-hidden rounded-2xl border border-border bg-card/80 p-7 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.3)] backdrop-blur sm:p-8">
            <div
              className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo via-brand-blue to-cyan"
              aria-hidden
            />

            {phase === 'loading' && (
              <div className="py-6">
                <p className="font-mono text-[11px] tracking-wider text-indigo">// invite.check()</p>
                <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-indigo" />
                  Checking your invitation…
                </div>
              </div>
            )}

            {phase === 'invalid' && (
              <div>
                <p className="font-mono text-[11px] tracking-wider text-destructive">// invite.invalid()</p>
                <div className="mt-4 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="size-5" />
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                  Invitation unavailable
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  This link is invalid or has already been used. Ask an admin to invite you again.
                </p>
                <Link
                  to="/login"
                  className="group mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo to-brand-blue text-sm font-semibold text-white shadow-lg shadow-indigo/25 transition-all hover:shadow-xl hover:shadow-indigo/30"
                >
                  Go to sign in
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            )}

            {(phase === 'ready' || phase === 'saving') && (
              <div>
                <p className="font-mono text-[11px] tracking-wider text-indigo">// profile.setup()</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Set up your profile
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Completing this for <span className="font-medium text-foreground">{email}</span>. Your
                  sign-in will use this email and the password below.
                </p>

                {error && (
                  <div
                    key={error}
                    role="alert"
                    className="login-shake mt-5 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="first">First name</Label>
                      <Input
                        id="first"
                        required
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Ada"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last">Last name</Label>
                      <Input
                        id="last"
                        required
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Lovelace"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a password"
                        className="pl-8 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-2 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirm">Confirm password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="confirm"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat password"
                        className="pl-8 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-2 top-2 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Live rules checklist */}
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-border bg-soft/60 p-3">
                    {passwordRules.map((r) => (
                      <li
                        key={r.label}
                        className={cn(
                          'flex items-center gap-1.5 text-xs transition-colors',
                          r.ok ? 'text-success' : 'text-muted-foreground',
                        )}
                      >
                        {r.ok ? (
                          <Check className="size-3.5 shrink-0" />
                        ) : (
                          <X className="size-3.5 shrink-0 opacity-60" />
                        )}
                        {r.label}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="submit"
                    disabled={phase === 'saving' || !rulesOk}
                    className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo to-brand-blue text-sm font-semibold text-white shadow-lg shadow-indigo/25 transition-all hover:shadow-xl hover:shadow-indigo/30 disabled:opacity-60"
                  >
                    {phase === 'saving' ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating your account…
                      </>
                    ) : (
                      <>
                        Create account
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {phase === 'done' && (
              <div className="py-2 text-center">
                <div className="login-pop mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="size-7" />
                </div>
                <p className="mt-4 font-mono text-[11px] tracking-wider text-success">// account.ready()</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  You&apos;re all set!
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your profile is ready. You&apos;ll be redirected to the sign-in page - log in with{' '}
                  <span className="font-medium text-foreground">{email}</span> and the password you
                  just set.
                </p>
                <button
                  onClick={goToLogin}
                  className="group mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo to-brand-blue text-sm font-semibold text-white shadow-lg shadow-indigo/25 transition-all hover:shadow-xl hover:shadow-indigo/30"
                >
                  Go to sign in
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            )}
          </div>

          <p
            className="login-fade-up mt-5 text-center font-mono text-[11px] text-muted-foreground/70"
            style={{ animationDelay: '0.15s' }}
          >
            secure invite · single use · expires after setup
          </p>
        </div>
      </div>
    </div>
  )
}
