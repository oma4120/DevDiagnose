import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '@/test/api-mock'
import { ADMIN, DEV, QA, makeBug, makeBootstrap, makeProject, seedSession } from '@/test/fixtures'
import { renderApp } from '@/test/render'

vi.mock('@/lib/api', async (importOriginal) => {
  const [actual, { mockApi: api }] = await Promise.all([
    importOriginal<typeof import('@/lib/api')>(),
    import('../test/api-mock'),
  ])
  return { ...actual, api }
})

/** The status <select> lives in the "Status" card. */
async function statusSelect(): Promise<HTMLSelectElement> {
  const heading = await screen.findByRole('heading', { name: 'Status' })
  const card = heading.parentElement?.parentElement
  return within(card as HTMLElement).getByRole('combobox') as HTMLSelectElement
}

function optionNames(select: HTMLSelectElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((o) => o.textContent ?? '')
}

describe('bug workflow transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers a Developer only their transitions and applies the chosen one', async () => {
    seedSession(makeBootstrap(DEV))
    mockApi.bugs.setStatus.mockResolvedValue(makeBug({ status: 'Resolved' }))

    renderApp('/bugs/b1')
    const user = userEvent.setup()
    const select = await statusSelect()

    const names = optionNames(select)
    expect(names).toContain('Resolved')
    expect(names).not.toContain('Closed')

    await user.selectOptions(select, 'Resolved')

    await waitFor(() => expect(mockApi.bugs.setStatus).toHaveBeenCalledWith('b1', 'Resolved'))
    expect(await screen.findByText('Status updated')).toBeInTheDocument()
  })

  it('offers an Admin every status in the workflow', async () => {
    seedSession(makeBootstrap(ADMIN))
    renderApp('/bugs/b1')

    const names = optionNames(await statusSelect())
    expect(names).toContain('Resolved')
    expect(names).toContain('Closed')
    expect(names).toContain('QA Validation')
  })

  it('hides status actions from a Developer outside the project team', async () => {
    seedSession(
      makeBootstrap(DEV, {
        bugs: [makeBug({ reporterId: DEV.id })],
        projects: [makeProject({ memberIds: [ADMIN.id, QA.id] })],
      }),
    )

    renderApp('/bugs/b1')
    const heading = await screen.findByRole('heading', { name: 'Status' })
    const card = heading.parentElement?.parentElement
    expect(screen.getByText('No status actions available for your role.')).toBeInTheDocument()
    expect(within(card as HTMLElement).queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('lets QA validate a resolved bug', async () => {
    seedSession(makeBootstrap(QA, { bugs: [makeBug({ status: 'Resolved' })] }))
    mockApi.bugs.setStatus.mockResolvedValue(makeBug({ status: 'Closed' }))

    renderApp('/bugs/b1')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Validate' }))

    await waitFor(() => expect(mockApi.bugs.setStatus).toHaveBeenCalledWith('b1', 'Closed'))
    expect(await screen.findByText('Status updated')).toBeInTheDocument()
  })

  it('does not offer Validate to the Developer who resolved it', async () => {
    seedSession(makeBootstrap(DEV, { bugs: [makeBug({ status: 'Resolved' })] }))

    renderApp('/bugs/b1')

    expect(await screen.findByRole('heading', { name: 'Status' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Validate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  })

  it('shows the API error when the backend rejects a transition', async () => {
    seedSession(makeBootstrap(DEV))
    mockApi.bugs.setStatus.mockRejectedValue(
      new Error('A developer may not close their own bug'),
    )

    renderApp('/bugs/b1')
    const user = userEvent.setup()
    const select = await statusSelect()
    await user.selectOptions(select, 'Resolved')

    expect(await screen.findByText('Could not update status')).toBeInTheDocument()
    expect(screen.getByText('A developer may not close their own bug')).toBeInTheDocument()
  })
})
