import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getProviderDetail } from '@/services/providerService'
import { createContact } from '@/services/contactService'

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
}))

const PROVIDER = {
  id: 1,
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
    expect(createContact).not.toHaveBeenCalled()
  })

  it('logs a contact and shows a success message when a logged-in user sends a message', async () => {
    loginAsUser()
    getProviderDetail.mockResolvedValue(PROVIDER)
    createContact.mockResolvedValue({ contact_id: 15, provider_name: 'Karim Uddin' })
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByText(/your message request has been sent/i)).toBeInTheDocument()
    expect(createContact).toHaveBeenCalledWith({ providerId: 1 })
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

  it('shows a friendly message instead of crashing when the Contact API is not live yet (404)', async () => {
    loginAsUser()
    getProviderDetail.mockResolvedValue(PROVIDER)
    const error = new Error('Something went wrong. Please try again.')
    error.status = 404
    createContact.mockRejectedValue(error)
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(
      await screen.findByText(/contacting providers isn't available yet/i)
    ).toBeInTheDocument()
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

  it('disables both contact buttons while a request is in flight', async () => {
    loginAsUser()
    getProviderDetail.mockResolvedValue(PROVIDER)
    let resolveContact
    createContact.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveContact = resolve
        })
    )
    const user = userEvent.setup()

    renderDetail()
    await screen.findByRole('heading', { name: 'Karim Uddin' })

    await user.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
    })
    expect(screen.getByRole('button', { name: /show number/i })).toBeDisabled()

    resolveContact({ contact_id: 15, provider_name: 'Karim Uddin' })
    expect(await screen.findByText(/your message request has been sent/i)).toBeInTheDocument()
  })
})