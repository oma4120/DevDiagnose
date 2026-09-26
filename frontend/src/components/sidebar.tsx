import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  Bug,
  Building2,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useData } from '@/lib/data-context'
import { Avatar } from '@/components/ui/avatar'
import DevDiagnoseLogo from '@/components/brand/DevDiagnoseLogo'
import { ALL_STATUSES } from '@/lib/status-rules'
import type { BugStatus, Role } from '@/lib/types'

interface NavItem {
  label: string
  href: string
  icon: typeof Bug
  roles: Role[]
  badge?: 'unread'
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const ALL: Role[] = ['Admin', 'QA', 'Developer']

const groups: NavGroup[] = [
  {
    title: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ALL },
      { label: 'Projects', href: '/projects', icon: FolderKanban, roles: ALL },
      { label: 'Bugs', href: '/bugs', icon: Bug, roles: ALL },
      { label: 'My Work', href: '/my-work', icon: ListChecks, roles: ['QA', 'Developer'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Employees', href: '/employees', icon: Users, roles: ['Admin'] },
      { label: 'Company', href: '/company', icon: Building2, roles: ['Admin'] },
    ],
  },
  {
    title: 'You',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell, roles: ALL, badge: 'unread' },
      { label: 'Settings', href: '/settings', icon: Settings, roles: ALL },
    ],
  },
]

/** Colour per workflow status. Every status in ALL_STATUSES has an entry, so a
 *  new stage added to the backend shows up here rather than rendering blank. */
const SEGMENT_COLORS: Record<BugStatus, string> = {
  Draft: 'bg-slate',
  Submitted: 'bg-brand-blue',
  Assigned: 'bg-cyan',
  'In Progress': 'bg-indigo',
  Resolved: 'bg-success',
  'QA Validation': 'bg-warning',
  Closed: 'bg-slate/60',
}

const COLLAPSE_KEY = 'devdiagnose.sidebar.collapsed'

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { company, currentUser, logout, notifications, bugs } = useData()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  // Collapsing is a desktop affordance. Below lg the panel is a drawer and must
  // always show labels, so the rail only engages once the viewport is wide
  // enough - otherwise a desktop collapse would leak into the mobile drawer.
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  const rail = collapsed && isDesktop

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* private mode - the choice just will not persist */
    }
  }, [collapsed])

  const unread = notifications.filter((n) => !n.read).length
  const qaQueue = bugs.filter((b) => b.status === 'QA Validation').length

  // A compact distribution strip, so the panel shows the state of the board
  // rather than being pure chrome.
  const distribution = ALL_STATUSES.map((status) => ({
    status,
    count: bugs.filter((b) => b.status === status).length,
  }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
  const total = distribution.reduce((sum, s) => sum + s.count, 0)

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(currentUser.role)) }))
    .filter((g) => g.items.length > 0)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'sidebar-canvas fixed inset-y-0 left-0 z-50 flex flex-col text-sidebar-foreground transition-[width,transform] duration-300 ease-out lg:relative',
          'w-72',
          rail ? 'lg:w-[76px]' : 'lg:w-64',
          // `open` only governs the mobile drawer, so the off-canvas offset
          // must be reset at lg - otherwise a closed drawer hides the desktop
          // sidebar too, with no control left to reopen it.
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Link to="/dashboard" className="flex min-w-0 flex-1 items-center" aria-label="DevDiagnose home">
            <DevDiagnoseLogo
              light
              showText={!rail}
              size={34}
              className={cn('transition-all duration-300', rail ? 'size-9' : 'h-9 w-auto')}
            />
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Workspace identity. Only Admins have anywhere to go, so this is a
            link for them and a plain readout for everyone else - no dead
            affordance. */}
        <div className="px-3 pb-3">
          {currentUser.role === 'Admin' ? (
            <Link
              to="/company"
              onClick={onClose}
              title={rail ? company.name : undefined}
              className={cn(
                'group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2 transition-colors hover:border-white/20 hover:bg-white/[0.07]',
                rail && 'lg:justify-center lg:px-0',
              )}
            >
              <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-indigo to-cyan text-xs font-bold text-white">
                {company.logo ? (
                  <img src={company.logo} alt="" className="size-full object-contain" />
                ) : (
                  (company.name || '?')[0].toUpperCase()
                )}
              </span>
              <span className={cn('min-w-0 flex-1', rail && 'lg:hidden')}>
                <span className="block truncate text-[13px] font-semibold text-white">
                  {company.name}
                </span>
                <span className="block truncate text-[11px] text-slate-400">
                  {company.workspace || 'workspace'}
                </span>
              </span>
            </Link>
          ) : (
            <div
              title={rail ? company.name : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2',
                rail && 'lg:justify-center lg:px-0',
              )}
            >
              <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-indigo to-cyan text-xs font-bold text-white">
                {company.logo ? (
                  <img src={company.logo} alt="" className="size-full object-contain" />
                ) : (
                  (company.name || '?')[0].toUpperCase()
                )}
              </span>
              <span className={cn('min-w-0 flex-1', rail && 'lg:hidden')}>
                <span className="block truncate text-[13px] font-semibold text-white">
                  {company.name}
                </span>
                <span className="block truncate text-[11px] text-slate-400">
                  {company.workspace || 'workspace'}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-2">
          {visibleGroups.map((group, gi) => (
            <div key={group.title} className={cn(gi > 0 && 'mt-5')}>
              {rail ? (
                // No room for a label, so a hairline separates the groups
                // instead of a cryptic initial.
                <div className="mx-2 mb-2 h-px bg-white/10 first:hidden" aria-hidden />
              ) : (
                <h2 className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {group.title}
                </h2>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.icon
                  return (
                    <li key={item.href} className="relative">
                      <Link
                        to={item.href}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        // The visible label is display:none in rail mode, so the
                        // accessible name has to come from aria-label there.
                        aria-label={rail ? item.label : undefined}
                        title={rail ? item.label : undefined}
                        className={cn(
                          'relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200',
                          rail && 'lg:justify-center lg:px-0',
                          active
                            ? 'nav-active'
                            : 'text-sidebar-foreground hover:bg-white/[0.06] hover:text-white',
                        )}
                      >
                        <Icon className={cn('size-[18px] shrink-0', active && 'text-white')} />
                        <span className={cn('flex-1 truncate', rail && 'lg:hidden')}>
                          {item.label}
                        </span>
                        {item.badge === 'unread' && unread > 0 && (
                          <span
                            className={cn(
                              'rounded-full bg-error px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white',
                              rail && 'lg:absolute lg:right-1 lg:top-1 lg:px-1',
                            )}
                          >
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Board pulse: a one-glance read on the work in flight. */}
        {!rail && total > 0 && (
          <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Board pulse
              </span>
              {qaQueue > 0 && (
                <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                  {qaQueue} in QA
                </span>
              )}
            </div>
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-white/10">
              {distribution.map((seg) => (
                <span
                  key={seg.status}
                  className={cn('h-full rounded-full', SEGMENT_COLORS[seg.status])}
                  style={{ width: `${(seg.count / total) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {distribution.slice(0, 3).map((seg) => (
                <span key={seg.status} className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className={cn('size-1.5 rounded-full', SEGMENT_COLORS[seg.status])} />
                  {seg.count} {seg.status.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Account */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-white/[0.06]',
              rail && 'lg:flex-col lg:gap-1.5 lg:p-1',
            )}
          >
            <div className="relative shrink-0">
              <Avatar name={currentUser.name} color={currentUser.avatarColor} size="sm" />
              {/* Signed-in presence: the one genuinely live signal here. */}
              <span className="dd-pulse absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-navy" />
            </div>
            <span className={cn('min-w-0 flex-1', rail && 'lg:hidden')}>
              <span className="block truncate text-[13px] font-medium text-white">
                {currentUser.name}
              </span>
              <span className="block truncate text-[11px] text-slate-400">{currentUser.role}</span>
            </span>
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              title="Log out"
              aria-label="Log out"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-error/15 hover:text-error"
            >
              <LogOut className="size-4 -scale-x-100" />
            </button>
          </div>
        </div>

        {/* Desktop collapse toggle, sitting on the panel edge. */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          title={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-[4.5rem] hidden size-6 items-center justify-center rounded-full border border-white/15 bg-navy text-slate-400 shadow-lg transition-colors hover:border-white/30 hover:text-white lg:flex"
        >
          {rail ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <PanelLeftClose className="size-3.5" />
          )}
        </button>
      </aside>
    </>
  )
}
