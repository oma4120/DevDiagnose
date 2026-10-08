import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { ADMIN, DEV, QA, makeBootstrap, seedSession } from '@/test/fixtures'
import { renderApp } from '@/test/render'

vi.mock('@/lib/api', async (importOriginal) => {
  const [actual, { mockApi: api }] = await Promise.all([
    importOriginal<typeof import('@/lib/api')>(),
    import('../test/api-mock'),
  ])
  return { ...actual, api }
})

describe('role-filtered navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Administration links only to Admins', async () => {
    seedSession(makeBootstrap(ADMIN))
    renderApp('/dashboard')

    expect(await screen.findByRole('link', { name: 'Employees' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Company' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it('hides Administration links from Developers', async () => {
    seedSession(makeBootstrap(DEV))
    renderApp('/dashboard')

    expect(await screen.findByRole('link', { name: 'Bugs' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Company' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Administration' })).not.toBeInTheDocument()
  })

  it('shows My Work to QA and Developers', async () => {
    seedSession(makeBootstrap(QA))
    renderApp('/dashboard')
    expect(await screen.findByRole('link', { name: 'My Work' })).toBeInTheDocument()
  })

  it('hides My Work from Admins', async () => {
    seedSession(makeBootstrap(ADMIN))
    renderApp('/dashboard')

    expect(await screen.findByRole('link', { name: 'Bugs' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My Work' })).not.toBeInTheDocument()
  })

  it('never exposes Administration links to QA', async () => {
    seedSession(makeBootstrap(QA))
    renderApp('/dashboard')

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Company' })).not.toBeInTheDocument()
  })
})
