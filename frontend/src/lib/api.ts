import type {
  ActivityItem,
  AIAnalysis,
  Bug,
  BugStatus,
  Company,
  InviteResult,
  InviteStatus,
  Member,
  NotificationItem,
  Project,
  Role,
} from './types'

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

// The JWT lives in an HttpOnly cookie set by the backend, so JavaScript never
// sees it; `credentials: 'include'` carries it automatically.
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
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
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> | undefined) }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' })
  if (res.status === 401 && path !== '/bootstrap' && window.location.pathname !== '/login') {
    // Session expired mid-app: reload into the login route with clean state.
    // The bootstrap 401 is left to the caller - on first load it simply means
    // "not signed in" and must render the login page, not an error screen.
    window.location.assign('/login')
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
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

export const api = {
  bootstrap: () => http<BootstrapData>('/bootstrap'),

  auth: {
    login: (email: string, password: string) =>
      http<{ user: Member }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () =>
      http<{ ok: boolean }>('/auth/logout', {
        method: 'POST',
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
    // `reporterId` and `status` are intentionally not sent: the API derives the
    // reporter from the token and always starts a report at Submitted.
    create: (payload: Omit<Partial<Bug>, 'reporterId' | 'status'>) =>
      http<Bug>('/bugs', { method: 'POST', body: JSON.stringify(payload) }),
    patch: (id: string, fields: Partial<Bug>) =>
      http<Bug>(`/bugs/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
    // The API derives authorName/authorKind from the token, so posting as
    // another member is not possible.
    addComment: (id: string, body: string) =>
      http<Bug>(`/bugs/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
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