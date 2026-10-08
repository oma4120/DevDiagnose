import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '@/test/api-mock'
import { seedSignedOut } from '@/test/fixtures'
import { renderApp } from '@/test/render'

vi.mock('@/lib/api', async (importOriginal) => {
  const [actual, { mockApi: api }] = await Promise.all([
    importOriginal<typeof import('@/lib/api')>(),
    import('../test/api-mock'),
  ])
  return { ...actual, api }
})

const TOKEN = 'tok-abcdefghijklmnopqrstuvwxyz'

function inviteInfo(over: Partial<Record<string, unknown>> = {}) {
  return {
    valid: true,
    email: 'newhire@northwind.dev',
    expiresAt: 'in 3 days',
    name: 'Nina New',
    ...over,
  }
}

async function fillPasswords(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.type(screen.getByLabelText('Password'), password)
  await user.type(screen.getByLabelText('Confirm password'), password)
}

describe('invite acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the unavailable state for an unknown or expired token', async () => {
    seedSignedOut()
    mockApi.invites.get.mockRejectedValue(new Error('404 Not Found'))

    renderApp(`/invite/${TOKEN}`)

    expect(
      await screen.findByRole('heading', { name: 'Invitation unavailable' }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('keeps submit disabled until every password rule passes', async () => {
    seedSignedOut()
    mockApi.invites.get.mockResolvedValue(inviteInfo())

    renderApp(`/invite/${TOKEN}`)
    const user = userEvent.setup()
    await screen.findByLabelText('First name')

    await fillPasswords(user, 'weak')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    expect(mockApi.invites.accept).not.toHaveBeenCalled()
  })

  it('requires first and last name before accepting', async () => {
    seedSignedOut()
    mockApi.invites.get.mockResolvedValue(inviteInfo())

    renderApp(`/invite/${TOKEN}`)
    const user = userEvent.setup()
    const firstName = await screen.findByLabelText('First name')
    const lastName = screen.getByLabelText('Last name')

    await user.clear(firstName)
    await user.clear(lastName)
    await fillPasswords(user, 'Str0ng!pass')
    // The name fields are `required`, so the browser-level constraint would
    // block a real click; submit the form to reach the app's own guard.
    fireEvent.submit(document.querySelector('form')!)

    expect(await screen.findByText('First and last name are required.')).toBeInTheDocument()
    expect(mockApi.invites.accept).not.toHaveBeenCalled()
  })

  it('accepts the invitation with the prefilled identity', async () => {
    seedSignedOut()
    mockApi.invites.get.mockResolvedValue(inviteInfo())
    mockApi.invites.accept.mockResolvedValue(undefined)

    renderApp(`/invite/${TOKEN}`)
    const user = userEvent.setup()
    await screen.findByLabelText('First name')
    expect(screen.getByLabelText('First name')).toHaveValue('Nina')
    expect(screen.getByLabelText('Last name')).toHaveValue('New')

    await fillPasswords(user, 'Str0ng!pass')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(mockApi.invites.accept).toHaveBeenCalledWith({
        token: TOKEN,
        firstName: 'Nina',
        lastName: 'New',
        password: 'Str0ng!pass',
      })
    })
  })

  it('surfaces the server error when acceptance fails', async () => {
    seedSignedOut()
    mockApi.invites.get.mockResolvedValue(inviteInfo())
    mockApi.invites.accept.mockRejectedValue(new Error('This invite has already been used.'))

    renderApp(`/invite/${TOKEN}`)
    const user = userEvent.setup()
    await screen.findByLabelText('First name')

    await fillPasswords(user, 'Str0ng!pass')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('This invite has already been used.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })
})
