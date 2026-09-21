import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  AlertTriangle,
  Bug as BugIcon,
  Clock,
  Folder,
  Layers,
  Pencil,
  Plus,
  Server,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/stat-card'
import { Tabs } from '@/components/ui/tabs'
import { Chip } from '@/components/badges'
import { Avatar } from '@/components/ui/avatar'
import { BugBoard } from '@/components/bug-board'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import { useRole } from '@/components/role-context'
import { useToast } from '@/components/ui/toast'
import { useData, useProject } from '@/lib/data-context'
import type { Role } from '@/lib/types'

const roleBadge: Record<Role, string> = {
  Admin: 'border-amber-200 bg-amber-50 text-amber-700',
  QA: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  Developer: 'border-indigo-200 bg-indigo-50 text-indigo',
}

export default function ProjectOverviewPage() {
  const params = useParams<{ id: string }>()
  const project = useProject(params.id)
  const { role } = useRole()
  const { toast } = useToast()
  const { bugs, members, setBugStatus } = useData()
  const [tab, setTab] = useState('overview')

  const projectBugs = project ? bugs.filter((b) => b.projectId === project.id) : []
  const projectMembers = (project?.memberIds ?? [])
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <EmptyState
          icon={Folder}
          title="Project not found"
          description="This project may have been deleted or the link is incorrect."
          action={
            <Link
              to="/projects"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              Back to projects
            </Link>
          }
        />
      </div>
    )
  }

  const contextLabel = (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo/20 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
      <Sparkles className="size-3" />
      Used by AI for bug analysis
    </span>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={project.name}
        description={project.description}
        actions={
          role === 'Admin' && (
            <button
              onClick={() => toast({ kind: 'info', title: 'Edit project', description: 'Open the project configuration wizard.' })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              <Pencil className="size-4" />
              Edit
            </button>
          )
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md bg-soft px-2 py-0.5 text-xs font-medium text-muted-foreground">{project.type}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{projectMembers.length} members</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Updated {project.updatedAt}</span>
        </div>
      </PageHeader>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'bugs', label: 'Bugs', count: projectBugs.length },
          { id: 'team', label: 'Team', count: projectMembers.length },
          { id: 'context', label: 'Context' },
          { id: 'activity', label: 'Activity' },
        ]}
      />

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Open bugs" value={project.openBugs} icon={BugIcon} accent="text-violet-500" />
            <StatCard label="High severity" value={project.highSeverity} icon={AlertTriangle} accent="text-orange-500" />
            <StatCard label="Awaiting validation" value={project.awaitingValidation} icon={Clock} accent="text-amber-500" />
            <StatCard label="Resolved" value={project.resolvedBugs} icon={ShieldCheck} accent="text-emerald-500" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Purpose</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{project.purpose}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Tech stack</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {[...project.frontend, ...project.backend, ...project.database, ...project.auth].map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'bugs' && (
        <Card>
          <CardHeader>
            <CardTitle>Bugs</CardTitle>
            <Link to="/bugs/new" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo px-2.5 text-xs font-medium text-white hover:bg-indigo/90"><Plus className="size-3.5" />New Bug</Link>
          </CardHeader>
          <CardContent className="p-2">
            {projectBugs.length === 0 ? (
              <EmptyState icon={BugIcon} title="No bugs reported for this project." className="border-0 py-8" />
            ) : (
              <BugBoard bugs={projectBugs} members={members} onStatusChange={(id, status) => { void setBugStatus(id, status) }} />
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'team' && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Project team</CardTitle>
            {role === 'Admin' && (
              <button onClick={() => toast({ kind: 'success', title: 'Member added' })} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo px-2.5 text-xs font-medium text-white hover:bg-indigo/90"><UserPlus className="size-3.5" />Add member</button>
            )}
          </CardHeader>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Assigned</th>
                  <th className="px-4 py-2.5 text-right font-medium">Resolved</th>
                  {role === 'Admin' && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projectMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-soft/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.name} color={m.avatarColor} size="sm" />
                        <div><p className="font-medium text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', roleBadge[m.role])}>{m.role}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{m.status}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{m.assignedBugs}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{m.resolvedBugs}</td>
                    {role === 'Admin' && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => toast({ kind: 'info', title: 'Remove member?', description: `${m.name} would lose project access.` })} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-error" aria-label={`Remove ${m.name}`}><UserMinus className="size-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'context' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Everything below is provided to the AI when analyzing this project&apos;s bugs.</p>
            {contextLabel}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ContextCard icon={Layers} title="Architecture">
              <p className="text-sm text-muted-foreground">{project.architecture}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Modules</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{project.modules.map((m) => <Chip key={m}>{m}</Chip>)}</div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">API patterns</p>
              <p className="mt-1 text-sm text-muted-foreground">{project.apiPatterns}</p>
            </ContextCard>
            <ContextCard icon={Server} title="Environment">
              <dl className="space-y-1.5 text-sm">
                <EnvRow label="Development" value={project.environments.development} />
                <EnvRow label="Staging" value={project.environments.staging} />
                <EnvRow label="Production" value={project.environments.production} />
              </dl>
              {project.browsers.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Browsers / platforms</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">{[...project.browsers, ...project.platforms].map((b) => <Chip key={b}>{b}</Chip>)}</div>
                </>
              )}
            </ContextCard>
          </div>
          <ContextCard icon={ScrollText} title="Business rules">
            {project.businessRules.length ? (
              <ul className="space-y-3">
                {project.businessRules.map((r) => (
                  <li key={r.id} className="border-l-2 border-indigo/40 pl-3">
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No business rules defined.</p>
            )}
          </ContextCard>
          <ContextCard icon={ShieldCheck} title="Development constraints & conventions">
            <p className="text-sm text-muted-foreground">{project.constraints}</p>
            <p className="mt-2 text-sm text-muted-foreground">{project.conventions}</p>
          </ContextCard>
        </div>
      )}

      {tab === 'activity' && (
        <Card>
          <CardContent className="space-y-3">
            {projectBugs.slice(0, 6).map((b) => (
              <div key={b.id} className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo" />
                <div>
                  <p className="text-sm text-foreground">
                    <span className="font-mono text-muted-foreground">{b.ref}</span> {b.title} — <span className="text-muted-foreground">{b.status}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Updated {b.updatedAt}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ContextCard({ icon: Icon, title, children }: { icon: typeof Layers; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" />{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function EnvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs text-foreground">{value}</dd>
    </div>
  )
}