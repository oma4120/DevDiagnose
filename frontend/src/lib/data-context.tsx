import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken, setToken } from '@/lib/api'
import type {
  ActivityItem,
  AIAnalysis,
  Bug,
  BugStatus,
  InviteResult,
  Member,
  NotificationItem,
  Project,
  Role,
} from '@/lib/types'

export interface DataContextValue {
  ready: boolean
  bootstrapError: string | null
  isAuthenticated: boolean
  currentUser: { id: string; name: string; email: string; avatarColor: string; role: Role }
  company: { name: string; workspace: string; hasQA: boolean }
  hasQA: boolean
  setHasQA: (value: boolean) => void
  members: Member[]
  projects: Project[]
  bugs: Bug[]
  notifications: NotificationItem[]
  recentActivity: ActivityItem[]
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  inviteMemberByEmail: (email: string, role: Role, firstName?: string, lastName?: string) => Promise<InviteResult>
  removeMember: (id: string) => Promise<void>
  addProjectMember: (projectId: string, memberId: string) => Promise<Project>
  createBug: (payload: Partial<Bug>) => Promise<Bug>
  createProject: (payload: Partial<Project>) => Promise<Project>
  addComment: (id: string, body: string, authorName?: string) => Promise<Bug>
  setBugStatus: (id: string, status: BugStatus) => Promise<Bug>
  assignBug: (id: string, assigneeIds: string[]) => Promise<Bug>
  analyzeBug: (id: string) => Promise<AIAnalysis>
  markAllNotificationsRead: () => Promise<NotificationItem[]>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [authToken, setAuthToken] = useState<string | null>(() => getToken())
  const [currentUser, setCurrentUser] = useState({ id: '', name: '', email: '', avatarColor: '', role: '' as Role })
  const [company, setCompany] = useState({ name: '', workspace: '', hasQA: true })
  const [hasQA, setHasQA] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [bugs, setBugs] = useState<Bug[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [ready, setReady] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setReady(true)
      return
    }
    try {
      const data = await api.bootstrap()
      setCurrentUser(data.currentUser)
      setCompany(data.company)
      setMembers(data.members)
      setProjects(data.projects)
      setBugs(data.bugs)
      setNotifications(data.notifications)
      setRecentActivity(data.recentActivity)
      setBootstrapError(null)
    } catch (err) {
      setBootstrapError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.auth.login(email, password)
    setToken(token)
    setAuthToken(token)
    setCurrentUser({ id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor, role: user.role })
    await refresh()
  }, [refresh])

  const logout = useCallback(() => {
    setToken(null)
    setAuthToken(null)
    setCurrentUser({ id: '', name: '', email: '', avatarColor: '', role: '' as Role })
    setMembers([])
    setProjects([])
    setBugs([])
    setNotifications([])
    setRecentActivity([])
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
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)))
    return updated
  }, [])

  const createBug = useCallback(
    async (payload: Partial<Bug>) => {
      const bug = await api.bugs.create(payload)
      setBugs((prev) => [bug, ...prev])
      setRecentActivity((prev) => [
        { id: `a-${Date.now()}`, message: `Bug ${bug.ref} created by ${currentUser.name}`, at: 'just now' },
        ...prev,
      ])
      return bug
    },
    [currentUser.name],
  )

  const createProject = useCallback(async (payload: Partial<Project>) => {
    const project = await api.projects.create(payload)
    setProjects((prev) => [project, ...prev])
    return project
  }, [])

  const addComment = useCallback(
    async (id: string, body: string, authorName = currentUser.name) => {
      const bug = await api.bugs.addComment(id, { authorKind: 'Developer', authorName, body })
      setBugs((prev) => prev.map((b) => (b.id === bug.id ? bug : b)))
      return bug
    },
    [currentUser.name],
  )

  const setBugStatus = useCallback(async (id: string, status: BugStatus) => {
    const bug = await api.bugs.setStatus(id, status)
    setBugs((prev) => prev.map((b) => (b.id === id ? bug : b)))
    return bug
  }, [])

  const assignBug = useCallback(async (id: string, assigneeIds: string[]) => {
    const bug = await api.bugs.patch(id, { assigneeIds })
    setBugs((prev) => prev.map((b) => (b.id === id ? bug : b)))
    return bug
  }, [])

  const analyzeBug = useCallback(
    async (id: string) => {
      const { bug, analysis } = await api.bugs.analyze(id)
      setBugs((prev) => prev.map((b) => (b.id === bug.id ? bug : b)))
      setNotifications((prev) => [
        { id: `n-${Date.now()}`, category: 'AI', message: `AI analysis completed for ${bug.ref}.`, at: 'just now', read: false, bugRef: bug.ref },
        ...prev,
      ])
      return analysis
    },
    [],
  )

  const markAllNotificationsRead = useCallback(
    () => api.notifications.markAllRead().then((list) => {
      setNotifications(list)
      return list
    }),
    [],
  )

  return (
    <DataContext.Provider
      value={{
        ready,
        bootstrapError,
        isAuthenticated: Boolean(authToken),
        currentUser,
        company,
        hasQA,
        setHasQA,
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
        addComment,
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
 * Projects the current role may open. Admins see everything;
 * QA and Developers are scoped to projects they are a member of.
 */
export function useVisibleProjects(role: string): Project[] {
  const { projects, currentUser } = useData()
  if (role === 'Admin') return projects
  return projects.filter((p) => p.memberIds.includes(currentUser.id))
}

/** Bugs the current role may see — all colleagues' bugs within visible projects. */
export function useVisibleBugs(role: string): Bug[] {
  const { bugs } = useData()
  const visibleIds = new Set(useVisibleProjects(role).map((p) => p.id))
  if (role === 'Admin') return bugs
  return bugs.filter((b) => visibleIds.has(b.projectId))
}

export function useBug(id: string | undefined) {
  const { bugs } = useData()
  return id ? bugs.find((b) => b.id === id) : undefined
}

export function useProjectsBugStats(projectId: string) {
  const { bugs } = useData()
  const projectBugs = bugs.filter((b) => b.projectId === projectId)
  return {
    projectBugs,
    openBugs: projectBugs.filter((b) => !['Resolved', 'Closed'].includes(b.status)).length,
    highSeverity: projectBugs.filter((b) => ['Critical', 'High'].includes(b.severity)).length,
    resolvedBugs: projectBugs.filter((b) => ['Resolved', 'Closed'].includes(b.status)).length,
    awaitingValidation: projectBugs.filter((b) => b.status === 'QA Validation').length,
  }
}