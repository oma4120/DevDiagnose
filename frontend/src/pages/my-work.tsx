import { CheckCircle2, Inbox, Loader2, ListChecks, Clock } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BugLine } from '@/components/bug-line'
import { EmptyState } from '@/components/empty-state'
import { useData, useVisibleBugs } from '@/lib/data-context'
import type { Bug } from '@/lib/types'

function Section({
  title,
  icon: Icon,
  items,
  emptyTitle,
  emptyDesc,
}: {
  title: string
  icon: typeof Inbox
  items: Bug[]
  emptyTitle: string
  emptyDesc: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </CardHeader>
      <CardContent className="p-2">
        {items.length ? (
          <div className="space-y-0.5">
            {items.map((b) => (
              <BugLine key={b.id} bug={b} />
            ))}
          </div>
        ) : (
          <EmptyState icon={CheckCircle2} title={emptyTitle} description={emptyDesc} className="border-0 py-8" />
        )}
      </CardContent>
    </Card>
  )
}

export default function MyWorkPage() {
  const { currentUser, hasQA } = useData()
  // Same visibility rule as the bugs page: only bugs inside your projects.
  const bugs = useVisibleBugs(currentUser.role)
  const mine = bugs.filter((b) => b.assigneeIds.includes(currentUser.id) || b.reporterId === currentUser.id)

  const assigned = bugs.filter(
    (b) => b.assigneeIds.includes(currentUser.id) && (b.status === 'Submitted' || b.status === 'Assigned'),
  )
  const inProgress = bugs.filter((b) => b.assigneeIds.includes(currentUser.id) && b.status === 'In Progress')
  const awaiting =
    currentUser.role === 'QA'
      ? bugs.filter((b) => b.status === 'QA Validation' || b.status === 'Resolved')
      : bugs.filter(
          (b) =>
            (b.validatorId === currentUser.id &&
              (b.status === 'Resolved' || b.status === 'QA Validation')) ||
            (!hasQA && b.reporterId === currentUser.id && b.status === 'QA Validation') ||
            (b.assigneeIds.includes(currentUser.id) && b.needsAttention === true),
        )
  const recentlyResolved = mine.filter((b) => ['Resolved', 'Closed'].includes(b.status))

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My Work"
        description="Everything assigned to you or waiting on your action, in one place."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Assigned to Me"
          icon={ListChecks}
          items={assigned}
          emptyTitle="Nothing newly assigned"
          emptyDesc="Bugs assigned to you appear here until you start work."
        />
        <Section
          title="In Progress"
          icon={Loader2}
          items={inProgress}
          emptyTitle="No active work"
          emptyDesc="Bugs you're actively fixing show here."
        />
        <Section
          title={currentUser.role === 'QA' ? 'Awaiting Validation' : 'Awaiting My Action'}
          icon={Clock}
          items={awaiting}
          emptyTitle="You're all caught up"
          emptyDesc={
            currentUser.role === 'QA'
              ? 'Resolved bugs waiting for validation appear here.'
              : 'Rejected fixes waiting for your changes, and fixes waiting for your validation, appear here.'
          }
        />
        <Section
          title="Recently Resolved"
          icon={CheckCircle2}
          items={recentlyResolved}
          emptyTitle="No recent resolutions"
          emptyDesc="Resolved and closed bugs appear here."
        />
      </div>
    </div>
  )
}
