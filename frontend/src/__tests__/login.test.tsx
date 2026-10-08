import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/lib/api'
import { mockApi } from '@/test/api-mock'
import { ADMIN, makeBootstrap, seedSession, seedSignedOut } from '@/test/fixtures'
import { currentPath, renderApp } from '@/test/render'

vi.mock('@/lib/api', async (importOriginal) => {
  const [actual, { mockApi: api }] = await Promise.all([
    importOriginal<typeof import('@/lib/api')>(),
    import('../test/api-mock'),
  ])
  return { ...actual, api }
})

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup()
  const emailInput = screen.getByLabelText('Email')
  const passwordInput = screen.getByLabelText('Password')
  // Inputs start readOnly to keep password managers from auto-filling them.
  await user.click(emailInput)
  await user.type(emailInput, email)
  await user.click(passwordInput)
  await user.type(passwordInput, password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  return user
}

describe('login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects an already signed-in visitor to the dashboard', async () => {
    seedSession(makeBootstrap(ADMIN))
    renderApp('/login')
    await waitFor(() => expect(currentPath()).toBe('/dashboard'))
  })

  it('rejects a malformed email without calling the API', async () => {
    seedSignedOut()
    renderApp('/login')
    // Passes native input[type=email] validation but not the stricter
    // workspace rule (needs a dot + TLD), so the app's own guard runs.
    await fillAndSubmit('dan@localhost', 'whatever1')
    expect(
      await screen.findByText('Enter a valid email address (e.g. name@company.com)'),
    ).toBeInTheDocument()
    expect(mockApi.auth.login).not.toHaveBeenCalled()
    expect(currentPath()).toBe('/login')
  })

  it('submits credentials, refreshes the session and lands on the dashboard', async () => {
    seedSignedOut()
    mockApi.bootstrap
      .mockRejectedValueOnce(new ApiError('Unauthorized', 401))
      .mockResolvedValue(makeBootstrap(ADMIN))
    mockApi.auth.login.mockResolvedValue({
      user: {
        id: ADMIN.id,
        name: ADMIN.name,
        email: ADMIN.email,
        avatarColor: ADMIN.avatarColor,
        role: ADMIN.role,
      },
    })

    renderApp('/login')
    await fillAndSubmit('admin@northwind.dev', 'S3cret!pass')

    await waitFor(() => {
      expect(mockApi.auth.login).toHaveBeenCalledWith('admin@northwind.dev', 'S3cret!pass')
    })
    await waitFor(() => expect(currentPath()).toBe('/dashboard'))
    expect(mockApi.bootstrap).toHaveBeenCalledTimes(2)
  })

  it('shows the server error and stays on the login page when credentials are wrong', async () => {
    seedSignedOut()
    mockApi.auth.login.mockRejectedValue(new Error('Invalid email or password'))

    renderApp('/login')
    await fillAndSubmit('admin@northwind.dev', 'wrong-password')

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(currentPath()).toBe('/login')
  })
})
