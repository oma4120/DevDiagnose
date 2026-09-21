import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Bell, Bug, ChevronRight, FolderPlus, Menu, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { useData } from '@/lib/data-context'

const labelMap: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  bugs: 'Bugs',
  'my-work': 'My Work',
  team: 'Team',
  notifications: 'Notifications',
  settings: 'Settings',
  new: 'New',
  create: 'Create',
}

function useOutside(cb: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [cb])
  return ref
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { currentUser, notifications } = useData()
  const [createOpen, setCreateOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const createRef = useOutside(() => setCreateOpen(false))
  const notifRef = useOutside(() => setNotifOpen(false))

  const segments = pathname.split('/').filter(Boolean)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur">
      <button
        onClick={onMenu}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="size-5" />
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm md:flex">
        <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
          Home
        </Link>
        {segments.map((seg, i) => {
          const href = '/' + segments.slice(0, i + 1).join('/')
          const isLast = i === segments.length - 1
          const label = labelMap[seg] ?? (seg.startsWith('b') || seg.startsWith('p') ? `#${seg.slice(1)}` : seg)
          return (
            <span key={href} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 text-muted-foreground/60" />
              {isLast ? (
                <span className="max-w-[180px] truncate font-medium text-foreground">{label}</span>
              ) : (
                <Link to={href} className="capitalize text-muted-foreground hover:text-foreground">
                  {label}
                </Link>
              )}
            </span>
          )
        })}
      </nav>

      {/* Search */}
      <div className="relative ml-auto hidden w-full max-w-xs items-center sm:flex">
        <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
        <input
          placeholder="Search bugs, projects…"
          className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-14 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <kbd className="pointer-events-none absolute right-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </div>

      {/* Quick create */}
      <div ref={createRef} className="relative ml-auto sm:ml-0">
        <button
          onClick={() => setCreateOpen((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo/90"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Create</span>
        </button>
        {createOpen && (
          <div className="absolute right-0 top-11 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in slide-in-from-top-1">
            <button
              onClick={() => {
                setCreateOpen(false)
                navigate('/bugs/new')
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
            >
              <Bug className="size-4 text-indigo" />
              New Bug
            </button>
            <button
              onClick={() => {
                setCreateOpen(false)
                navigate('/projects/new')
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
            >
              <FolderPlus className="size-4 text-indigo" />
              New Project
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-error ring-2 ring-card" />
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 top-11 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lg animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                {unread} new
              </span>
            </div>
            <div className="max-h-80 divide-y divide-border overflow-y-auto scroll-thin">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} className={cn('flex gap-2.5 px-3 py-2.5', !n.read && 'bg-accent/40')}>
                  <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-indigo')} />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{n.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.category} · {n.at}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/notifications"
              onClick={() => setNotifOpen(false)}
              className="block border-t border-border px-3 py-2 text-center text-sm font-medium text-indigo hover:bg-muted"
            >
              View all
            </Link>
          </div>
        )}
      </div>

      <Avatar name={currentUser.name} color={currentUser.avatarColor} size="sm" />
    </header>
  )
}