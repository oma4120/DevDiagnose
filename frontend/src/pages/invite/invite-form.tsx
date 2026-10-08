import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Loader2, Lock, X } from 'lucide-react'
import { Input, Label } from '@/components/ui/field'
import { cn } from '@/lib/utils'

type InviteFormProps = {
  saving: boolean
  email: string
  error: string | null
  firstName: string
  lastName: string
  password: string
  confirm: string
  showPassword: boolean
  showConfirm: boolean
  passwordRules: { label: string; ok: boolean }[]
  rulesOk: boolean
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmChange: (value: string) => void
  onToggleShowPassword: () => void
  onToggleShowConfirm: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function InviteForm({
  saving,
  email,
  error,
  firstName,
  lastName,
  password,
  confirm,
  showPassword,
  showConfirm,
  passwordRules,
  rulesOk,
  onFirstNameChange,
  onLastNameChange,
  onPasswordChange,
  onConfirmChange,
  onToggleShowPassword,
  onToggleShowConfirm,
  onSubmit,
}: InviteFormProps) {
  return (
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

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="first">First name</Label>
            <Input
              id="first"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
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
              onChange={(e) => onLastNameChange(e.target.value)}
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
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Create a password"
              className="pl-8 pr-9"
            />
            <button
              type="button"
              onClick={onToggleShowPassword}
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
              onChange={(e) => onConfirmChange(e.target.value)}
              placeholder="Repeat password"
              className="pl-8 pr-9"
            />
            <button
              type="button"
              onClick={onToggleShowConfirm}
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
          disabled={saving || !rulesOk}
          className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo to-brand-blue text-sm font-semibold text-white shadow-lg shadow-indigo/25 transition-all hover:shadow-xl hover:shadow-indigo/30 disabled:opacity-60"
        >
          {saving ? (
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
  )
}
