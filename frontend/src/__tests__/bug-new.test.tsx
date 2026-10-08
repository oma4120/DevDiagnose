import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '@/test/api-mock'
import { DEV, makeBug, makeBootstrap, seedSession } from '@/test/fixtures'
import { currentPath, renderApp } from '@/test/render'

vi.mock('@/lib/api', async (importOriginal) => {
  const [actual, { mockApi: api }] = await Promise.all([
    importOriginal<typeof import('@/lib/api')>(),
    import('../test/api-mock'),
  ])
  return { ...actual, api }
})

describe('new bug report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks submission until the title and description are long enough', async () => {
    seedSession(makeBootstrap(DEV))
    renderApp('/bugs/new')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Title'), 'ab')
    await user.type(screen.getByLabelText('Description'), 'A perfectly fine description.')
    await user.click(screen.getByRole('button', { name: 'Submit & Analyze' }))

    expect(await screen.findByText('Check the highlighted fields')).toBeInTheDocument()
    expect(mockApi.bugs.create).not.toHaveBeenCalled()
    expect(currentPath()).toBe('/bugs/new')
  })

  it('reports the bug without letting the client set reporterId or status', async () => {
    seedSession(makeBootstrap(DEV))
    mockApi.bugs.create.mockResolvedValue(makeBug({ id: 'b9' }))
    mockApi.bugs.analyze.mockResolvedValue({ bug: makeBug({ id: 'b9' }), analysis: null })

    renderApp('/bugs/new')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Title'), 'Cart total is wrong')
    await user.type(screen.getByLabelText('Description'), 'The cart total ignores the discount code.')
    await user.click(screen.getByRole('button', { name: 'Submit & Analyze' }))

    await waitFor(() => expect(mockApi.bugs.create).toHaveBeenCalledTimes(1))
    const payload = mockApi.bugs.create.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({
      projectId: 'p1',
      title: 'Cart total is wrong',
      description: 'The cart total ignores the discount code.',
      assigneeIds: [],
    })
    // The API derives these from the session and the workflow.
    expect(payload).not.toHaveProperty('reporterId')
    expect(payload).not.toHaveProperty('status')
    await waitFor(() => expect(currentPath()).toBe('/bugs/b9'))
  })

  it('surfaces the API error when creation fails', async () => {
    seedSession(makeBootstrap(DEV))
    mockApi.bugs.create.mockRejectedValue(new Error('Only QA and Admins may report bugs'))

    renderApp('/bugs/new')
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Title'), 'Cart total is wrong')
    await user.type(screen.getByLabelText('Description'), 'The cart total ignores the discount code.')
    await user.click(screen.getByRole('button', { name: 'Submit & Analyze' }))

    expect(await screen.findByText('Only QA and Admins may report bugs')).toBeInTheDocument()
    expect(currentPath()).toBe('/bugs/new')
  })
})
