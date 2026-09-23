import type {
  ActivityItem,
  AIAnalysis,
  Bug,
  BugStatus,
  Comment,
  InviteResult,
  InviteStatus,
  Member,
  NotificationItem,
  Project,
  Role,
} from './types'

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

const TOKEN_KEY = 'dd_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

export interface BootstrapData {
  currentUser: { id: string; name: string; email: string; avatarColor: string; role: Role }
  company: { name: string; workspace: string; hasQA: boolean }
  members: Member[]
  projects: Project[]
  bugs: Bug[]
  notifications: NotificationItem[]
  recentActivity: ActivityItem[]
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { headers, ...init })
  if (res.status === 401) {
    setToken(null)
    if (window.location.pathname !== '/login') {
      window.location.assign('/login')
    }
  }
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

  auth: {
    login: (email: string, password: string) =>
      http<{ token: string; user: Member }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },

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
    inviteByEmail: (email: string, role: Role) =>
      http<InviteResult>('/members', { method: 'POST', body: JSON.stringify({ email, role }) }),
    addByName: (payload: { firstName: string; lastName: string; email: string; role: Role }) =>
      http<{ member: Member }>('/members/direct', { method: 'POST', body: JSON.stringify(payload) }),
  },

  invites: {
    get: (token: string) => http<InviteStatus>(`/invites/${token}`),
    accept: (payload: { token: string; firstName: string; lastName: string; password: string }) =>
      http<{ accepted: boolean; email: string }>('/invites/accept', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  notifications: {
    list: () => http<NotificationItem[]>('/notifications'),
    markAllRead: () =>
      http<NotificationItem[]>('/notifications/read-all', { method: 'POST' }),
  },
}