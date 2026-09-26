/**
 * Form rules shared by the pages. Each rule mirrors a backend schema rule in
 * backend/app/schemas.py, so what the UI promises is what the API enforces.
 */

export const RULES = {
  bugTitle: { min: 4, max: 200 },
  bugDescription: { min: 10, max: 20000 },
  projectName: { min: 2, max: 80 },
  companyName: { min: 2, max: 80 },
  workspace: { min: 3, max: 40 },
  comment: { min: 1, max: 5000 },
  evidenceTitle: { max: 120 },
  repoUrl: { max: 500 },
  /** Data-URL string length caps, mirroring schemas.py MAX_DATA_URL / the logo rule. */
  evidenceImage: { max: 1_500_000 },
  companyLogo: { max: 2_000_000 },
} as const

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const URL_RE = /^https?:\/\/\S+$/i

/** First failing message, or null when the value is acceptable. */
export function checkLength(value: string, min: number, label: string, max?: number): string | null {
  const text = value.trim()
  const unit = min === 1 ? 'character' : 'characters'
  if (text.length < min) return `${label} must be at least ${min} ${unit}`
  if (max !== undefined && text.length > max) return `${label} must be at most ${max} characters`
  return null
}

/** A bug report needs a real title and a description the AI can work with. */
export function checkBugReport(title: string, description: string): string | null {
  return (
    checkLength(title, RULES.bugTitle.min, 'Title', RULES.bugTitle.max) ??
    checkLength(description, RULES.bugDescription.min, 'Description', RULES.bugDescription.max)
  )
}

export function checkProjectName(name: string): string | null {
  return checkLength(name, RULES.projectName.min, 'Project name', RULES.projectName.max)
}

export function checkCompanyName(name: string): string | null {
  return checkLength(name, RULES.companyName.min, 'Company name', RULES.companyName.max)
}

/** Workspace URL segment: lowercase letters, numbers and hyphens. */
export function checkWorkspace(slug: string): string | null {
  const text = slug.trim()
  if (text.length < RULES.workspace.min || text.length > RULES.workspace.max)
    return `Workspace must be ${RULES.workspace.min}-${RULES.workspace.max} characters`
  if (!SLUG_RE.test(text))
    return 'Workspace can only use lowercase letters, numbers and hyphens (e.g. northwind)'
  return null
}

export function checkEmail(email: string): string | null {
  return EMAIL_RE.test(email.trim()) ? null : 'Enter a valid email address (e.g. name@company.com)'
}

/** Empty is allowed (the link is optional); anything else must be http(s). */
export function checkUrl(value: string, label: string): string | null {
  const text = value.trim()
  if (!text) return null
  if (!URL_RE.test(text)) return `${label} must start with http:// or https://`
  if (text.length > RULES.repoUrl.max) return `${label} must be at most ${RULES.repoUrl.max} characters`
  return null
}

/**
 * A pasted or attached image, as a data URL. The API compares the *encoded
 * string* length, so this check has to use the same number - checking decoded
 * bytes here would let the submit fail with a 422 after the upload.
 */
export function checkImageDataUrl(dataUrl: string, label = 'Image', max: number = RULES.evidenceImage.max): string | null {
  if (!dataUrl.startsWith('data:image/')) return `${label} must be an image data URL`
  if (dataUrl.length > max) return `${label} is too large (max ~${Math.round(max / 1_000_000 * 10) / 10} MB)`
  return null
}

/** Pull the human message out of a backend failure. */
export function errorMessage(err: unknown, fallback = 'Please try again.'): string {
  if (err instanceof Error && err.message && !/^\d{3} /.test(err.message)) return err.message
  return fallback
}
