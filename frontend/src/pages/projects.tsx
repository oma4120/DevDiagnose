import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { FolderPlus, LayoutGrid, Search, Table2, AlertTriangle, Bug } from 'lucide-react'
import { PageHeader } from '@/components/app-shell'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/badges'
import { Select } from '@/components/ui/field'
import { AvatarGroup } from '@/components/ui/avatar'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import { useData } from '@/lib/data-context'

export default function ProjectsPage() {
  const { projects, members, currentUser } = useData()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('All')
  const [view, setView] = useState<'cards' | 'table'>('cards')

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesQuery =
        !query ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase()) ||
        [...p.frontend, ...p.backend, ...p.database].some((t) =>
          t.toLowerCase().includes(query.toLowerCase()),
        )
      const matchesType = type === 'All' || p.type === type
      return matchesQuery && matchesType
    })
  }, [query, type, projects])

  // Hybrid: switch to table automatically while actively searching/filtering
  const effectiveView = query || type !== 'All' ? 'table' : view

  const membersOf = (ids: string[]) =>
    ids
      .map((id) => members.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => ({ name: m.name, color: m.avatarColor }))

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Projects"
        description="Every project holds the context the AI uses to diagnose its bugs."
        actions={
          currentUser.role === 'Admin' && (
            <Link
              to="/projects/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
            >
              <FolderPlus className="size-4" />
              New Project
            </Link>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-full sm:w-48">
          <option>All</option>
          <option>Web Application</option>
          <option>Mobile Application</option>
          <option>API / Backend</option>
          <option>Desktop Application</option>
        </Select>
        <div className="flex rounded-lg border border-border p-0.5">
          <button
            onClick={() => setView('cards')}
            className={cn('rounded-md p-1.5', effectiveView === 'cards' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}
            aria-label="Card view"
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            onClick={() => setView('table')}
            className={cn('rounded-md p-1.5', effectiveView === 'table' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}
            aria-label="Table view"
          >
            <Table2 className="size-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="No projects found"
          description={query ? 'Try a different search term.' : 'Create your first project to start tracking bugs.'}
        />
      ) : effectiveView === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="h-full p-4 transition-all hover:border-indigo/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <span className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {p.type}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[...p.frontend.slice(0, 2), ...p.backend.slice(0, 1), ...p.database.slice(0, 1)].map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Bug className="size-3.5" />{p.openBugs} open</span>
                    <span className="flex items-center gap-1 text-orange-600"><AlertTriangle className="size-3.5" />{p.highSeverity} high</span>
                  </div>
                  <AvatarGroup people={membersOf(p.memberIds)} size="xs" max={3} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-soft text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Tech stack</th>
                  <th className="px-4 py-2.5 text-right font-medium">Open</th>
                  <th className="px-4 py-2.5 text-right font-medium">High</th>
                  <th className="px-4 py-2.5 font-medium">Team</th>
                  <th className="px-4 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="cursor-pointer transition-colors hover:bg-soft/60">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${p.id}`} className="block">
                        <p className="font-medium text-foreground">{p.name}</p>
                        <p className="max-w-xs truncate text-xs text-muted-foreground">{p.description}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {[...p.frontend.slice(0, 1), ...p.backend.slice(0, 1), ...p.database.slice(0, 1)].map((t) => (
                          <Chip key={t}>{t}</Chip>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{p.openBugs}</td>
                    <td className="px-4 py-3 text-right font-mono text-orange-600">{p.highSeverity}</td>
                    <td className="px-4 py-3"><AvatarGroup people={membersOf(p.memberIds)} size="xs" max={3} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{p.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}