import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { buildHistory, MAX_HISTORY_TURNS } from '@/hooks/useAssistantChat'
import { saveSession } from '@/services/tokenStorage'
import { analyzeProblem } from '@/services/assistantService'

vi.mock('@/services/assistantService', () => ({
  analyzeProblem: vi.fn(),
  draftBooking: vi.fn(),
}))

function answer(summary) {
  return {
    category: { id: 1, name: 'Electrician' },
    category_fallback: false,
    urgency: 'low',
    summary,
    safety_tips: ['Switch off the fan.', 'Do not touch the blades.'],
    cost_estimate: null,
    language: 'en',
    sources: [],
    providers: {
      area: null, area_matched: null, matches: [], message: 'No providers.',
      alternatives: { other_areas: [], other_categories: [] },
    },
  }
}

function renderAssistant() {
  return render(
    <MemoryRouter initialEntries={['/assistant']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

async function ask(user, text) {
  await user.type(await screen.findByLabelText(/describe your problem/i), text)
  await user.click(screen.getByRole('button', { name: /^send$/i }))
}

beforeEach(() => {
  localStorage.clear()
  analyzeProblem.mockReset()
  saveSession({ accessToken: 'token-abc', refreshToken: 'refresh-abc', role: 'user', name: 'Mahmudul' })
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('conversation memory', () => {
  it('sends no history with the first question', async () => {
    analyzeProblem.mockResolvedValue(answer('Answer one.'))
    const user = userEvent.setup()
    renderAssistant()
    await ask(user, 'Ceiling fan ghure na')
    await screen.findByText('Answer one.')

    expect(analyzeProblem).toHaveBeenCalledTimes(1)
    expect(analyzeProblem.mock.calls[0][0]).not.toHaveProperty('history')
  })

  it('sends the earlier question and answer with a follow-up', async () => {
    analyzeProblem
      .mockResolvedValueOnce(answer('The fan does not rotate; likely the capacitor.'))
      .mockResolvedValueOnce(answer('Repair the capacitor instead of replacing the fan.'))
    const user = userEvent.setup()
    renderAssistant()

    await ask(user, 'Ceiling fan ghure na')
    await screen.findByText(/likely the capacitor/i)
    await ask(user, 'ar kom khoroch e kora jay?')
    await screen.findByText(/repair the capacitor/i)

    expect(analyzeProblem).toHaveBeenLastCalledWith({
      problem: 'ar kom khoroch e kora jay?',
      area: '',
      history: [{ problem: 'Ceiling fan ghure na', summary: 'The fan does not rotate; likely the capacitor.' }],
    })
  })

  it('still sends the area together with the history', async () => {
    analyzeProblem.mockResolvedValue(answer('An answer.'))
    const user = userEvent.setup()
    renderAssistant()
    await user.type(await screen.findByLabelText(/your area/i), 'Gulshan')

    await ask(user, 'Ceiling fan ghure na')
    await screen.findByText('An answer.')
    await ask(user, 'can it be cheaper?')
    await vi.waitFor(() => expect(analyzeProblem).toHaveBeenCalledTimes(2))

    const second = analyzeProblem.mock.calls[1][0]
    expect(second.area).toBe('Gulshan')
    expect(second.history).toHaveLength(1)
  })

  it('keeps only the last three finished turns', async () => {
    let n = 0
    analyzeProblem.mockImplementation(() => Promise.resolve(answer(`Answer ${++n}.`)))
    const user = userEvent.setup()
    renderAssistant()

    for (const question of ['question one', 'question two', 'question three', 'question four', 'question five']) {
      await ask(user, question)
      await screen.findByText(`Answer ${analyzeProblem.mock.calls.length}.`)
    }

    const history = analyzeProblem.mock.calls[4][0].history
    expect(history.map((t) => t.problem)).toEqual(['question two', 'question three', 'question four'])
    expect(history).toHaveLength(MAX_HISTORY_TURNS)
  })

  it('leaves failed questions out of the history', async () => {
    analyzeProblem
      .mockRejectedValueOnce(Object.assign(new Error('The AI assistant is having trouble right now.'), { status: 503 }))
      .mockResolvedValueOnce(answer('Second answer.'))
    const user = userEvent.setup()
    renderAssistant()

    await ask(user, 'question that failed')
    await screen.findByRole('alert')
    await ask(user, 'question that worked')
    await screen.findByText('Second answer.')

    expect(analyzeProblem.mock.calls[1][0]).not.toHaveProperty('history')
  })

  it('retry uses only the turns that came before the retried question', async () => {
    analyzeProblem
      .mockResolvedValueOnce(answer('Answer to A.'))
      .mockRejectedValueOnce(Object.assign(new Error('The AI assistant is having trouble right now.'), { status: 503 }))
      .mockResolvedValueOnce(answer('Answer to C.'))
      .mockResolvedValueOnce(answer('Answer to B after retry.'))
    const user = userEvent.setup()
    renderAssistant()

    await ask(user, 'question A')
    await screen.findByText('Answer to A.')
    await ask(user, 'question B')
    await screen.findByRole('alert')
    await ask(user, 'question C')
    await screen.findByText('Answer to C.')

    await user.click(screen.getByRole('button', { name: /try again/i }))
    await screen.findByText('Answer to B after retry.')

    const retryCall = analyzeProblem.mock.calls[3][0]
    expect(retryCall.problem).toBe('question B')
    expect(retryCall.history).toEqual([{ problem: 'question A', summary: 'Answer to A.' }]) // not C
  })

  it('"New chat" clears the conversation and its memory', async () => {
    analyzeProblem.mockResolvedValue(answer('An answer.'))
    const user = userEvent.setup()
    renderAssistant()
    expect(screen.queryByRole('button', { name: /new chat/i })).not.toBeInTheDocument()

    await ask(user, 'Ceiling fan ghure na')
    await screen.findByText('An answer.')
    await user.click(screen.getByRole('button', { name: /new chat/i }))

    expect(screen.queryByText('An answer.')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tell me what's wrong/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new chat/i })).not.toBeInTheDocument()

    await ask(user, 'Tap is leaking')
    await vi.waitFor(() => expect(analyzeProblem).toHaveBeenCalledTimes(2))
    expect(analyzeProblem.mock.calls[1][0]).not.toHaveProperty('history')
  })

  it('disables "New chat" while an answer is on its way', async () => {
    let resolve
    analyzeProblem
      .mockResolvedValueOnce(answer('First.'))
      .mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const user = userEvent.setup()
    renderAssistant()

    await ask(user, 'question one')
    await screen.findByText('First.')
    await ask(user, 'question two')

    expect(await screen.findByRole('button', { name: /new chat/i })).toBeDisabled()
    resolve(answer('Second.'))
    await screen.findByText('Second.')
    expect(screen.getByRole('button', { name: /new chat/i })).toBeEnabled()
  })
})

describe('buildHistory', () => {
  const done = (id, problem, summary) => ({ id, problem, status: 'done', result: { summary } })

  it('keeps finished turns only, oldest first, capped', () => {
    const turns = [
      done(1, 'a', 'A'),
      { id: 2, problem: 'b', status: 'error', result: null },
      done(3, 'c', 'C'),
      { id: 4, problem: 'd', status: 'loading', result: null },
      done(5, 'e', 'E'),
      done(6, 'f', 'F'),
    ]
    expect(buildHistory(turns).map((t) => t.problem)).toEqual(['c', 'e', 'f'])
  })

  it('with beforeId only looks at earlier turns', () => {
    const turns = [done(1, 'a', 'A'), done(2, 'b', 'B'), done(3, 'c', 'C')]
    expect(buildHistory(turns, 2)).toEqual([{ problem: 'a', summary: 'A' }])
    expect(buildHistory(turns, 1)).toEqual([])
  })

  it('tolerates an unknown beforeId and missing summaries', () => {
    const turns = [{ id: 1, problem: 'a', status: 'done', result: {} }]
    expect(buildHistory(turns, 99)).toEqual([{ problem: 'a', summary: '' }])
    expect(buildHistory([])).toEqual([])
  })
})
