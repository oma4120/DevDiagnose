import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Activity, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Input, Label } from '@/components/ui/field'

export default function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => navigate('/dashboard'), 600)
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left — brand panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-navy p-8 text-white lg:w-[46%] lg:p-12">
        <div className="tech-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-indigo/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-cyan/10 blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo">
            <Activity className="size-4.5" />
          </span>
          <span className="text-base font-semibold tracking-tight">DevDiagnose</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
            Turn bug reports into actionable fixes.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            AI-powered bug analysis grounded in your project&apos;s real business and technical
            context — from evidence to diagnosis to a validated resolution.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
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

        <p className="relative font-mono text-xs text-slate-500">
          Internal engineering platform · Northwind Labs
        </p>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back. Sign in to your workspace.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  defaultValue="omar@northwind.dev"
                  placeholder="you@company.com"
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/login" className="text-xs font-medium text-indigo hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  defaultValue="password"
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
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                defaultChecked
                className="size-4 rounded border-input text-indigo focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              Remember me for 30 days
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight className="size-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New company?{' '}
            <Link to="/onboarding" className="font-medium text-indigo hover:underline">
              Set up a workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}