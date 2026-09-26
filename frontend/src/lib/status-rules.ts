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
