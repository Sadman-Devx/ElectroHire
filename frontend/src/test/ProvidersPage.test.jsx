import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getProviderDetail } from '@/services/providerService'
import { createContact, checkContactEligibility } from '@/services/contactService'
import { getMessageThread, listConversations } from '@/services/chatService'

// Both services make real axios/HTTP calls in production; mocking
// them lets us drive ProviderDetailPage -> useProviderDetail /
// useContactProvider -> service layer end-to-end while fully
// controlling the "backend" — same approach ProvidersPage.test.jsx
// already uses for getProviders/getCategories.
vi.mock('@/services/providerService', () => ({
  getProviderDetail: vi.fn(),
}))

vi.mock('@/services/contactService', () => ({
  createContact: vi.fn(),
  // Day 9, Dev 1: useContactEligibility() calls this on mount whenever
  // the visitor is authenticated. Defaulted to resolve `has_contacted:
  // true` in beforeEach below so the many pre-existing tests that
  // login but don't care about rating eligibility keep seeing the
  // real "Rate this provider" link rather than the disabled state —
  // tests that specifically care about ineligibility override this.
  checkContactEligibility: vi.fn(),
}))

// "Send Message" now navigates straight to ChatsPage instead of
// composing here (see StickyContactCard.jsx's doc comment) — only the
// one test that actually follows that navigation needs these mocked
// (same shape ChatsPage.test.jsx uses), so every other test here just
// leaves them unset.
vi.mock('@/services/chatService', () => ({
  listConversations: vi.fn(),
  getMessageThread: vi.fn(),
  sendMessage: vi.fn(),
}))

const PROVIDER = {
  id: 1,
  user_id: 10,
  name: 'Karim Uddin',
  area: 'Dhanmondi',
  experience: 8,
  description: 'Professional electrician with 8 years of experience.',
  photo: null,
  categories: ['Electrician', 'AC Repair'],
  avg_rating: 4.8,
  review_count: 24,
  member_since: '2024-01-15',
}

const NEW_PROVIDER = {
  ...PROVIDER,
  id: 2,
  user_id: 20,
  name: 'Rahim Mia',
  avg_rating: 0,
  review_count: 0,
  description: '',
}

function renderDetail(initialPath = '/providers/1') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

function loginAsUser() {
  saveSession({ accessToken: 'token-abc', refreshToken: 'refresh-abc', role: 'user', name: 'Mahmudul' })
}

function loginAsProvider() {
  saveSession({ accessToken: 'token-def', refreshToken: 'refresh-def', role: 'provider', name: 'Karim' })
}

beforeEach(() => {
  localStorage.clear()
  getProviderDetail.mockReset()
  createContact.mockReset()
  checkContactEligibility.mockReset()
  listConversations.mockReset()
  getMessageThread.mockReset()
  // Default: eligible. Individual tests that specifically exercise the
  // disabled/ineligible state override this per-test.
  checkContactEligibility.mockResolvedValue({ has_contacted: true, provider_id: 1 })
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ProviderDetailPage', () => {
  it('shows a loading state before the provider arrives', async () => {
    let resolveDetail
    getProviderDetail.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve
        })
    )

    renderDetail()

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    resolveDetail(PROVIDER)
    expect(await screen.findByRole('heading', { name: 'Karim Uddin' })).toBeInTheDocument()
  })

  it('renders the profile header, categories, rating and about section from the API', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)

    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Karim Uddin' })).toBeInTheDocument()
    expect(screen.getByText('Electrician')).toBeInTheDocument()
    expect(screen.getByText('AC Repair')).toBeInTheDocument()
    expect(screen.getByText('4.8')).toBeInTheDocument()
    expect(screen.getByText('(24 reviews)')).toBeInTheDocument()
    expect(screen.getByText('Dhanmondi')).toBeInTheDocument()
    expect(screen.getByText('8 yrs experience')).toBeInTheDocument()
    expect(
      screen.getByText('Professional electrician with 8 years of experience.')
    ).toBeInTheDocument()

    expect(getProviderDetail).toHaveBeenCalledWith('1')
  })

  it('shows "New" instead of a rating when the provider has no reviews yet', async () => {
    getProviderDetail.mockResolvedValue(NEW_PROVIDER)

    renderDetail('/providers/2')

    expect(await screen.findByRole('heading', { name: 'Rahim Mia' })).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('shows the empty-description fallback when the provider has no about text', async () => {
    getProviderDetail.mockResolvedValue(NEW_PROVIDER)

    renderDetail('/providers/2')

    expect(
      await screen.findByText("This provider hasn\u2019t added a description yet.")
    ).toBeInTheDocument()
  })

  it('shows a "no reviews yet" empty state (Rating API not built until Day 7)', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    expect(screen.getByText('No reviews yet')).toBeInTheDocument()
  })

  it('shows a "Provider not found" state on a 404', async () => {
    const error = new Error('Not Found')
    error.response = { status: 404, data: { status: 'error', message: 'Provider not found' } }
    getProviderDetail.mockRejectedValue(error)

    renderDetail('/providers/999')

    expect(await screen.findByText('Provider not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse all providers/i })).toHaveAttribute(
      'href',
      '/providers'
    )
  })

  it('shows a generic error state on a non-404 failure', async () => {
    const error = new Error('Server error')
    error.response = { data: { message: 'Could not load this provider. Please try again.' } }
    getProviderDetail.mockRejectedValue(error)

    renderDetail()

    expect(await screen.findByText(/could not load this provider/i)).toBeInTheDocument()
  })

  it('sends an unauthenticated visitor to /login when they try to message the provider', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('navigates straight into Messages with this provider when Send Message is clicked', async () => {
    // Follow-up after Day 9: "Send Message" no longer opens an inline
    // composer on the profile page (that used to call
    // chatService.sendMessage() directly via useSendFirstMessage,
    // since removed) — it routes to ChatsPage instead, carrying
    // enough in the URL (?with=&providerId=&name=) for that page to
    // build a conversation shell with no prior messages. See
    // StickyContactCard.jsx and ChatsPage.jsx's doc comments.
    loginAsUser()
    getProviderDetail.mockResolvedValue(PROVIDER)
    listConversations.mockResolvedValue([])
    getMessageThread.mockResolvedValue([])
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByRole('heading', { name: /messages/i })).toBeInTheDocument()
    // The chat window's header renders the provider's name from the
    // URL's `?name=` param — no round trip needed before it can show
    // who this conversation shell is with.
    expect(screen.getAllByText('Karim Uddin').length).toBeGreaterThan(0)
    // No Message rows exist yet for this pair, so the thread genuinely
    // fetches empty (see getMessageThread.mockResolvedValue([]) above)
    // — MessageThread's own empty state, not a placeholder invented
    // for this shell.
    expect(
      await screen.findByText(/no messages yet.*say hello to start the conversation/i)
    ).toBeInTheDocument()
    // Ready to type immediately — no extra click needed to "open" a composer.
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    expect(getMessageThread).toHaveBeenCalledWith({ providerId: 1, withUserId: undefined })
  })

  it('logs a contact and explains the number is not available yet on "Show Number"', async () => {
    loginAsUser()
    getProviderDetail.mockResolvedValue(PROVIDER)
    createContact.mockResolvedValue({ contact_id: 16, provider_name: 'Karim Uddin' })
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /show number/i }))

    expect(
      await screen.findByText(/a direct number isn't shared yet/i)
    ).toBeInTheDocument()
    expect(createContact).toHaveBeenCalledWith({ providerId: 1 })
  })

  it('navigates to the Report Provider page when Report this provider is clicked', async () => {
    // Day 9, Dev 1: updated for the Day 8, Dev 3 change where "Report
    // this provider" (now a Link, not a button — see
    // StickyContactCard.jsx) opens the real Report Provider page
    // instead of the old "not open yet" placeholder text.
    getProviderDetail.mockResolvedValue(PROVIDER)
    loginAsUser()
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('link', { name: /report this provider/i }))

    expect(await screen.findByRole('heading', { name: /report this provider/i })).toBeInTheDocument()
  })

  it('sends an unauthenticated visitor to Login when Report this provider is clicked', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('link', { name: /report this provider/i }))

    expect(await screen.findByRole('button', { name: /^log in$/i })).toBeInTheDocument()
  })

  // -- Day 9, Dev 1: Contact Log Eligibility Check (Rate button enable/disable) --
  it('shows Rate this provider as a real link once eligibility resolves true', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)
    checkContactEligibility.mockResolvedValue({ has_contacted: true, provider_id: 1 })
    loginAsUser()
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    const rateLink = await screen.findByRole('link', { name: /rate this provider/i })
    await user.click(rateLink)

    expect(await screen.findByRole('heading', { name: /rate your experience/i })).toBeInTheDocument()
  })

  it('shows Rate this provider as disabled when the user has not contacted the provider', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)
    checkContactEligibility.mockResolvedValue({ has_contacted: false, provider_id: 1 })
    loginAsUser()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await waitFor(() => {
      expect(checkContactEligibility).toHaveBeenCalledWith(1)
    })
    expect(screen.queryByRole('link', { name: /rate this provider/i })).not.toBeInTheDocument()
    expect(screen.getByText(/rate this provider/i)).toBeInTheDocument()
  })

  it('does not call the eligibility check for a logged-out visitor', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    // A logged-out visitor still sees "Rate this provider" as a link
    // (it funnels through requireAuth() to /login on click, same as
    // Report) — but the auth-required eligibility endpoint is never
    // called for them.
    expect(screen.getByRole('link', { name: /rate this provider/i })).toBeInTheDocument()
    expect(checkContactEligibility).not.toHaveBeenCalled()
  })

  it('links back to the provider list from the breadcrumb', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    const providersLinks = screen.getAllByRole('link', { name: /providers/i })
    expect(providersLinks[0]).toHaveAttribute('href', '/providers')
  })

  it('shows Send Message as disabled when the provider has no linked user_id yet', async () => {
    // Contract-gap fallback (see StickyContactCard.jsx's `canMessage`)
    // — without a user_id there's no one to route a `?with=` chat to,
    // so the button disables instead of navigating to a chat that can
    // never resolve. "Show Number" is unaffected since it doesn't need
    // a user_id.
    loginAsUser()
    getProviderDetail.mockResolvedValue({ ...PROVIDER, user_id: undefined })

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /show number/i })).toBeEnabled()
  })

  // Day 10, Dev 1 bug fix: this page always rendered the public
  // marketing Navbar regardless of auth state — its "#anchor" links
  // are dead off HomePage, and it piles a Dashboard/Messages/Account/
  // Log out cluster on top for a logged-in visitor too (see
  // UserNavbar.jsx's docstring, and TermsPage.jsx's identical fix).
  // Browsing is deliberately public, so unlike a protected page this
  // one still needs the public Navbar for an anonymous visitor.
  describe('navbar by auth state (Day 10 fix)', () => {
    it('shows the public Navbar for an anonymous visitor', async () => {
      getProviderDetail.mockResolvedValue(PROVIDER)
      renderDetail()
      await screen.findByRole('heading', { name: 'Karim Uddin' })

      expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument()
      expect(screen.getByText(/how it works/i)).toBeInTheDocument()
    })

    it('shows UserNavbar, not the public Navbar, for a logged-in user', async () => {
      loginAsUser()
      getProviderDetail.mockResolvedValue(PROVIDER)
      renderDetail()
      await screen.findByRole('heading', { name: 'Karim Uddin' })

      expect(screen.getByRole('link', { name: /^messages$/i })).toHaveAttribute('href', '/chats')
      expect(screen.queryByText(/how it works/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument()
    })

    it('shows DashboardNavbar, not the public Navbar, for a logged-in provider', async () => {
      loginAsProvider()
      getProviderDetail.mockResolvedValue(PROVIDER)
      renderDetail()
      await screen.findByRole('heading', { name: 'Karim Uddin' })

      expect(screen.getByRole('link', { name: /^reviews$/i })).toHaveAttribute('href', '/provider/reviews')
      expect(screen.queryByText(/how it works/i)).not.toBeInTheDocument()
    })
  })
})