import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getProviderDetail } from '@/services/providerService'
import { getCategories } from '@/services/categoryService'
import { createBooking } from '@/services/bookingService'

// Same mocking approach ProviderDetailPage.test.jsx / RateProviderPage.test.jsx
// already use — only what this page's own hooks touch needs a mock.
vi.mock('@/services/providerService', () => ({
  getProviderDetail: vi.fn(),
}))
vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn(),
}))
vi.mock('@/services/bookingService', () => ({
  createBooking: vi.fn(),
}))

const PROVIDER = {
  id: 1,
  name: 'Karim Uddin',
  area: 'Dhanmondi',
  experience: 8,
  photo: null,
  categories: ['Electrician'],
  avg_rating: 4.8,
  review_count: 24,
}

const CATEGORIES = [
  { id: 1, name: 'Electrician', icon: 'bulb' },
  { id: 2, name: 'Plumber', icon: 'pipe' },
]

function renderBook(initialPath = '/providers/1/book') {
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
  getCategories.mockReset()
  createBooking.mockReset()

  getProviderDetail.mockResolvedValue(PROVIDER)
  getCategories.mockResolvedValue(CATEGORIES)
  loginAsUser()
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

// This route is always wrapped in <ProtectedRoute> (see App.jsx), so an
// anonymous visitor is redirected to /login before this page ever
// renders.
describe('BookProviderPage', () => {
  it('renders the provider summary and a category dropdown built from GET /api/categories/', async () => {
    renderBook()

    expect(await screen.findByRole('heading', { name: /book karim uddin/i })).toBeInTheDocument()
    // ProviderSummaryCard.jsx joins categories + area into a single
    // "Electrician · Dhanmondi" subtitle line, not standalone text.
    expect(screen.getByText('Electrician · Dhanmondi')).toBeInTheDocument()

    const categorySelect = screen.getByLabelText(/category/i)
    expect(categorySelect).toHaveTextContent('Electrician')
    expect(categorySelect).toHaveTextContent('Plumber')
  })

  it('shows a "Provider not found" state on a 404', async () => {
    const error = new Error('Not Found')
    error.response = { status: 404, data: { status: 'error', message: 'Provider not found' } }
    getProviderDetail.mockRejectedValue(error)

    renderBook('/providers/999/book')

    expect(await screen.findByText('Provider not found')).toBeInTheDocument()
  })

  it('shows validation errors and does not submit for empty required fields', async () => {
    const user = userEvent.setup()
    renderBook()

    await screen.findByRole('heading', { name: /book karim uddin/i })
    await user.click(screen.getByRole('button', { name: /request booking/i }))

    expect(await screen.findByText(/select a date/i)).toBeInTheDocument()
    expect(screen.getByText(/select a time/i)).toBeInTheDocument()
    expect(screen.getByText(/address is required/i)).toBeInTheDocument()
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('submits a booking request and shows the confirmation screen', async () => {
    createBooking.mockResolvedValue({
      id: 7,
      provider_name: 'Karim Uddin',
      scheduled_date: '2026-12-25',
      scheduled_time: '14:30',
      status: 'pending',
    })

    const user = userEvent.setup()
    renderBook()

    await screen.findByRole('heading', { name: /book karim uddin/i })

    await user.selectOptions(screen.getByLabelText(/category/i), '1')
    await user.type(screen.getByLabelText(/^date$/i), '2026-12-25')
    await user.type(screen.getByLabelText(/^time$/i), '14:30')
    await user.type(screen.getByLabelText(/address/i), 'House 12, Road 5, Dhanmondi')
    await user.type(screen.getByLabelText(/describe the job/i), 'AC not cooling')

    await user.click(screen.getByRole('button', { name: /request booking/i }))

    expect(createBooking).toHaveBeenCalledWith({
      providerId: 1,
      categoryId: 1,
      scheduledDate: '2026-12-25',
      scheduledTime: '14:30',
      address: 'House 12, Road 5, Dhanmondi',
      description: 'AC not cooling',
    })

    expect(await screen.findByText(/booking request sent/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view my bookings/i })).toHaveAttribute('href', '/bookings')
  })

  it('shows the backend error message on a failed submission', async () => {
    const error = new Error('This provider is not currently accepting bookings.')
    error.status = 400
    createBooking.mockRejectedValue(error)

    const user = userEvent.setup()
    renderBook()

    await screen.findByRole('heading', { name: /book karim uddin/i })
    await user.type(screen.getByLabelText(/^date$/i), '2026-12-25')
    await user.type(screen.getByLabelText(/^time$/i), '14:30')
    await user.type(screen.getByLabelText(/address/i), 'House 12, Road 5, Dhanmondi')
    await user.click(screen.getByRole('button', { name: /request booking/i }))

    expect(
      await screen.findByText(/this provider is not currently accepting bookings\./i)
    ).toBeInTheDocument()
  })
})