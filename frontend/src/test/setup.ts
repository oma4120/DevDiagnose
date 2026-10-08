import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom does not implement media queries; the sidebar listens to
// (min-width: 1024px) to decide between rail and full layouts.
window.matchMedia = ((query: string) => {
  const listeners = new Set<(e: { matches: boolean }) => void>()
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: (_: string, listener: (e: { matches: boolean }) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_: string, listener: (e: { matches: boolean }) => void) => {
      listeners.delete(listener)
    },
    addListener: (listener: (e: { matches: boolean }) => void) => {
      listeners.add(listener)
    },
    removeListener: (listener: (e: { matches: boolean }) => void) => {
      listeners.delete(listener)
    },
    dispatchEvent: () => true,
    // Tests flip this to simulate a viewport change.
    __setMatches: (value: boolean) => {
      for (const listener of listeners) listener({ matches: value })
    },
  } as unknown as MediaQueryList
}) as typeof window.matchMedia
