import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { useData } from '@/lib/data-context'
import { errorMessage } from '@/lib/validation'
import { InviteBrandPanel } from './invite/invite-brand-panel'
import { InviteForm } from './invite/invite-form'
import { InviteDone, InviteInvalid, InviteLoading } from './invite/invite-status'

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

  const goToLogin = async () => {
    await logout()
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
      <InviteBrandPanel statusPill={statusPill} stepIndex={stepIndex} steps={steps} />

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

            {phase === 'loading' && <InviteLoading />}

            {phase === 'invalid' && <InviteInvalid />}

            {(phase === 'ready' || phase === 'saving') && (
              <InviteForm
                saving={phase === 'saving'}
                email={email}
                error={error}
                firstName={firstName}
                lastName={lastName}
                password={password}
                confirm={confirm}
                showPassword={showPassword}
                showConfirm={showConfirm}
                passwordRules={passwordRules}
                rulesOk={rulesOk}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onPasswordChange={setPassword}
                onConfirmChange={setConfirm}
                onToggleShowPassword={() => setShowPassword((v) => !v)}
                onToggleShowConfirm={() => setShowConfirm((v) => !v)}
                onSubmit={submit}
              />
            )}

            {phase === 'done' && <InviteDone email={email} onGoToLogin={goToLogin} />}
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
