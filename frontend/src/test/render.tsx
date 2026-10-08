import { render, screen } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { App } from '@/App'
import { ToastProvider } from '@/components/ui/toast'
import { DataProvider } from '@/lib/data-context'

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

/**
 * Renders the whole app (provider stack from main.tsx, minus StrictMode and
 * the real router) at `initialPath`. Assert on `currentPath()` for redirects.
 */
export function renderApp(initialPath = '/dashboard'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <DataProvider>
          <App />
          <LocationDisplay />
        </DataProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

export function currentPath(): string {
  return screen.getByTestId('location').textContent ?? ''
}
