import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getMyBookings, updateBookingStatus } from '@/services/bookingService'

vi.mock('@/services/bookingService', () => ({
  getMyBookings: vi.fn(),
  updateBookingStatus: vi.fn(),
}))

const BOOKINGS = [
  {
    id: 1,
    provider_id: 3,
    provider_name: 'Karim Uddin',
    provider_photo: null,
    category_name: 'Electrician',
    scheduled_date: '2026-12-25',
    scheduled_time: '14:30:00',
    address: 'House 12, Road 5, Dhanmondi',
    description: 'AC not cooling',
    status: 'pending',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 2,
    provider_id: 4,
    provider_name: 'Rahim Mia',
    provider_photo: null,
    category_name: 'Plumber',
    scheduled_date: '2026-09-10',
    scheduled_time: '09:00:00',
    address: 'Gulshan 2',
    description: '',
    status: 'completed',
    created_at: '2026-08-20T10:00:00Z',
  },
]

function renderMyBookings() {
  return render(
    <MemoryRouter initialEntries={['/bookings']}>
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
  getMyBookings.mockReset()
  updateBookingStatus.mockReset()
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('MyBookingsPage', () => {
  it('redirects an unauthenticated visitor to /login (ProtectedRoute)', async () => {
    renderMyBookings()
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('renders each booking with its provider, schedule and status', async () => {
    loginAsUser()
    getMyBookings.mockResolvedValue(BOOKINGS)

    renderMyBookings()

    expect(await screen.findByRole('link', { name: 'Karim Uddin' })).toHaveAttribute(
      'href',
      '/providers/3'
    )
    expect(screen.getByText('Rahim Mia')).toBeInTheDocument()
    expect(screen.getByText('AC not cooling')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('shows an empty state when there are no bookings yet', async () => {
    loginAsUser()
    getMyBookings.mockResolvedValue([])

    renderMyBookings()

    expect(
      await screen.findByText(/haven.t booked any providers yet/i)
    ).toBeInTheDocument()
  })

  it('shows a retry button on a load failure', async () => {
    loginAsUser()
    getMyBookings.mockRejectedValue(new Error('Could not load your bookings. Please try again.'))

    renderMyBookings()

    expect(await screen.findByText(/could not load your bookings/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  // Only pending/confirmed bookings can be cancelled from the
  // customer's side (mirrors backend/bookings/views.py's own
  // _CUSTOMER_TRANSITIONS table) — the completed booking above has no
  // Cancel button at all.
  it('only shows a Cancel button for pending/confirmed bookings, not completed ones', async () => {
    loginAsUser()
    getMyBookings.mockResolvedValue(BOOKINGS)

    renderMyBookings()
    await screen.findByText('Rahim Mia')

    expect(screen.getAllByRole('button', { name: /cancel booking/i })).toHaveLength(1)
  })

  it('cancels a pending booking and updates its status badge in place', async () => {
    loginAsUser()
    getMyBookings.mockResolvedValue(BOOKINGS)
    updateBookingStatus.mockResolvedValue({ id: 1, status: 'cancelled' })

    const user = userEvent.setup()
    renderMyBookings()
    await screen.findByText('Karim Uddin')

    await user.click(screen.getByRole('button', { name: /cancel booking/i }))

    expect(updateBookingStatus).toHaveBeenCalledWith({ bookingId: 1, status: 'cancelled' })
    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
    // The Cancel button for that row is gone once it's cancelled.
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
  })

  it('shows an error message and keeps the booking pending when cancelling fails', async () => {
    loginAsUser()
    getMyBookings.mockResolvedValue([BOOKINGS[0]])
    updateBookingStatus.mockRejectedValue(new Error('Could not update this booking. Please try again.'))

    const user = userEvent.setup()
    renderMyBookings()
    await screen.findByText('Karim Uddin')

    await user.click(screen.getByRole('button', { name: /cancel booking/i }))

    expect(await screen.findByText(/could not update this booking/i)).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})