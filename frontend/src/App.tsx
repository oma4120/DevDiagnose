import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { useData } from '@/lib/data-context'
import LoginPage from '@/pages/login'
import OnboardingPage from '@/pages/onboarding'
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
import TeamPage from '@/pages/team'

function RequireAuth() {
  const { isAuthenticated } = useData()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell><Outlet /></AppShell>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/bugs" element={<BugsPage />} />
          <Route path="/bugs/new" element={<BugNewPage />} />
          <Route path="/bugs/:id" element={<BugDetailPage />} />
          <Route path="/my-work" element={<MyWorkPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<ProjectNewPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/team" element={<TeamPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}