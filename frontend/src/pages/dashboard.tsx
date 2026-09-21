import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bug as BugIcon,
  CircleDot,
  Clock,
  Loader2,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { StatCard } from '@/components/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, DonutChart } from '@/components/bar-chart'
import { BugLine } from '@/components/bug-line'
import { EmptyState } from '@/components/empty-state'
import { useRole } from '@/components/role-context'
import { useData } from '@/lib/data-context'
import type { BugStatus, Severity } from '@/lib/types'

export default function DashboardPage() {
  const { role } = useRole()
  const { currentUser, bugs, recentActivity } = useData()

  const total = bugs.length
  const count = (s: BugStatus) => bugs.filter((b) => b.status === s).length
  const open = bugs.filter((b) => ['Submitted', 'Assigned'].includes(b.status)).length
  const inProgress = count('In Progress')
  const awaiting = count('QA Validation')
  const resolved = bugs.filter((b) => ['Resolved', 'Closed'].includes(b.status)).length

  const statusColors: Record<string, string> = {
    Submitted: '#64748b',
    Assigned: '#8b5cf6',
    'In Progress': '#3b82f6',
    Resolved: '#10b981',
    'QA Validation': '#f59e0b',
    Closed: '#94a3b8',
  }
  const statusData = (Object.keys(statusColors) as BugStatus[])
    .map((s) => ({ label: s, value: count(s), color: statusColors[s] }))
    .filter((d) => d.value > 0)

  const sevColors: Record<Severity, string> = {
    Critical: '#ef4444',
    High: '#f97316',
    Medium: '#f59e0b',
    Low: '#94a3b8',
  }
  const sevData = (Object.keys(sevColors) as Severity[]).map((s) => ({
    label: s,
    value: bugs.filter((b) => b.severity === s).length,
    color: sevColors[s],
  }))

  const myBugs = bugs.filter((b) => b.assigneeIds.includes(currentUser.id))

  const needsAttention = {
    unassigned: bugs.filter((b) => b.assigneeIds.length === 0),
    highSeverity: bugs.filter(
      (b) => ['Critical', 'High'].includes(b.severity) && !['Closed', 'Resolved'].includes(b.status),
    ),
    awaitingValidation: bugs.filter((b) => b.status === 'QA Validation'),
    noAnalysis: bugs.filter((b) => b.analyses.length === 0 && b.status !== 'Draft'),
  }

  const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Good afternoon'

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title={`${greeting}, ${currentUser.name.split(' ')[0]}`}
        description="Here's what's happening across your projects."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total Bugs" value={total} icon={BugIcon} accent="text-slate-500" />
        <StatCard label="Open" value={open} icon={CircleDot} accent="text-violet-500" />
        <StatCard label="In Progress" value={inProgress} icon={Loader2} accent="text-blue-500" />
        <StatCard label="Awaiting Validation" value={awaiting} icon={Clock} accent="text-amber-500" />
        <StatCard label="Resolved" value={resolved} icon={ShieldCheck} accent="text-emerald-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left / large */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Bug Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-8 sm:grid-cols-2">
              <div>
                <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Bugs by status
                </p>
                <DonutChart data={statusData} total={total} centerLabel="bugs" />
              </div>
              <div>
                <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Bugs by severity
                </p>
                <BarChart data={sevData} />
              </div>
            </CardContent>
          </Card>

          {/* Needs attention */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <AttentionTile
                label="Unassigned bugs"
                count={needsAttention.unassigned.length}
                tone="violet"
                icon={CircleDot}
              />
              <AttentionTile
                label="High-severity open"
                count={needsAttention.highSeverity.length}
                tone="red"
                icon={AlertTriangle}
              />
              <AttentionTile
                label="Awaiting validation"
                count={needsAttention.awaitingValidation.length}
                tone="amber"
                icon={Clock}
              />
              <AttentionTile
                label="Unanalyzed bugs"
                count={needsAttention.noAnalysis.length}
                tone="blue"
                icon={Sparkles}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{role === 'QA' ? 'Awaiting Validation' : 'My Work'}</CardTitle>
              <Link to="/my-work" className="text-xs font-medium text-indigo hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="p-2">
              {myBugs.length ? (
                <div className="space-y-0.5">
                  {myBugs.map((b) => (
                    <BugLine key={b.id} bug={b} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="You're all caught up"
                  description="No bugs are assigned to you right now."
                  className="border-0 py-8"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TimerReset className="size-4 text-muted-foreground" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{a.message}</p>
                    <p className="text-xs text-muted-foreground">{a.at}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const tones: Record<string, string> = {
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
}

function AttentionTile({
  label,
  count,
  tone,
  icon: Icon,
}: {
  label: string
  count: number
  tone: string
  icon: typeof CircleDot
}) {
  return (
    <Link
      to="/bugs"
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-soft"
    >
      <span className="flex items-center gap-2.5">
        <span className={`flex size-8 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon className="size-4" />
        </span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </span>
      <span className="text-lg font-semibold text-foreground">{count}</span>
    </Link>
  )
}