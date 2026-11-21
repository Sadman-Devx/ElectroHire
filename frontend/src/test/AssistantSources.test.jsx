import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { safeSources } from '@/lib/assistantText'
import { saveSession } from '@/services/tokenStorage'
import { analyzeProblem } from '@/services/assistantService'

vi.mock('@/services/assistantService', () => ({
  analyzeProblem: vi.fn(),
  draftBooking: vi.fn(),
}))

function result(overrides = {}) {
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
      area: null, area_matched: null, matches: [], message: 'No providers.',
      alternatives: { other_areas: [], other_categories: [] },
    },
    ...overrides,
  }
}

async function ask() {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/assistant']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
  await user.type(await screen.findByLabelText(/describe your problem/i), 'Ceiling fan ghure na')
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

describe('AI answer sources (Tavily)', () => {
  it('shows sources as safe external links with a "not verified" note', async () => {
    analyzeProblem.mockResolvedValue(
      result({
        sources: [
          { title: 'Ceiling fan not working: safe checks', url: 'https://example.com/fan-safety', domain: 'example.com' },
          { title: 'Fan repair cost in Bangladesh', url: 'https://repair.example.org/cost', domain: 'repair.example.org' },
        ],
      })
    )
    await ask()

    expect(await screen.findByRole('heading', { name: 'Sources' })).toBeInTheDocument()
    expect(screen.getByText(/not verified by us/i)).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /ceiling fan not working: safe checks/i })
    expect(link).toHaveAttribute('href', 'https://example.com/fan-safety')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toMatch(/noopener/)
    expect(link.getAttribute('rel')).toMatch(/noreferrer/)
    expect(link).toHaveTextContent('example.com')
    expect(screen.getByRole('link', { name: /fan repair cost in bangladesh/i })).toBeInTheDocument()
  })

  it('shows no sources section when there are none (Tavily off or failed)', async () => {
    analyzeProblem.mockResolvedValue(result({ sources: [] }))
    await ask()
    await screen.findByText('The ceiling fan does not rotate.')
    expect(screen.queryByRole('heading', { name: 'Sources' })).not.toBeInTheDocument()
  })

  it('still works with an older response that has no "sources" field', async () => {
    const old = result()
    delete old.sources
    analyzeProblem.mockResolvedValue(old)
    await ask()
    expect(await screen.findByText('The ceiling fan does not rotate.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sources' })).not.toBeInTheDocument()
  })

  it('never renders a javascript: or other non-http(s) link', async () => {
    analyzeProblem.mockResolvedValue(
      result({
        sources: [
          { title: 'Evil', url: 'javascript:alert(1)', domain: 'x' },
          { title: 'Data', url: 'data:text/html,<script>1</script>', domain: 'x' },
          { title: 'Good', url: 'https://good.example.com/a', domain: 'good.example.com' },
        ],
      })
    )
    await ask()

    expect(await screen.findByRole('link', { name: /good/i })).toBeInTheDocument()
    expect(screen.queryByText('Evil')).not.toBeInTheDocument()
    expect(screen.queryByText('Data')).not.toBeInTheDocument()
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull()
  })

  it('renders source titles as plain text (XSS)', async () => {
    analyzeProblem.mockResolvedValue(
      result({
        sources: [{ title: '<img src=x onerror=alert(1)>', url: 'https://a.example.com/', domain: 'a.example.com' }],
      })
    )
    await ask()
    expect(await screen.findByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('uses the Bangla heading for Bangla answers', async () => {
    analyzeProblem.mockResolvedValue(
      result({
        language: 'bn',
        summary: 'সিলিং ফ্যান ঘুরছে না।',
        sources: [{ title: 'ফ্যান মেরামত', url: 'https://bn.example.com/a', domain: 'bn.example.com' }],
      })
    )
    await ask()
    expect(await screen.findByRole('heading', { name: 'সূত্র' })).toBeInTheDocument()
    expect(screen.getByText(/আমরা যাচাই করিনি/)).toBeInTheDocument()
  })
})

describe('safeSources', () => {
  it('keeps only http(s) links and tolerates junk input', () => {
    const good = { title: 'g', url: 'https://a.com' }
    const plain = { title: 'p', url: 'http://b.com' }
    expect(safeSources([good, plain, { url: 'javascript:1' }, { url: 5 }, null, 'x'])).toEqual([good, plain])
    expect(safeSources(undefined)).toEqual([])
    expect(safeSources('nope')).toEqual([])
  })
})
