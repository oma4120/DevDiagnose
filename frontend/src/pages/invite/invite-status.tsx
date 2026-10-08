import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export function InviteLoading() {
  return (
    <div className="py-6">
      <p className="font-mono text-[11px] tracking-wider text-indigo">// invite.check()</p>
      <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-indigo" />
        Checking your invitation…
      </div>
    </div>
  )
}

export function InviteInvalid() {
  return (
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
  )
}

export function InviteDone({ email, onGoToLogin }: { email: string; onGoToLogin: () => void }) {
  return (
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
        onClick={onGoToLogin}
        className="group mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo to-brand-blue text-sm font-semibold text-white shadow-lg shadow-indigo/25 transition-all hover:shadow-xl hover:shadow-indigo/30"
      >
        Go to sign in
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  )
}
