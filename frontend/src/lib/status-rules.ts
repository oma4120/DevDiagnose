import type { BugStatus, Role } from './types'

export const ALL_STATUSES: BugStatus[] = [
  'Draft',
  'Submitted',
  'Assigned',
  'In Progress',
  'Resolved',
  'QA Validation',
  'Closed',
]

const DEVELOPER_TRANSITIONS: Partial<Record<BugStatus, BugStatus[]>> = {
  Draft: ['Submitted'],
  Submitted: ['In Progress'],
  Assigned: ['In Progress'],
  'In Progress': ['Resolved'],
  Resolved: ['In Progress'],
}

const QA_TRANSITIONS: Partial<Record<BugStatus, BugStatus[]>> = {
  Resolved: ['QA Validation', 'Closed', 'In Progress'],
  'QA Validation': ['Closed', 'In Progress'],
}

/** User-facing status name: without a QA workflow the stage is just 'Validation'. */
export function statusLabel(status: BugStatus | string, hasQA: boolean): string {
  return status === 'QA Validation' && !hasQA ? 'Validation' : status
}

export function allowedStatuses(opts: {
  status: BugStatus
  role: Role
  hasQA: boolean
  isTeamMember: boolean
  isReporter?: boolean
}): BugStatus[] {
  const { status, role, hasQA, isTeamMember, isReporter } = opts
  if (role === 'Admin') return ALL_STATUSES
  if (role === 'QA') return hasQA ? (QA_TRANSITIONS[status] ?? []) : []
  if (!hasQA && isReporter && (status === 'Resolved' || status === 'QA Validation'))
    return QA_TRANSITIONS[status] ?? []
  if (!isTeamMember) return []
  return DEVELOPER_TRANSITIONS[status] ?? []
}

/**
 * Roles that may read every project and bug. Mirrors UNRESTRICTED_ROLES in
 * backend/app/status_rules.py - QA belongs here, and the API already returns
 * QA the full dataset.
 */
export const UNRESTRICTED_ROLES: Role[] = ['Admin', 'QA']

export function seesAllProjects(role: Role): boolean {
  return UNRESTRICTED_ROLES.includes(role)
}

/**
 * Whether a bug is readable, mirroring can_view_bug on the server: membership of
 * the bug's project, or being its reporter or an assignee (so someone removed
 * from a team keeps the bugs they filed).
 *
 * `allowedProjectIds` is undefined for unrestricted roles.
 */
export function canViewBug(
  bug: { projectId: string; reporterId: string; assigneeIds?: string[] },
  userId: string,
  allowedProjectIds?: Set<string>,
): boolean {
  if (allowedProjectIds === undefined) return true
  if (allowedProjectIds.has(bug.projectId)) return true
  return bug.reporterId === userId || (bug.assigneeIds ?? []).includes(userId)
}
