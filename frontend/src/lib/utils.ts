import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Bug } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const parseStamp = (value?: string): number => {
  const parsed = Date.parse((value ?? '').replace(' · ', ' '))
  return Number.isNaN(parsed) ? 0 : parsed
}

/** Newest first, using closedAt (backend format "Sep 26, 2026 · 01:49"). */
export function byClosedDesc(a: Bug, b: Bug): number {
  return parseStamp(b.closedAt) - parseStamp(a.closedAt)
}