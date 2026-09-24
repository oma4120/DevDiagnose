import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react'
import { Input, Label } from '@/components/ui/field'
import DevDiagnoseLogo from '@/components/brand/DevDiagnoseLogo'
import { api } from '@/lib/api'
import { useData } from '@/lib/data-context'

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password needs at least one uppercase letter.')
      return
    }
    if (!/\d/.test(password)) {
      setError('Password needs at least one number.')
      return
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setError('Password needs at least one symbol (e.g. !@#$).')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setPhase('saving')
    try {
      await api.invites.accept({ token, firstName, lastName, password })
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete setup')
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

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="relative flex flex-col justify-between overflow-hidden bg-navy p-8 text-white lg:w-[46%] lg:p-12">
        <div className="tech-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-indigo/20 blur-3xl" aria-hidden />
        <div className="relative flex items-center">
          <DevDiagnoseLogo light className="h-12 w-auto" />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
            You've been invited
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Finish setting up your profile and you'll be ready to log in and start
            working on bugs with your team.
          </p>
        </div>
        <p className="relative font-mono text-xs text-slate-500">Internal engineering platform</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {phase === 'loading' && (
            <p className="text-sm text-muted-foreground">Checking your invitation…</p>
          )}

          {phase === 'invalid' && (
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Invitation unavailable</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This link is invalid or has already been used. Ask an admin to invite you again.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
              >
                Go to sign in
                <ArrowRight className="size-4" />
              </Link>
            </div>
          )}

          {(phase === 'ready' || phase === 'saving') && (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Set up your profile</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Completing this for <span className="font-medium text-foreground">{email}</span>. Your
                  sign-in will use this email and the password below.
                </p>
              </div>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="first">First name</Label>
                    <Input id="first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ada" />
                  </div>
                  <div>
                    <Label htmlFor="last">Last name</Label>
                    <Input id="last" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Lovelace" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8+ chars, 1 uppercase, 1 number, 1 symbol"
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

                <button
                  type="submit"
                  disabled={phase === 'saving'}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:opacity-60"
                >
                  {phase === 'saving' ? 'Creating your account…' : 'Create account'}
                  {phase !== 'saving' && <ArrowRight className="size-4" />}
                </button>
              </form>
            </div>
          )}

          {phase === 'done' && (
            <div>
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="size-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">You're all set!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your profile is ready. You'll be redirected to the sign-in page — log in with{' '}
                <span className="font-medium text-foreground">{email}</span> and the password you just set.
              </p>
              <button
                onClick={goToLogin}
                className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
              >
                Go to sign in
                <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}