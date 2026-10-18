import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { analyzeProblem } from '@/services/assistantService'

vi.mock('@/services/assistantService', () => ({
  analyzeProblem: vi.fn(),
}))

const PROVIDER = {
  id: 7,
  name: 'Karim Uddin',
  area: 'Gulshan',
  experience: 8,
  photo: null,
  categories: ['Electrician'],
  avg_rating: 4.8,
  review_count: 24,
  status: 'active',
}

function makeResult(overrides = {}) {
  return {
    category: { id: 1, name: 'Electrician' },
    category_fallback: false,
    urgency: 'low',
    summary: 'The ceiling fan does not rotate.',
    safety_tips: ['Switch off the fan at the wall switch.', 'Do not touch the blades.'],
    cost_estimate: { min: 300, max: 800, currency: 'BDT', disclaimer: 'Only a rough estimate.' },
    language: 'en',
    providers: {
      area: 'Gulshan',
      area_matched: true,
      matches: [PROVIDER],
      message: 'Top-rated Electrician providers in Gulshan.',
      alternatives: { other_areas: [], other_categories: [] },
    },
    ...overrides,
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

function loginAsUser() {
  saveSession({ accessToken: 'token-abc', refreshToken: 'refresh-abc', role: 'user', name: 'Mahmudul' })
}

async function ask(user, text) {
  await user.type(await screen.findByLabelText(/describe your problem/i), text)
  await user.click(screen.getByRole('button', { name: /^send$/i }))
}

beforeEach(() => {
  localStorage.clear()
  analyzeProblem.mockReset()
  analyzeProblem.mockResolvedValue(makeResult())
  loginAsUser()
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('AssistantPage', () => {
  it('redirects an anonymous visitor to /login', async () => {
    localStorage.clear()
    renderAssistant()
    expect(await screen.findByRole('heading', { name: /log in|welcome back|sign in/i })).toBeInTheDocument()
  })

  it('shows the empty state with examples and a composer', async () => {
    renderAssistant()
    expect(await screen.findByRole('heading', { name: /tell me what's wrong/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ceiling fan ghure na' })).toBeInTheDocument()
    expect(screen.getByLabelText(/describe your problem/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/your area/i)).toBeInTheDocument()
    expect(screen.getByText(/not professional advice/i)).toBeInTheDocument()
  })

  it('fills the composer when an example is tapped', async () => {
    const user = userEvent.setup()
    renderAssistant()
    await user.click(await screen.findByRole('button', { name: 'Ceiling fan ghure na' }))
    expect(screen.getByLabelText(/describe your problem/i)).toHaveValue('Ceiling fan ghure na')
  })

  it('shows the AI Assistant link in the user navbar', async () => {
    renderAssistant()
    await screen.findByRole('heading', { name: /ai assistant/i, level: 1 })
    expect(screen.getAllByRole('link', { name: /ai assistant/i }).length).toBeGreaterThan(0)
  })

  it('sends the problem and area, then shows the analysis and providers', async () => {
    const user = userEvent.setup()
    renderAssistant()

    await user.type(await screen.findByLabelText(/your area/i), 'Gulshan')
    await ask(user, '  Ceiling fan ghure na  ')

    expect(await screen.findByText('The ceiling fan does not rotate.')).toBeInTheDocument()
    expect(analyzeProblem).toHaveBeenCalledWith({ problem: 'Ceiling fan ghure na', area: 'Gulshan' })

    // user bubble
    expect(screen.getByText('Ceiling fan ghure na')).toBeInTheDocument()
    // analysis
    // the category chip (the provider card also lists the category name)
    expect(screen.getAllByText('Electrician').length).toBeGreaterThan(0)
    expect(screen.getByText(/urgency:/i)).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('Switch off the fan at the wall switch.')).toBeInTheDocument()
    // cost with a clear "rough estimate" label
    expect(screen.getByText('৳300 – ৳800')).toBeInTheDocument()
    expect(screen.getByText(/only a rough estimate$/i)).toBeInTheDocument()
    // provider card with Contact + Book
    expect(screen.getByText('Karim Uddin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contact Karim Uddin' })).toHaveAttribute('href', '/providers/7')
    expect(screen.getByRole('link', { name: 'Book Karim Uddin' })).toHaveAttribute('href', '/providers/7/book')
    // composer cleared for the next question
    expect(screen.getByLabelText(/describe your problem/i)).toHaveValue('')
  })

  it('shows a loading state while the AI is working and locks the composer', async () => {
    let resolve
    analyzeProblem.mockReturnValue(new Promise((r) => { resolve = r }))
    const user = userEvent.setup()
    renderAssistant()

    await ask(user, 'Ceiling fan ghure na')

    expect(await screen.findByRole('status')).toHaveTextContent(/ai is thinking/i)
    expect(screen.getByLabelText(/describe your problem/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled()

    resolve(makeResult())
    expect(await screen.findByText('The ceiling fan does not rotate.')).toBeInTheDocument()
    expect(screen.getByLabelText(/describe your problem/i)).toBeEnabled()
  })

  it('shows a stand-out emergency warning', async () => {
    analyzeProblem.mockResolvedValue(
      makeResult({
        urgency: 'emergency',
        safety_tips: ['Switch off the main power first.', 'Keep children away.'],
      })
    )
    const user = userEvent.setup()
    renderAssistant()

    await ask(user, 'Switchboard theke spark hocche')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/this looks like an emergency/i)
    expect(alert).toHaveTextContent(/999/)
    expect(screen.getByText('Emergency')).toBeInTheDocument()
  })

  it('does not show the emergency banner for non-emergencies', async () => {
    const user = userEvent.setup()
    renderAssistant()
    await ask(user, 'Ceiling fan ghure na')
    await screen.findByText('The ceiling fan does not rotate.')
    expect(screen.queryByText(/this looks like an emergency/i)).not.toBeInTheDocument()
  })

  it('validates a too-short problem without calling the AI', async () => {
    const user = userEvent.setup()
    renderAssistant()

    await ask(user, 'hi')

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 5 characters/i)
    expect(analyzeProblem).not.toHaveBeenCalled()
  })

  it('shows the error with a working "Try again"', async () => {
    analyzeProblem.mockRejectedValueOnce(
      Object.assign(new Error('The AI assistant is having trouble right now.'), { status: 503 })
    )
    const user = userEvent.setup()
    renderAssistant()

    await ask(user, 'Ceiling fan ghure na')

    expect(await screen.findByRole('alert')).toHaveTextContent(/having trouble right now/i)

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('The ceiling fan does not rotate.')).toBeInTheDocument()
    expect(analyzeProblem).toHaveBeenCalledTimes(2)
    expect(analyzeProblem).toHaveBeenLastCalledWith({ problem: 'Ceiling fan ghure na', area: null })
  })

  it('shows the rate-limit message from the server', async () => {
    analyzeProblem.mockRejectedValue(
      Object.assign(new Error('Request was throttled. Expected available in 40 seconds.'), { status: 429 })
    )
    const user = userEvent.setup()
    renderAssistant()
    await ask(user, 'Ceiling fan ghure na')
    expect(await screen.findByRole('alert')).toHaveTextContent(/throttled/i)
  })

  it('shows a helpful empty state with alternatives when no provider matches', async () => {
    analyzeProblem.mockResolvedValue(
      makeResult({
        providers: {
          area: 'Gulshan',
          area_matched: false,
          matches: [],
          message: 'There are no Electrician providers in Gulshan right now.',
          alternatives: {
            other_areas: [{ ...PROVIDER, id: 9, name: 'Banani Ben', area: 'Banani' }],
            other_categories: [{ id: 2, name: 'Plumber', provider_count: 3 }],
          },
        },
      })
    )
    const user = userEvent.setup()
    renderAssistant()
    await ask(user, 'Ceiling fan ghure na')

    expect(await screen.findByText(/no electrician providers in gulshan/i)).toBeInTheDocument()
    expect(screen.getByText('Banani Ben')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Plumber (3)' })).toHaveAttribute('href', '/providers?category=2')
    expect(screen.getByRole('link', { name: /browse all providers/i })).toHaveAttribute('href', '/providers')
    // the default card button, since these are only suggestions
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute('href', '/providers/9')
    expect(screen.queryByRole('link', { name: /^book /i })).not.toBeInTheDocument()
  })

  it('does not show a guessed category when the AI could not identify one', async () => {
    analyzeProblem.mockResolvedValue(
      makeResult({
        category_fallback: true,
        providers: {
          area: null,
          area_matched: null,
          matches: [],
          message: "We couldn't match your problem to a service category.",
          alternatives: { other_areas: [], other_categories: [{ id: 1, name: 'Electrician', provider_count: 2 }] },
        },
      })
    )
    const user = userEvent.setup()
    renderAssistant()
    await ask(user, 'My cat is stuck on the roof')

    expect(await screen.findByText('Category unclear')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Electrician (2)' })).toBeInTheDocument()
  })

  it('renders Bangla results with Bangla labels and lang="bn"', async () => {
    analyzeProblem.mockResolvedValue(
      makeResult({
        language: 'bn',
        summary: 'সিলিং ফ্যান ঘুরছে না।',
        safety_tips: ['ফ্যানের সুইচ বন্ধ করুন।', 'ব্লেড ছোঁবেন না।'],
        providers: {
          area: null, area_matched: null, matches: [PROVIDER],
          message: 'সেরা রেটিংপ্রাপ্ত Electrician প্রোভাইডার।',
          alternatives: { other_areas: [], other_categories: [] },
        },
      })
    )
    const user = userEvent.setup()
    renderAssistant()
    await ask(user, 'সিলিং ফ্যান ঘুরছে না')

    const summary = await screen.findByText('সিলিং ফ্যান ঘুরছে না।')
    expect(summary.closest('[lang="bn"]')).not.toBeNull()
    expect(screen.getByText(/পেশাদার আসার আগে নিরাপত্তা পরামর্শ/)).toBeInTheDocument()
    expect(screen.getByText('এটি শুধু একটি মোটামুটি আন্দাজ')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'বুক করুন Karim Uddin' })).toBeInTheDocument()
  })

  it('renders AI text as plain text, never as HTML (XSS)', async () => {
    analyzeProblem.mockResolvedValue(
      makeResult({
        summary: '<img src=x onerror=alert(1)> <script>alert(2)</script>',
        safety_tips: ['<b>bold?</b>', 'second tip'],
      })
    )
    const user = userEvent.setup()
    renderAssistant()
    await ask(user, 'Ceiling fan ghure na')

    expect(await screen.findByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
    expect(screen.getByText('<b>bold?</b>')).toBeInTheDocument()
  })

  it('keeps earlier answers when a second question is asked', async () => {
    analyzeProblem
      .mockResolvedValueOnce(makeResult({ summary: 'First answer.' }))
      .mockResolvedValueOnce(makeResult({ summary: 'Second answer.' }))
    const user = userEvent.setup()
    renderAssistant()

    await ask(user, 'Ceiling fan ghure na')
    await screen.findByText('First answer.')
    await ask(user, 'Tap leaking badly')
    await screen.findByText('Second answer.')

    expect(screen.getByText('First answer.')).toBeInTheDocument()
    expect(screen.getByText('Ceiling fan ghure na')).toBeInTheDocument()
    expect(screen.getByText('Tap leaking badly')).toBeInTheDocument()
  })

  it('sends on Enter and adds a new line on Shift+Enter', async () => {
    const user = userEvent.setup()
    renderAssistant()
    const box = await screen.findByLabelText(/describe your problem/i)

    await user.type(box, 'line one{Shift>}{Enter}{/Shift}line two')
    expect(analyzeProblem).not.toHaveBeenCalled()
    expect(box).toHaveValue('line one\nline two')

    await user.type(box, '{Enter}')
    await waitFor(() => expect(analyzeProblem).toHaveBeenCalledTimes(1))
    expect(analyzeProblem.mock.calls[0][0].problem).toBe('line one\nline two')
  })

  it('never shows phone numbers or emails (provider cards only use public fields)', async () => {
    const user = userEvent.setup()
    renderAssistant()
    await ask(user, 'Ceiling fan ghure na')
    const card = (await screen.findByText('Karim Uddin')).closest('div[class*="rounded"]')
    expect(within(card.parentElement).queryByText(/01\d{9}/)).toBeNull()
    expect(document.body.textContent).not.toMatch(/@email\.com/)
  })
})
