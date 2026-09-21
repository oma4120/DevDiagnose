import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@/lib/api'
import * as seed from '@/lib/seed'
import type {
  ActivityItem,
  AIAnalysis,
  Bug,
  BugStatus,
  Member,
  NotificationItem,
  Project,
} from '@/lib/types'

export interface DataContextValue {
  ready: boolean
  isFallback: boolean
  currentUser: { id: string; name: string; email: string; avatarColor: string }
  company: { name: string; workspace: string; hasQA: boolean }
  members: Member[]
  projects: Project[]
  bugs: Bug[]
  notifications: NotificationItem[]
  recentActivity: ActivityItem[]
  refresh: () => Promise<void>
  createBug: (payload: Partial<Bug>) => Promise<Bug>
  createProject: (payload: Partial<Project>) => Promise<Project>
  addComment: (id: string, body: string, authorName?: string) => Promise<Bug>
  setBugStatus: (id: string, status: BugStatus) => Promise<Bug>
  analyzeBug: (id: string) => Promise<AIAnalysis>
  markAllNotificationsRead: () => Promise<NotificationItem[]>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState(seed.currentUser)
  const [company, setCompany] = useState(seed.company)
  const [members, setMembers] = useState<Member[]>(seed.members)
  const [projects, setProjects] = useState<Project[]>(seed.projects)
  const [bugs, setBugs] = useState<Bug[]>(seed.bugs)
  const [notifications, setNotifications] = useState<NotificationItem[]>(seed.notifications)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>(seed.recentActivity)
  const [ready, setReady] = useState(false)
  const [isFallback, setIsFallback] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.bootstrap()
      setCurrentUser(data.currentUser)
      setCompany(data.company)
      setMembers(data.members)
      setProjects(data.projects)
      setBugs(data.bugs)
      setNotifications(data.notifications)
      setRecentActivity(data.recentActivity)
      setIsFallback(false)
    } catch {
      setIsFallback(true)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

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
    setBugs((prev) => prev.map((b) => (b.id === bug.id ? bug : b)))
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
        isFallback,
        currentUser,
        company,
        members,
        projects,
        bugs,
        notifications,
        recentActivity,
        refresh,
        createBug,
        createProject,
        addComment,
        setBugStatus,
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