import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { mockApi, resetMockApi } from '@/test/api-mock'
import { ADMIN, DEV, QA, makeBootstrap, seedSession, seedSignedOut } from '@/test/fixtures'
import { currentPath, renderApp } from '@/test/render'

vi.mock('@/lib/api', async (importOriginal) => {
  const [actual, { mockApi: api }] = await Promise.all([
    importOriginal<typeof import('@/lib/api')>(),
    import('../test/api-mock'),
  ])
  return { ...actual, api }
})

describe('route protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects signed-out visitors to /login', async () => {
    seedSignedOut()
    renderApp('/bugs')
    await waitFor(() => expect(currentPath()).toBe('/login'))
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('redirects unknown routes to /login', async () => {
    seedSignedOut()
    renderApp('/no-such-page')
    await waitFor(() => expect(currentPath()).toBe('/login'))
  })

  it('shows the workspace error screen when bootstrap fails for a non-auth reason', async () => {
    resetMockApi()
    mockApi.bootstrap.mockRejectedValue(new Error('backend exploded'))
    renderApp('/dashboard')
    expect(await screen.findByText('Could not load your workspace')).toBeInTheDocument()
    expect(screen.getByText('backend exploded')).toBeInTheDocument()
    expect(currentPath()).toBe('/dashboard')
  })

  it('lets a signed-in Developer reach /bugs', async () => {
    seedSession(makeBootstrap(DEV))
    renderApp('/bugs')
    expect(await screen.findByRole('heading', { name: 'Bugs' })).toBeInTheDocument()
    expect(currentPath()).toBe('/bugs')
  })

  it('lets an Admin open /employees', async () => {
    seedSession(makeBootstrap(ADMIN))
    renderApp('/employees')
    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument()
    expect(currentPath()).toBe('/employees')
  })

  it('bounces a Developer from /employees back to the dashboard', async () => {
    seedSession(makeBootstrap(DEV))
    renderApp('/employees')
    await waitFor(() => expect(currentPath()).toBe('/dashboard'))
    expect(screen.queryByRole('heading', { name: 'Employees' })).not.toBeInTheDocument()
  })

  it('lets QA open /my-work', async () => {
    seedSession(makeBootstrap(QA))
    renderApp('/my-work')
    expect(
      await screen.findByRole('heading', { name: 'My Work', level: 1 }),
    ).toBeInTheDocument()
  })

  it('bounces an Admin from /my-work (QA/Developer route)', async () => {
    seedSession(makeBootstrap(ADMIN))
    renderApp('/my-work')
    await waitFor(() => expect(currentPath()).toBe('/dashboard'))
    // The dashboard also has a "My Work" card (h3); the page heading is the h1.
    expect(screen.queryByRole('heading', { name: 'My Work', level: 1 })).not.toBeInTheDocument()
  })
})
