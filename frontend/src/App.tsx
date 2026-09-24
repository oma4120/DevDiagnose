import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { useData } from '@/lib/data-context'
import type { Role } from '@/lib/types'
import LoginPage from '@/pages/login'
import InvitePage from '@/pages/invite'
import DashboardPage from '@/pages/dashboard'
import BugsPage from '@/pages/bugs'
import BugNewPage from '@/pages/bug-new'
import BugDetailPage from '@/pages/bug-detail'
import MyWorkPage from '@/pages/my-work'
import NotificationsPage from '@/pages/notifications'
import ProjectsPage from '@/pages/projects'
import ProjectNewPage from '@/pages/project-new'
import ProjectDetailPage from '@/pages/project-detail'
import SettingsPage from '@/pages/settings'
import CompanyPage from '@/pages/company'
import EmployeesPage from '@/pages/employees'

function RequireAuth() {
  const { isAuthenticated, ready } = useData()
  const location = useLocation()
  if (!ready) return null
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

function RequireRole({ roles }: { roles: Role[] }) {
  const { currentUser, ready } = useData()
  if (!ready) return null
  if (!roles.includes(currentUser.role)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell><Outlet /></AppShell>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/bugs" element={<BugsPage />} />
          <Route path="/bugs/new" element={<BugNewPage />} />
          <Route path="/bugs/:id" element={<BugDetailPage />} />
          <Route element={<RequireRole roles={['QA', 'Developer']} />}>
            <Route path="/my-work" element={<MyWorkPage />} />
          </Route>
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route element={<RequireRole roles={['Admin']} />}>
            <Route path="/projects/new" element={<ProjectNewPage />} />
            <Route path="/company" element={<CompanyPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
          </Route>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
