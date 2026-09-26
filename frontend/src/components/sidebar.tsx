import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  Bug,
  Building2,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useData } from '@/lib/data-context'
import { Avatar } from '@/components/ui/avatar'
import DevDiagnoseLogo from '@/components/brand/DevDiagnoseLogo'
import type { Role } from '@/lib/types'

const nav: { label: string; href: string; icon: typeof Bug; roles: Role[] }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['Admin', 'QA', 'Developer'] },
  { label: 'Projects', href: '/projects', icon: FolderKanban, roles: ['Admin', 'QA', 'Developer'] },
  { label: 'Bugs', href: '/bugs', icon: Bug, roles: ['Admin', 'QA', 'Developer'] },
  { label: 'My Work', href: '/my-work', icon: ListChecks, roles: ['QA', 'Developer'] },
  { label: 'Employees', href: '/employees', icon: Users, roles: ['Admin'] },
  { label: 'Company', href: '/company', icon: Building2, roles: ['Admin'] },
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: ['Admin', 'QA', 'Developer'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['Admin', 'QA', 'Developer'] },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { company, currentUser, logout } = useData()
  const items = nav.filter((item) => item.roles.includes(currentUser.role))

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center">
            <DevDiagnoseLogo light className="h-9 w-auto" />
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Workspace switcher */}
        <div className="px-3 pb-2">
          <button className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-2.5 py-2 text-left transition-colors hover:border-slate-600">
            {company.logo ? (
              <span className="flex size-6 items-center justify-center overflow-hidden rounded bg-cyan">
                <img src={company.logo} alt="" className="size-full object-contain" />
              </span>
            ) : (
              <span className="flex size-6 items-center justify-center rounded bg-cyan text-[11px] font-bold text-white">
                {(company.name || '?')[0]}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-white">{company.name}</span>
              <span className="block truncate text-[11px] text-slate-400">Workspace</span>
            </span>
          </button>
        </div>

        {/* Nav */}
        <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-indigo text-white'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="flex items-center gap-1 border-t border-sidebar-border p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1">
            <Avatar name={currentUser.name} color={currentUser.avatarColor} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-white">{currentUser.name}</span>
              <span className="block truncate text-[10px] text-sidebar-foreground/70">{currentUser.role}</span>
            </span>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="rounded-md p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="size-4 -scale-x-100" />
          </button>
        </div>
      </aside>
    </>
  )
}
