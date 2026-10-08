import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, ApiError } from '@/lib/api'
import type {
  ActivityItem,
  AIAnalysis,
  Bug,
  BugStatus,
  Company,
  InviteResult,
  Member,
  NotificationItem,
  Project,
  Role,
} from '@/lib/types'
import { canViewBug, seesAllProjects } from '@/lib/status-rules'

export interface DataContextValue {
  ready: boolean
  bootstrapError: string | null
  isAuthenticated: boolean
  currentUser: { id: string; name: string; email: string; avatarColor: string; role: Role }
  company: Company
  /** Derived from company.hasQA - a single source of truth, never local state. */
  hasQA: boolean
  updateCompany: (payload: { name?: string; workspace?: string; hasQA?: boolean; logo?: string | null }) => Promise<Company>
  members: Member[]
  projects: Project[]
  bugs: Bug[]
  notifications: NotificationItem[]
  recentActivity: ActivityItem[]
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  inviteMemberByEmail: (email: string, role: Role, firstName?: string, lastName?: string) => Promise<InviteResult>
  removeMember: (id: string) => Promise<void>
  addProjectMember: (projectId: string, memberId: string) => Promise<Project>
  createBug: (payload: Omit<Partial<Bug>, 'reporterId' | 'status'>) => Promise<Bug>
  createProject: (payload: Partial<Project>) => Promise<Project>
  updateProject: (id: string, payload: Partial<Project>) => Promise<Project>
  addComment: (id: string, body: string) => Promise<Bug>
  updateBug: (id: string, fields: Partial<Bug>) => Promise<Bug>
  setBugStatus: (id: string, status: BugStatus) => Promise<Bug>
  assignBug: (id: string, assigneeIds: string[]) => Promise<Bug>
  analyzeBug: (id: string) => Promise<AIAnalysis>
  markAllNotificationsRead: () => Promise<NotificationItem[]>
}

const DataContext = createContext<DataContextValue | null>(null)

/**
 * All server-owned collections plus the signed-in user, loaded together by
 * refresh() and cleared together on logout. Kept in one state object so the
 * bootstrap response is applied with a single update instead of seven.
 */
interface Workspace {
  currentUser: { id: string; name: string; email: string; avatarColor: string; role: Role }
  company: Company
  members: Member[]
  projects: Project[]
  bugs: Bug[]
  notifications: NotificationItem[]
  recentActivity: ActivityItem[]
}

const emptyWorkspace: Workspace = {
  currentUser: { id: '', name: '', email: '', avatarColor: '', role: '' as Role },
  company: { name: '', workspace: '', hasQA: true, logo: null },
  members: [],
  projects: [],
  bugs: [],
  notifications: [],
  recentActivity: [],
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => false)
  const [ready, setReady] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  const updateBugs = useCallback((fn: (bugs: Bug[]) => Bug[]) => {
    setWorkspace((prev) => ({ ...prev, bugs: fn(prev.bugs) }))
  }, [])

  const updateProjects = useCallback((fn: (projects: Project[]) => Project[]) => {
    setWorkspace((prev) => ({ ...prev, projects: fn(prev.projects) }))
  }, [])

  /** Swap one bug for its server response; used by every bug mutation. */
  const replaceBug = useCallback(
    (bug: Bug) => updateBugs((prev) => prev.map((b) => (b.id === bug.id ? bug : b))),
    [updateBugs],
  )

  const refresh = useCallback(async () => {
    try {
      const data = await api.bootstrap()
      setWorkspace({
        currentUser: data.currentUser,
        company: data.company,
        members: data.members,
        projects: data.projects,
        bugs: data.bugs,
        notifications: data.notifications,
        recentActivity: data.recentActivity,
      })
      setBootstrapError(null)
      setIsAuthenticated(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // No cookie / expired cookie: just "signed out", not a workspace failure.
        setBootstrapError(null)
      } else {
        setBootstrapError(err instanceof Error ? err.message : 'Failed to load data')
      }
      setIsAuthenticated(false)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.auth.login(email, password)
    setWorkspace((prev) => ({
      ...prev,
      currentUser: { id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor, role: user.role },
    }))
    setIsAuthenticated(true)
    await refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {
      /* ignore */
    }
    setWorkspace(emptyWorkspace)
    setIsAuthenticated(false)
    setBootstrapError(null)
    setReady(true)
  }, [])

  const inviteMemberByEmail = useCallback(async (email: string, role: Role, firstName = '', lastName = '') => {
    const result = await api.members.inviteByEmail({ email, role, firstName, lastName })
    await refresh()
    return result
  }, [refresh])

  const removeMember = useCallback(async (id: string) => {
    await api.members.remove(id)
    await refresh()
  }, [refresh])

  const addProjectMember = useCallback(async (projectId: string, memberId: string) => {
    const updated = await api.projects.addMember(projectId, memberId)
    updateProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)))
    return updated
  }, [updateProjects])

  const updateCompany = useCallback(
    async (payload: { name?: string; workspace?: string; hasQA?: boolean; logo?: string | null }) => {
      // The server response is authoritative: hasQA now lives only on `company`.
      const updated = await api.company.update(payload)
      setWorkspace((prev) => ({ ...prev, company: updated }))
      return updated
    },
    [],
  )

  const createBug = useCallback(async (payload: Omit<Partial<Bug>, 'reporterId' | 'status'>) => {
    const bug = await api.bugs.create(payload)
    updateBugs((prev) => [bug, ...prev])
    return bug
  }, [updateBugs])

  const createProject = useCallback(async (payload: Partial<Project>) => {
    const project = await api.projects.create(payload)
    updateProjects((prev) => [project, ...prev])
    return project
  }, [updateProjects])

  const updateProject = useCallback(async (id: string, payload: Partial<Project>) => {
    const project = await api.projects.update(id, payload)
    updateProjects((prev) => prev.map((p) => (p.id === id ? project : p)))
    return project
  }, [updateProjects])

  const addComment = useCallback(async (id: string, body: string) => {
    // Authorship comes back from the API (derived from the token), so QA and
    // Admin comments are no longer permanently mislabelled as Developer here.
    const bug = await api.bugs.addComment(id, body)
    replaceBug(bug)
    return bug
  }, [replaceBug])

  const setBugStatus = useCallback(async (id: string, status: BugStatus) => {
    const bug = await api.bugs.setStatus(id, status)
    replaceBug(bug)
    return bug
  }, [replaceBug])

  const updateBug = useCallback(async (id: string, fields: Partial<Bug>) => {
    const bug = await api.bugs.patch(id, fields)
    replaceBug(bug)
    return bug
  }, [replaceBug])

  const assignBug = useCallback(async (id: string, assigneeIds: string[]) => {
    const bug = await api.bugs.patch(id, { assigneeIds })
    replaceBug(bug)
    return bug
  }, [replaceBug])

  const analyzeBug = useCallback(async (id: string) => {
    // The API already creates the "AI analysis completed" notification, so no
    // local copy is injected here - it used to show up twice until a refresh.
    const { bug, analysis } = await api.bugs.analyze(id)
    replaceBug(bug)
    return analysis
  }, [replaceBug])

  const markAllNotificationsRead = useCallback(
    () => api.notifications.markAllRead().then((list) => {
      setWorkspace((prev) => ({ ...prev, notifications: list }))
      return list
    }),
    [],
  )

  const { currentUser, company, members, projects, bugs, notifications, recentActivity } = workspace

  return (
    <DataContext.Provider
      value={{
        ready,
        bootstrapError,
        isAuthenticated,
        currentUser,
        company,
        hasQA: company.hasQA !== false,
        updateCompany,
        members,
        projects,
        bugs,
        notifications,
        recentActivity,
        login,
        logout,
        refresh,
        inviteMemberByEmail,
        removeMember,
        addProjectMember,
        createBug,
        createProject,
        updateProject,
        addComment,
        updateBug,
        setBugStatus,
        assignBug,
        analyzeBug,
        markAllNotificationsRead,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

export function useMember(id: string | undefined) {
  const { members } = useData()
  return id ? members.find((m) => m.id === id) : undefined
}

export function useMembersByIds(ids: string[]) {
  const { members } = useData()
  return ids
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => Boolean(m))
}

export function useProject(id: string | undefined) {
  const { projects } = useData()
  return id ? projects.find((p) => p.id === id) : undefined
}

/**
 * Projects the current role may open. Admin and QA see everything; Developers
 * are scoped to projects they are a member of.
 */
export function useVisibleProjects(role: string): Project[] {
  const { projects, currentUser } = useData()
  if (seesAllProjects(role as Role)) return projects
  return projects.filter((p) => p.memberIds.includes(currentUser.id))
}

/**
 * Bugs the current role may see: everything in a visible project, plus any bug
 * the caller reported or is assigned to. Mirrors the server scope, so a bug the
 * API returns is never filtered away here (notably for someone removed from a
 * team, and for QA).
 */
export function useVisibleBugs(role: string): Bug[] {
  const { bugs, currentUser } = useData()
  if (seesAllProjects(role as Role)) return bugs
  const visibleIds = new Set(useVisibleProjects(role).map((p) => p.id))
  return bugs.filter((b) => canViewBug(b, currentUser.id, visibleIds))
}

export function useBug(id: string | undefined) {
  const { currentUser, bugs } = useData()
  const visible = useVisibleBugs(currentUser.role)
  if (!id) return undefined
  // The bug list is scoped to what the caller may read, so an id outside that set
  // resolves to nothing (same rule as the bugs page).
  return visible.some((b) => b.id === id) ? bugs.find((b) => b.id === id) : undefined
}

/** Roll a project's bugs up into the counters shown on its cards. */
export function projectBugStats(projectBugs: Bug[]) {
  const isOpen = (b: Bug) => !['Resolved', 'Closed'].includes(b.status)
  return {
    openBugs: projectBugs.filter(isOpen).length,
    highSeverity: projectBugs.filter((b) => isOpen(b) && ['Critical', 'High'].includes(b.severity))
      .length,
    resolvedBugs: projectBugs.filter((b) => !isOpen(b)).length,
    awaitingValidation: projectBugs.filter((b) => b.status === 'QA Validation').length,
  }
}

export function useProjectsBugStats(projectId: string) {
  const { currentUser } = useData()
  const projectBugs = useVisibleBugs(currentUser.role).filter((b) => b.projectId === projectId)
  return {
    projectBugs,
    ...projectBugStats(projectBugs),
  }
}
