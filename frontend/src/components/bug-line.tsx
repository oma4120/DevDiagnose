import { Link } from 'react-router-dom'
import { PriorityBadge, SeverityBadge, StatusBadge } from '@/components/badges'
import { useProject } from '@/lib/data-context'
import type { Bug } from '@/lib/types'

export function BugLine({ bug }: { bug: Bug }) {
  const project = useProject(bug.projectId)
  return (
    <Link
      to={`/bugs/${bug.id}`}
      className="flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2.5 transition-colors hover:border-border hover:bg-soft"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{bug.ref}</span>
          <span className="truncate text-sm font-medium text-foreground">{bug.title}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{project?.name}</p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <SeverityBadge severity={bug.severity} />
        <PriorityBadge priority={bug.priority} />
      </div>
      <StatusBadge status={bug.status} />
    </Link>
  )
}