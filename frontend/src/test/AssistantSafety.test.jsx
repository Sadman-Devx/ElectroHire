import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { analyzeProblem } from '@/services/assistantService'

vi.mock('@/services/assistantService', () => ({
  analyzeProblem: vi.fn(),
  draftBooking: vi.fn(),
}))

const PROVIDER = {
  id: 7, name: 'Karim Uddin', area: 'Gulshan', experience: 8, photo: null,
  categories: ['Electrician'], avg_rating: 4.8, review_count: 24, status: 'active',
}

function answer(overrides = {}) {
  return {
    category: { id: 1, name: 'Electrician' },
    category_fallback: false,
    urgency: 'low',
    summary: 'The ceiling fan does not rotate.',
    safety_tips: ['Switch off the fan.', 'Do not touch the blades.'],
    cost_estimate: null,
    language: 'en',
    sources: [],
    providers: {
      area: null, area_matched: null, matches: [PROVIDER], message: 'Top-rated providers.',
      alternatives: { other_areas: [], other_categories: [] },
    },
    ...overrides,
  }
}

async function ask(text = 'Ceiling fan ghure na') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/assistant']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
  await user.type(await screen.findByLabelText(/describe your problem/i), text)
  await user.click(screen.getByRole('button', { name: /^send$/i }))
  return user
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

describe('AI answers are always labelled as guidance', () => {
  it('shows the disclaimer under a normal answer', async () => {
    analyzeProblem.mockResolvedValue(answer())
    await ask()
    expect(await screen.findByTestId('assistant-disclaimer')).toHaveTextContent(
      /general guidance only, not professional advice/i
    )
  })

  it('shows the disclaimer on an emergency answer too', async () => {
    analyzeProblem.mockResolvedValue(answer({ urgency: 'emergency' }))
    await ask('Switchboard theke spark hocche')
    expect(await screen.findByTestId('assistant-disclaimer')).toBeInTheDocument()
  })

  it('shows the Bangla disclaimer for Bangla answers', async () => {
    analyzeProblem.mockResolvedValue(answer({ language: 'bn', summary: 'সিলিং ফ্যান ঘুরছে না।' }))
    await ask('সিলিং ফ্যান ঘুরছে না')
    expect(await screen.findByTestId('assistant-disclaimer')).toHaveTextContent('পেশাদার পরামর্শ নয়')
  })

  it('keeps the standing note next to the message box', async () => {
    analyzeProblem.mockResolvedValue(answer())
    await ask()
    await screen.findByTestId('assistant-disclaimer')
    expect(screen.getByText(/ai suggestions are general guidance, not professional advice/i)).toBeInTheDocument()
  })

  it('shows one disclaimer per answer, not one per provider', async () => {
    analyzeProblem.mockResolvedValue(answer())
    await ask()
    await screen.findByTestId('assistant-disclaimer')
    expect(screen.getAllByTestId('assistant-disclaimer')).toHaveLength(1)
  })
})

describe('everything the AI or server sends is plain text (XSS)', () => {
  it('renders hostile text in every answer field as text, never HTML', async () => {
    const evil = '<img src=x onerror=alert(1)>'
    analyzeProblem.mockResolvedValue(
      answer({
        category: { id: 1, name: evil },
        summary: evil,
        safety_tips: [evil, '<script>alert(2)</script>'],
        cost_estimate: { min: 100, max: 200, currency: 'BDT', disclaimer: evil },
        sources: [{ title: evil, url: 'https://a.example.com/', domain: evil }],
        providers: {
          area: null, area_matched: null, matches: [],
          message: evil,
          alternatives: {
            other_areas: [{ ...PROVIDER, name: evil }],
            other_categories: [{ id: 2, name: evil, provider_count: 1 }],
          },
        },
      })
    )
    await ask()
    await screen.findByTestId('assistant-disclaimer')

    expect(document.querySelector('img[src="x"]')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
    expect(screen.getAllByText(/<img src=x onerror=alert\(1\)>/).length).toBeGreaterThan(3)
  })

  it('renders the customer\'s own message and server errors as text too', async () => {
    analyzeProblem.mockRejectedValue(
      Object.assign(new Error('<img src=x onerror=alert(3)> failed'), { status: 503 })
    )
    await ask('<script>alert(4)</script> fan problem')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('<img src=x onerror=alert(3)> failed')
    expect(screen.getByText('<script>alert(4)</script> fan problem')).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
  })

  it('never shows a phone number or email on a provider card', async () => {
    analyzeProblem.mockResolvedValue(answer())
    await ask()
    const card = (await screen.findByText('Karim Uddin')).closest('div')
    expect(within(card.parentElement.parentElement).queryByText(/01\d{9}/)).toBeNull()
    expect(document.body.textContent).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i)
  })
})
