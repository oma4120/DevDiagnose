export type Role = 'Admin' | 'QA' | 'Developer'

export type BugStatus =
  | 'Draft'
  | 'Submitted'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'QA Validation'
  | 'Closed'

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low'

export type Category =
  | 'Frontend'
  | 'Backend'
  | 'Database'
  | 'API'
  | 'Authentication'
  | 'Security'
  | 'Performance'
  | 'UI/UX'
  | 'Other'

export type EvidenceType =
  | 'Screenshot'
  | 'Console Error'
  | 'API Response'
  | 'Server Log'
  | 'Stack Trace'
  | 'Relevant Code'
  | 'Other'

export interface Member {
  id: string
  name: string
  firstName?: string
  lastName?: string
  email: string
  role: Role
  avatarColor: string
  status: 'Active' | 'Invited' | 'Inactive'
  assignedBugs: number
  resolvedBugs: number
  lastActive: string
  protected?: boolean
}

export interface InviteStatus {
  valid: boolean
  email: string
  expiresAt: string
  name: string
}

export interface InviteResult {
  email: string
  inviteLink: string
  expiresAt: string
  emailSent: boolean
}

export interface BusinessRule {
  id: string
  title: string
  description: string
}

export interface Project {
  id: string
  name: string
  description: string
  purpose: string
  type: string
  frontend: string[]
  backend: string[]
  database: string[]
  services: string[]
  auth: string[]
  deployment: string[]
  architecture: string
  modules: string[]
  apiPatterns: string
  environments: { development: string; staging: string; production: string }
  browsers: string[]
  platforms: string[]
  businessRules: BusinessRule[]
  testingTools: string[]
  conventions: string
  constraints: string
  repoUrl?: string
  docsUrl?: string
  memberIds: string[]
  openBugs: number
  highSeverity: number
  resolvedBugs: number
  awaitingValidation: number
  updatedAt: string
}

export interface Evidence {
  id: string
  type: EvidenceType
  title: string
  content: string
  language?: string
  addedBy: string
  addedAt: string
  fileUrl?: string
  metadata?: Record<string, unknown>
}

export type CommentAuthorKind = 'QA' | 'Developer' | 'System' | 'AI'

export interface Comment {
  id: string
  authorKind: CommentAuthorKind
  authorName: string
  body: string
  at: string
}

export interface SuggestedFix {
  summary: string
  steps: string[]
  code: string | null
}

export interface AIAnalysis {
  id: string
  version: number
  model: string
  generatedAt: string
  contextVersion: string
  classification: string
  severityRec: Severity
  priorityRec: Priority
  rootCause: string
  explanation: string
  investigationSteps: string[]
  suggestedFix: SuggestedFix
  recommendedTests: string[]
  confidence: number
  uncertainty: string | null
  evidenceConsidered: string[]
  inputContext?: Record<string, unknown>
}

export interface WorkflowEvent {
  id: string
  kind: 'created' | 'assigned' | 'ai' | 'comment' | 'status' | 'resolved' | 'validated' | 'closed'
  label: string
  actor: string
  at: string
}

export interface Bug {
  id: string
  ref: string
  title: string
  description: string
  projectId: string
  status: BugStatus
  severity: Severity
  priority: Priority
  category: Category
  reporterId: string
  assigneeIds: string[]
  validatorId?: string
  needsAttention?: boolean
  stepsToReproduce: string[]
  expectedResult: string
  actualResult: string
  environment: string
  browserDevice: string
  createdAt: string
  updatedAt: string
  evidence: Evidence[]
  comments: Comment[]
  analyses: AIAnalysis[]
  timeline: WorkflowEvent[]
  resolvedBy?: string
  resolvedAt?: string
  closedAt?: string
}

export interface NotificationItem {
  id: string
  category: 'Assignment' | 'AI' | 'Validation' | 'System'
  message: string
  at: string
  read: boolean
  bugRef?: string
}

export interface ActivityItem {
  id: string
  message: string
  at: string
}