import type {
  ActivityItem,
  AIAnalysis,
  Bug,
  BugStatus,
  Comment,
  Member,
  NotificationItem,
  Project,
} from './types'

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export interface BootstrapData {
  currentUser: { id: string; name: string; email: string; avatarColor: string }
  company: { name: string; workspace: string; hasQA: boolean }
  members: Member[]
  projects: Project[]
  bugs: Bug[]
  notifications: NotificationItem[]
  recentActivity: ActivityItem[]
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* ignore parse error */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const api = {
  bootstrap: () => http<BootstrapData>('/bootstrap'),

  bugs: {
    list: () => http<Bug[]>('/bugs'),
    get: (id: string) => http<Bug>(`/bugs/${id}`),
    create: (payload: Partial<Bug>) =>
      http<Bug>('/bugs', { method: 'POST', body: JSON.stringify(payload) }),
    patch: (id: string, fields: Partial<Bug>) =>
      http<Bug>(`/bugs/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
    addComment: (id: string, comment: { authorKind: Comment['authorKind']; authorName: string; body: string }) =>
      http<Bug>(`/bugs/${id}/comments`, { method: 'POST', body: JSON.stringify(comment) }),
    analyze: (id: string) =>
      http<{ bug: Bug; analysis: AIAnalysis }>(`/bugs/${id}/analyze`, { method: 'POST' }),
    setStatus: (id: string, status: BugStatus) =>
      http<Bug>(`/bugs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },

  projects: {
    list: () => http<Project[]>('/projects'),
    get: (id: string) => http<Project>(`/projects/${id}`),
    create: (payload: Partial<Project>) =>
      http<Project>('/projects', { method: 'POST', body: JSON.stringify(payload) }),
  },

  members: {
    list: () => http<Member[]>('/members'),
  },

  notifications: {
    list: () => http<NotificationItem[]>('/notifications'),
    markAllRead: () =>
      http<NotificationItem[]>('/notifications/read-all', { method: 'POST' }),
  },
}