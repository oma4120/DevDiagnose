import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Bug as BugIcon, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Select } from '@/components/ui/field'
import { BugBoard } from '@/components/bug-board'
import { EmptyState } from '@/components/empty-state'
import { useRole } from '@/components/role-context'
import { useData, useVisibleBugs, useVisibleProjects } from '@/lib/data-context'
import type { BugStatus, Category, Severity } from '@/lib/types'

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

export default function BugsPage() {
  const { role } = useRole()
  const { members, setBugStatus } = useData()
  const visibleProjects = useVisibleProjects(role)
  const visibleBugs = useVisibleBugs(role)
  const [query, setQuery] = useState('')
  const [project, setProject] = useState('All')
  const [status, setStatus] = useState<(typeof statuses)[number]>('All')
  const [severity, setSeverity] = useState<(typeof severities)[number]>('All')
  const [category, setCategory] = useState<(typeof categories)[number]>('All')

  const projectName = (id: string) => visibleProjects.find((p) => p.id === id)?.name

  const filtered = useMemo(() => {
    return visibleBugs.filter((b) => {
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
  }, [query, project, status, severity, category, visibleBugs])

  const boardSections = useMemo(() => {
    if (project !== 'All') {
      return [{ projectId: project, projectName: projectName(project) ?? 'Project', bugs: filtered }]
    }
    const byProject = new Map<typeof visibleBugs[number]['projectId'], typeof visibleBugs>()
    for (const b of filtered) {
      const list = byProject.get(b.projectId) ?? []
      list.push(b)
      byProject.set(b.projectId, list)
    }
    return [...byProject.entries()].map(([projectId, list]) => ({
      projectId,
      projectName: projectName(projectId) ?? 'Unknown project',
      bugs: list,
    }))
  }, [filtered, project, visibleProjects])

  const activeFilters = [project, status, severity, category].filter((v) => v !== 'All').length + (query ? 1 : 0)

  const clearFilters = () => {
    setQuery('')
    setProject('All')
    setStatus('All')
    setSeverity('All')
    setCategory('All')
  }

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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bugs by title, ID, or description…"
            className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="All">All projects</option>
            {visibleProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as BugStatus | 'All')}>
            {statuses.map((s) => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>)}
          </Select>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | 'All')}>
            {severities.map((s) => <option key={s} value={s}>{s === 'All' ? 'All severities' : s}</option>)}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value as Category | 'All')}>
            {categories.map((c) => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
          </Select>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filtered.length} {filtered.length === 1 ? 'bug' : 'bugs'}
            {activeFilters > 0 && ` · ${activeFilters} filter${activeFilters === 1 ? '' : 's'} active`}
          </span>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="font-medium text-indigo hover:underline">
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
        <div className="space-y-6">
          {boardSections.map(({ projectId, projectName: sectionName, bugs: sectionBugs }) => (
            <section key={projectId} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  <Link className="hover:text-indigo" to={`/projects/${projectId}`}>{sectionName}</Link>
                  <span className="ml-2 font-normal text-muted-foreground">
                    {sectionBugs.length} {sectionBugs.length === 1 ? 'bug' : 'bugs'}
                  </span>
                </h2>
                <Link className="text-xs font-medium text-indigo hover:underline" to={`/projects/${projectId}`}>
                  Open project
                </Link>
              </div>
              <BugBoard
                bugs={sectionBugs}
                members={members}
                onStatusChange={(id, status) => { void setBugStatus(id, status) }}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}