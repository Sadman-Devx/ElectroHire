import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getProviderDetail } from '@/services/providerService'
import { createContact } from '@/services/contactService'
import { sendMessage } from '@/services/chatService'

// Both services make real axios/HTTP calls in production; mocking
// them lets us drive ProviderDetailPage -> useProviderDetail /
// useContactProvider / useSendFirstMessage -> service layer
// end-to-end while fully controlling the "backend" — same approach
// ProvidersPage.test.jsx already uses for getProviders/getCategories.
vi.mock('@/services/providerService', () => ({
  getProviderDetail: vi.fn(),
}))

vi.mock('@/services/contactService', () => ({
  createContact: vi.fn(),
}))

// "Send Message" now sends a real first message via chatService (see
// StickyContactCard.jsx's doc comment for why) instead of only
// logging a contact — mocked the same way ChatsPage.test.jsx mocks it.
vi.mock('@/services/chatService', () => ({
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

beforeEach(() => {
  localStorage.clear()
  getProviderDetail.mockReset()
  createContact.mockReset()
  sendMessage.mockReset()
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
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('sends a real first message and links straight into the conversation', async () => {
    loginAsUser()
    getProviderDetail.mockResolvedValue(PROVIDER)
    sendMessage.mockResolvedValue({ id: 1, content: 'Ki obosthay AC ta?', created_at: '2025-01-15T10:00:00.000Z' })
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /send message/i }))
    await user.type(
      screen.getByPlaceholderText(/say hello to karim uddin/i),
      'Ki obosthay AC ta?'
    )
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(sendMessage).toHaveBeenCalledWith({ providerId: 1, content: 'Ki obosthay AC ta?' })
    expect(await screen.findByText(/your message has been sent to karim uddin/i)).toBeInTheDocument()
    const conversationLink = screen.getByRole('link', { name: /open the conversation/i })
    expect(conversationLink).toHaveAttribute('href', '/chats?with=10')
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

  it('shows a friendly message instead of crashing when messaging is not live yet (404)', async () => {
    loginAsUser()
    getProviderDetail.mockResolvedValue(PROVIDER)
    const error = new Error('Something went wrong. Please try again.')
    error.status = 404
    sendMessage.mockRejectedValue(error)
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /send message/i }))
    await user.type(screen.getByPlaceholderText(/say hello to karim uddin/i), 'Hi there')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(await screen.findByText(/messaging isn't available yet/i)).toBeInTheDocument()
  })

  it('shows a placeholder acknowledgement when Report this provider is clicked', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /report this provider/i }))

    expect(await screen.findByText(/reporting isn.t open yet/i)).toBeInTheDocument()
  })

  it('links back to the provider list from the breadcrumb', async () => {
    getProviderDetail.mockResolvedValue(PROVIDER)

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    const providersLinks = screen.getAllByRole('link', { name: /providers/i })
    expect(providersLinks[0]).toHaveAttribute('href', '/providers')
  })

  it('disables Cancel and Send while the first message is in flight', async () => {
    loginAsUser()
    getProviderDetail.mockResolvedValue(PROVIDER)
    let resolveSend
    sendMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve
        })
    )
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /send message/i }))
    await user.type(screen.getByPlaceholderText(/say hello to karim uddin/i), 'Hi there')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
    })
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()

    resolveSend({ id: 1, content: 'Hi there', created_at: '2025-01-15T10:00:00.000Z' })
    expect(await screen.findByText(/your message has been sent to karim uddin/i)).toBeInTheDocument()
  })

  it('shows the contact options again without a conversation link when user_id is unavailable', async () => {
    loginAsUser()
    getProviderDetail.mockResolvedValue({ ...PROVIDER, user_id: undefined })
    sendMessage.mockResolvedValue({ id: 1, content: 'Hi there', created_at: '2025-01-15T10:00:00.000Z' })
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /send message/i }))
    await user.type(screen.getByPlaceholderText(/say hello to karim uddin/i), 'Hi there')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(await screen.findByText(/your message has been sent to karim uddin/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /open the conversation/i })).not.toBeInTheDocument()
  })
})