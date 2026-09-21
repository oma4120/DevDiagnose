import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Bug as BugIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { PriorityBadge, SeverityBadge, StatusBadge } from '@/components/badges'
import { AvatarGroup } from '@/components/ui/avatar'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import { useData } from '@/lib/data-context'
import type { Bug, BugStatus, Category, Severity } from '@/lib/types'

const statuses: (BugStatus | 'All')[] = [
  'All',
  'Submitted',
  'Assigned',
  'In Progress',
  'Resolved',
  'QA Validation',
  'Closed',
]
const severities: (Severity | 'All')[] = ['All', 'Critical', 'High', 'Medium', 'Low']
const categories: (Category | 'All')[] = [
  'All',
  'Frontend',
  'Backend',
  'Database',
  'API',
  'Authentication',
  'Security',
  'Performance',
  'UI/UX',
  'Other',
]

const severityRank: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 }
type SortKey = 'updated' | 'severity' | 'ref' | 'title'
const PAGE_SIZE = 6

export default function BugsPage() {
  const { bugs, projects, members } = useData()
  const [query, setQuery] = useState('')
  const [project, setProject] = useState('All')
  const [status, setStatus] = useState<(typeof statuses)[number]>('All')
  const [severity, setSeverity] = useState<(typeof severities)[number]>('All')
  const [category, setCategory] = useState<(typeof categories)[number]>('All')
  const [sort, setSort] = useState<SortKey>('updated')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name

  const filtered = useMemo(() => {
    const list = bugs.filter((b) => {
      const matchesQuery =
        !query ||
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.ref.includes(query) ||
        b.description.toLowerCase().includes(query.toLowerCase())
      const matchesProject = project === 'All' || b.projectId === project
      const matchesStatus = status === 'All' || b.status === status
      const matchesSeverity = severity === 'All' || b.severity === severity
      const matchesCategory = category === 'All' || b.category === category
      return matchesQuery && matchesProject && matchesStatus && matchesSeverity && matchesCategory
    })

    const sorted = [...list].sort((a, b) => {
      let cmp = 0
      if (sort === 'severity') cmp = severityRank[a.severity] - severityRank[b.severity]
      else if (sort === 'ref') cmp = a.ref.localeCompare(b.ref)
      else if (sort === 'title') cmp = a.title.localeCompare(b.title)
      else cmp = bugs.indexOf(b) - bugs.indexOf(a) // updated: rely on source order (newest first)
      return dir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [query, project, status, severity, category, sort, dir, bugs])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const activeFilters = [project, status, severity, category].filter((v) => v !== 'All').length + (query ? 1 : 0)

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setDir(key === 'title' || key === 'ref' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
  }

  const assignees = (b: Bug) =>
    b.assigneeIds
      .map((id) => members.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => ({ name: m.name, color: m.avatarColor }))

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Bugs"
        description="Every reported bug, diagnosed with full project context by the AI."
        actions={
          <Link
            to="/bugs/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
          >
            <Plus className="size-4" />
            Report Bug
          </Link>
        }
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Search bugs by title, ID, or description…"
            className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={project} onChange={(e) => resetPage(setProject)(e.target.value)}>
            <option value="All">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as BugStatus | 'All')}>
            {statuses.map((s) => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>)}
          </Select>
          <Select value={severity} onChange={(e) => resetPage(setSeverity)(e.target.value as Severity | 'All')}>
            {severities.map((s) => <option key={s} value={s}>{s === 'All' ? 'All severities' : s}</option>)}
          </Select>
          <Select value={category} onChange={(e) => resetPage(setCategory)(e.target.value as Category | 'All')}>
            {categories.map((c) => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
          </Select>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filtered.length} {filtered.length === 1 ? 'bug' : 'bugs'}
            {activeFilters > 0 && ` · ${activeFilters} filter${activeFilters === 1 ? '' : 's'} active`}
          </span>
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setQuery(''); setProject('All'); setStatus('All'); setSeverity('All'); setCategory('All'); setPage(1)
              }}
              className="font-medium text-indigo hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BugIcon}
          title="No bugs match your filters"
          description="Try adjusting your search or filters, or report a new bug."
          action={
            <Link to="/bugs/new" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white hover:bg-indigo/90">
              <Plus className="size-4" />Report Bug
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft text-left text-xs font-medium text-muted-foreground">
                  <SortableTh label="ID" onClick={() => toggleSort('ref')} active={sort === 'ref'} dir={dir} className="w-20" />
                  <SortableTh label="Bug" onClick={() => toggleSort('title')} active={sort === 'title'} dir={dir} />
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <SortableTh label="Severity" onClick={() => toggleSort('severity')} active={sort === 'severity'} dir={dir} />
                  <th className="px-4 py-2.5 font-medium">Priority</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Assignee</th>
                  <SortableTh label="Updated" onClick={() => toggleSort('updated')} active={sort === 'updated'} dir={dir} className="text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.map((b) => {
                  const people = assignees(b)
                  const hasAI = b.analyses.length > 0
                  return (
                    <tr key={b.id} className="group cursor-pointer transition-colors hover:bg-soft/60">
                      <td className="px-4 py-3">
                        <Link to={`/bugs/${b.id}`} className="font-mono text-xs text-muted-foreground group-hover:text-indigo">{b.ref}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/bugs/${b.id}`} className="flex items-center gap-2">
                          <span className="max-w-md truncate font-medium text-foreground">{b.title}</span>
                          {hasAI && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-indigo/20 bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                              <Sparkles className="size-2.5" />AI
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{projectName(b.projectId)}</td>
                      <td className="px-4 py-3"><SeverityBadge severity={b.severity} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={b.priority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3">
                        {people.length ? (
                          <AvatarGroup people={people} size="xs" max={3} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{b.updatedAt}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              <span>Page {current} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={current === 1}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" />Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={current === totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium hover:bg-muted disabled:opacity-40"
                >
                  Next<ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function SortableTh({
  label,
  onClick,
  active,
  dir,
  className,
}: {
  label: string
  onClick: () => void
  active: boolean
  dir: 'asc' | 'desc'
  className?: string
}) {
  return (
    <th className={cn('px-4 py-2.5 font-medium', className)}>
      <button onClick={onClick} className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}>
        {label}
        {active && (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  )
}