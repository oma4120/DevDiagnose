import type {
  ActivityItem,
  AIAnalysis,
  Bug,
  BugStatus,
  Comment,
  Company,
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
  company: Company
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
      const raw = body?.detail
      if (typeof raw === 'string') {
        detail = raw
      } else if (Array.isArray(raw)) {
        // FastAPI/pydantic validation errors: show the first readable message.
        const first = raw.find((e) => typeof e?.msg === 'string')
        detail = first ? first.msg : JSON.stringify(raw)
      } else if (raw) {
        detail = JSON.stringify(raw)
      }
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
    changePassword: (payload: { currentPassword: string; newPassword: string }) =>
      http<{ ok: boolean }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(payload),
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
    update: (id: string, fields: Partial<Project>) =>
      http<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
    addMember: (projectId: string, memberId: string) =>
      http<Project>(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ memberId }) }),
  },

  company: {
    update: (payload: { name?: string; workspace?: string; hasQA?: boolean; logo?: string | null }) =>
      http<Company>('/company', { method: 'PATCH', body: JSON.stringify(payload) }),
  },

  members: {
    list: () => http<Member[]>('/members'),
    inviteByEmail: (payload: { email: string; role: Role; firstName?: string; lastName?: string }) =>
      http<InviteResult>('/members', { method: 'POST', body: JSON.stringify(payload) }),
    remove: (id: string) =>
      http<{ deleted: boolean; id: string }>(`/members/${id}`, { method: 'DELETE' }),
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