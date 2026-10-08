import { ApiError } from '@/lib/api'
import type { BootstrapData } from '@/lib/api'
import type { Bug, Company, Member, Project, Role } from '@/lib/types'
import { mockApi, resetMockApi } from './api-mock'

export interface TestUser {
  id: string
  name: string
  email: string
  avatarColor: string
  role: Role
}

export const ADMIN: TestUser = {
  id: 'u-admin',
  name: 'Ada Admin',
  email: 'admin@northwind.dev',
  avatarColor: '#4f46e5',
  role: 'Admin',
}

export const DEV: TestUser = {
  id: 'u-dev',
  name: 'Dan Dev',
  email: 'dan@northwind.dev',
  avatarColor: '#0891b2',
  role: 'Developer',
}

export const QA: TestUser = {
  id: 'u-qa',
  name: 'Quinn QA',
  email: 'quinn@northwind.dev',
  avatarColor: '#059669',
  role: 'QA',
}

export function makeMember(user: TestUser, over: Partial<Member> = {}): Member {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    status: 'Active',
    assignedBugs: 1,
    resolvedBugs: 0,
    lastActive: 'just now',
    ...over,
  }
}

export function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Storefront',
    description: 'Customer-facing store.',
    purpose: 'Sell things to customers',
    type: 'Web',
    frontend: [],
    backend: [],
    database: [],
    services: [],
    auth: [],
    deployment: [],
    architecture: 'Modular monolith',
    modules: ['checkout', 'cart'],
    apiPatterns: 'REST',
    environments: {
      development: 'http://localhost:5173',
      staging: 'https://staging.northwind.dev',
      production: 'https://northwind.dev',
    },
    browsers: [],
    platforms: [],
    businessRules: [],
    testingTools: [],
    conventions: '',
    constraints: '',
    memberIds: [ADMIN.id, DEV.id, QA.id],
    openBugs: 1,
    highSeverity: 0,
    resolvedBugs: 0,
    awaitingValidation: 0,
    updatedAt: '2h ago',
    ...over,
  }
}

export function makeBug(over: Partial<Bug> = {}): Bug {
  return {
    id: 'b1',
    ref: '#1001',
    title: 'Checkout crashes when the cart is empty',
    description: 'Opening checkout with an empty cart throws a TypeError in the cart summary.',
    projectId: 'p1',
    status: 'In Progress',
    severity: 'High',
    priority: 'High',
    category: 'Frontend',
    reporterId: ADMIN.id,
    assigneeIds: [DEV.id],
    stepsToReproduce: ['Empty the cart', 'Open checkout'],
    expectedResult: 'A friendly empty-cart message',
    actualResult: 'Blank page and a console error',
    environment: 'staging',
    browserDevice: 'Chrome 128',
    createdAt: '2 days ago',
    updatedAt: '1h ago',
    evidence: [],
    comments: [],
    analyses: [],
    timeline: [
      { id: 'w1', kind: 'created', label: 'Bug reported', actor: ADMIN.name, at: '2 days ago' },
      { id: 'w2', kind: 'status', label: 'Moved to In Progress', actor: DEV.name, at: '1h ago' },
    ],
    ...over,
  }
}

export function makeCompany(over: Partial<Company> = {}): Company {
  return {
    name: 'Northwind',
    workspace: 'northwind',
    hasQA: true,
    logo: null,
    ...over,
  }
}

export function makeBootstrap(user: TestUser, over: Partial<BootstrapData> = {}): BootstrapData {
  return {
    currentUser: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      role: user.role,
    },
    company: makeCompany(),
    members: [makeMember(ADMIN), makeMember(DEV), makeMember(QA)],
    projects: [makeProject()],
    bugs: [makeBug()],
    notifications: [],
    recentActivity: [{ id: 'a1', message: `${DEV.name} moved #1001 to In Progress`, at: '1h ago' }],
    ...over,
  }
}

/** No cookie on the server: bootstrap answers 401, the app shows /login. */
export function seedSignedOut() {
  resetMockApi()
  mockApi.bootstrap.mockRejectedValue(new ApiError('Unauthorized', 401))
  mockApi.auth.logout.mockResolvedValue(undefined)
}

/** Signed in: bootstrap resolves workspace data for `user`. */
export function seedSession(data: BootstrapData) {
  resetMockApi()
  mockApi.bootstrap.mockResolvedValue(data)
  mockApi.auth.logout.mockResolvedValue(undefined)
}
