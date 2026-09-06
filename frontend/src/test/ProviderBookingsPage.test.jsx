import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getProviderBookings, updateBookingStatus } from '@/services/bookingService'

vi.mock('@/services/bookingService', () => ({
  getProviderBookings: vi.fn(),
  updateBookingStatus: vi.fn(),
}))

const PENDING_BOOKING = {
  id: 1,
  customer_id: 9,
  customer_name: 'Mahmudul Hasan',
  customer_phone: '01712345678',
  category_name: 'Electrician',
  scheduled_date: '2026-12-25',
  scheduled_time: '14:30:00',
  address: 'House 12, Road 5, Dhanmondi',
  description: 'AC not cooling',
  status: 'pending',
  created_at: '2026-09-01T10:00:00Z',
}

const CONFIRMED_BOOKING = {
  id: 2,
  customer_id: 10,
  customer_name: 'Rahim Ahmed',
  customer_phone: '01898765432',
  category_name: 'Electrician',
  scheduled_date: '2026-09-15',
  scheduled_time: '09:00:00',
  address: 'Gulshan 2',
  description: '',
  status: 'confirmed',
  created_at: '2026-08-20T10:00:00Z',
}

function renderProviderBookings() {
  return render(
    <MemoryRouter initialEntries={['/provider/bookings']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

function loginAsProvider() {
  saveSession({
    accessToken: 'token-abc',
    refreshToken: 'refresh-abc',
    role: 'provider',
    name: 'Karim Uddin',
  })
}

function loginAsUser() {
  saveSession({ accessToken: 'token-xyz', refreshToken: 'refresh-xyz', role: 'user', name: 'Mahmudul' })
}

beforeEach(() => {
  localStorage.clear()
  getProviderBookings.mockReset()
  updateBookingStatus.mockReset()
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ProviderBookingsPage', () => {
  it('redirects an unauthenticated visitor to /login (ProtectedRoute)', async () => {
    renderProviderBookings()
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  // A "user"-role account has no provider profile at all, so
  // GET /api/bookings/provider/ isn't even the right endpoint for
  // them — same ProviderOnlyNotice gate ProviderDashboardPage/
  // ProviderProfileSetupPage already use for this exact situation.
  it('shows a "provider account only" notice for a signed-in user account', async () => {
    loginAsUser()
    renderProviderBookings()

    expect(
      await screen.findByText(/booking requests are only for accounts that signed up to offer a service/i)
    ).toBeInTheDocument()
    expect(getProviderBookings).not.toHaveBeenCalled()
  })

  it('renders each incoming request with the customer, schedule and phone', async () => {
    loginAsProvider()
    getProviderBookings.mockResolvedValue([PENDING_BOOKING, CONFIRMED_BOOKING])

    renderProviderBookings()

    expect(await screen.findByText('Mahmudul Hasan')).toBeInTheDocument()
    expect(screen.getByText('Rahim Ahmed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '01712345678' })).toHaveAttribute(
      'href',
      'tel:01712345678'
    )
  })

  it('shows an empty state when there are no booking requests yet', async () => {
    loginAsProvider()
    getProviderBookings.mockResolvedValue([])

    renderProviderBookings()

    expect(await screen.findByText(/no booking requests yet/i)).toBeInTheDocument()
  })

  it('shows Confirm and Reject for a pending request, and confirming updates its badge', async () => {
    loginAsProvider()
    getProviderBookings.mockResolvedValue([PENDING_BOOKING])
    updateBookingStatus.mockResolvedValue({ id: 1, status: 'confirmed' })

    const user = userEvent.setup()
    renderProviderBookings()
    await screen.findByText('Mahmudul Hasan')

    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^confirm$/i }))

    expect(updateBookingStatus).toHaveBeenCalledWith({ bookingId: 1, status: 'confirmed' })
    expect(await screen.findByText('Confirmed')).toBeInTheDocument()
    // Now shows "Mark completed" instead of Confirm/Reject.
    expect(screen.getByRole('button', { name: /mark completed/i })).toBeInTheDocument()
  })

  it('marks a confirmed booking as completed', async () => {
    loginAsProvider()
    getProviderBookings.mockResolvedValue([CONFIRMED_BOOKING])
    updateBookingStatus.mockResolvedValue({ id: 2, status: 'completed' })

    const user = userEvent.setup()
    renderProviderBookings()
    await screen.findByText('Rahim Ahmed')

    await user.click(screen.getByRole('button', { name: /mark completed/i }))

    expect(updateBookingStatus).toHaveBeenCalledWith({ bookingId: 2, status: 'completed' })
    expect(await screen.findByText('Completed')).toBeInTheDocument()
  })

  it('shows an error message when updating a booking fails', async () => {
    loginAsProvider()
    getProviderBookings.mockResolvedValue([PENDING_BOOKING])
    updateBookingStatus.mockRejectedValue(new Error('Could not update this booking. Please try again.'))

    const user = userEvent.setup()
    renderProviderBookings()
    await screen.findByText('Mahmudul Hasan')

    await user.click(screen.getByRole('button', { name: /^reject$/i }))

    expect(await screen.findByText(/could not update this booking/i)).toBeInTheDocument()
    // Status unchanged.
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })
})