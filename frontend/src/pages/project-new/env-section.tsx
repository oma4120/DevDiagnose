import type { Dispatch, SetStateAction } from 'react'
import { Input, Label } from '@/components/ui/field'
import { TagInput } from '@/components/ui/tag-input'
import { StepShell } from './step-shell'
import type { Environments } from './types'

export function EnvSection({
  env,
  setEnv,
}: {
  env: Environments
  setEnv: Dispatch<SetStateAction<Environments>>
}) {
  return (
    <StepShell title="Environment" desc="Where the project runs and is tested.">
      <div><Label>Development environment</Label><Input value={env.development} onChange={(e) => setEnv({ ...env, development: e.target.value })} /></div>
      <div><Label>Staging environment</Label><Input value={env.staging} onChange={(e) => setEnv({ ...env, staging: e.target.value })} /></div>
      <div><Label>Production environment</Label><Input value={env.production} onChange={(e) => setEnv({ ...env, production: e.target.value })} /></div>
      <div><Label>Browsers</Label><TagInput value={env.browsers} onChange={(v) => setEnv({ ...env, browsers: v })} placeholder="Chrome, Firefox…" /></div>
      <div><Label>Platforms</Label><TagInput value={env.platforms} onChange={(v) => setEnv({ ...env, platforms: v })} placeholder="Web, iOS…" /></div>
      <div><Label>Operating systems</Label><TagInput value={env.os} onChange={(v) => setEnv({ ...env, os: v })} placeholder="Linux, macOS…" /></div>
    </StepShell>
  )
}
