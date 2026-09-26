import { Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { Input, Label } from '@/components/ui/field'
import DevDiagnoseLogo from '@/components/brand/DevDiagnoseLogo'
import { useData } from '@/lib/data-context'
import { checkEmail, errorMessage } from '@/lib/validation'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, company } = useData()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [forgotHint, setForgotHint] = useState(false)
  // Chrome's password manager ignores autocomplete="off" on credential fields,
  // but it skips readonly inputs at load time and never fills "new-password"
  // fields with saved credentials - so each field unlocks only when focused.
  const [emailReady, setEmailReady] = useState(false)
  const [passwordReady, setPasswordReady] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const emailError = checkEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(errorMessage(err, 'Sign in failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left - brand panel with a live diagnosis console */}
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
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            AI engine online
          </span>
        </div>

        <div className="relative mt-10 max-w-md">
          <h1 className="login-fade-up text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
            Turn bug reports into{' '}
            <span className="bg-gradient-to-r from-[#60A5FA] via-[#818CF8] to-[#A78BFA] bg-clip-text text-transparent">
              actionable fixes
            </span>
          </h1>
          <p className="login-fade-up mt-4 text-sm leading-relaxed text-slate-300" style={{ animationDelay: '0.1s' }}>
            AI-powered bug analysis grounded in your project&apos;s real business and technical
            context - from evidence to diagnosis to a validated resolution.
          </p>

          {/* Diagnosis console - loops through a real-looking analysis run */}
          <div
            className="login-fade-up mt-8 hidden overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/70 shadow-2xl backdrop-blur sm:block"
            style={{ animationDelay: '0.25s' }}
          >
            <div className="flex items-center gap-1.5 border-b border-slate-700/70 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 truncate font-mono text-[11px] text-slate-400">
                devdiagnose analyze BUG-1042
              </span>
            </div>
            <div className="space-y-2 px-4 py-4 font-mono text-[12.5px] leading-relaxed">
              <p className="console-line console-l1 text-slate-300">
                <span className="text-cyan">▸</span> reproducing - 3 steps mapped{' '}
                <span className="text-slate-500">ok</span>
              </p>
              <p className="console-line console-l2 text-slate-300">
                <span className="text-cyan">▸</span> evidence - 4 analyzed · 1 screenshot skipped
              </p>
              <p className="console-line console-l3 text-slate-200">
                <span className="text-success">✓</span> root cause - reduce() on empty iterable{' '}
                <span className="text-slate-500">pricing.py:22</span>
              </p>
              <p className="console-line console-l4 text-slate-200">
                <span className="text-indigo">✓</span> fix ready - patch + tests proposed{' '}
                <span className="font-semibold text-indigo">92%</span>
              </p>
              <p className="console-line console-l5 text-slate-500">
                $ <span className="console-caret text-indigo">▊</span>
              </p>
            </div>
            <div className="h-0.5 w-full bg-slate-800">
              <div className="console-progress h-full w-full bg-gradient-to-r from-indigo via-brand-blue to-cyan" />
            </div>
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

        <p className="relative mt-10 font-mono text-xs text-slate-500">
          Internal engineering platform
        </p>
      </div>

      {/* Right - sign-in card */}
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

            <p className="font-mono text-[11px] tracking-wider text-indigo">// session.start()</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to continue to your workspace.
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

            <form onSubmit={submit} className="mt-6 space-y-4" autoComplete="off">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    name="dd-email"
                    autoComplete="off"
                    readOnly={!emailReady}
                    onFocus={() => setEmailReady(true)}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setForgotHint((v) => !v)}
                    className="text-xs font-medium text-indigo hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="dd-password"
                    autoComplete="new-password"
                    readOnly={!passwordReady}
                    onFocus={() => setPasswordReady(true)}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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
                {forgotHint && (
                  <p className="login-fade-up mt-1.5 text-xs text-muted-foreground">
                    Ask your workspace admin to reset it for you.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo to-brand-blue text-sm font-semibold text-white shadow-lg shadow-indigo/25 transition-all hover:shadow-xl hover:shadow-indigo/30 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="login-fade-up mt-5 text-center text-xs text-muted-foreground" style={{ animationDelay: '0.15s' }}>
            Don&apos;t have an account? Ask your workspace admin for an invite.
          </p>
          <p
            className="login-fade-up mt-2 text-center font-mono text-[11px] text-muted-foreground/70"
            style={{ animationDelay: '0.25s' }}
          >
            workspace: {company.workspace}
          </p>
        </div>
      </div>
    </div>
  )
}
