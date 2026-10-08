import { vi } from 'vitest'

/**
 * Stand-in for the `api` object from `@/lib/api`. Tests install it with:
 *
 *   vi.mock('@/lib/api', async (importOriginal) => {
 *     const actual = await importOriginal<typeof import('@/lib/api')>()
 *     return { ...actual, api: mockApi }
 *   })
 *
 * Keeping `actual` spread means every other export (ApiError, API_BASE) stays
 * real, so data-context's `instanceof ApiError` checks keep working.
 */
export const mockApi = {
  bootstrap: vi.fn(),
  auth: {
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
  },
  bugs: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    patch: vi.fn(),
    addComment: vi.fn(),
    analyze: vi.fn(),
    setStatus: vi.fn(),
  },
  projects: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addMember: vi.fn(),
  },
  company: {
    update: vi.fn(),
  },
  members: {
    list: vi.fn(),
    inviteByEmail: vi.fn(),
    remove: vi.fn(),
  },
  invites: {
    get: vi.fn(),
    accept: vi.fn(),
  },
  notifications: {
    list: vi.fn(),
    markAllRead: vi.fn(),
  },
}

const allMocks = [
  mockApi.bootstrap,
  ...Object.values(mockApi.auth),
  ...Object.values(mockApi.bugs),
  ...Object.values(mockApi.projects),
  mockApi.company.update,
  ...Object.values(mockApi.members),
  ...Object.values(mockApi.invites),
  ...Object.values(mockApi.notifications),
]

export function resetMockApi() {
  for (const fn of allMocks) {
    fn.mockReset()
  }
}
