import { AlertCircle, CalendarClock, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { UserNavbar } from '@/components/dashboard/UserNavbar'
import { Footer } from '@/components/home/Footer'
import { MyBookingCard } from '@/components/bookings/MyBookingCard'
import { useAuth } from '@/context/useAuth'
import { useMyBookings } from '@/hooks/useMyBookings'
import { useUpdateBookingStatus } from '@/hooks/useUpdateBookingStatus'

/**
 * Day 11, Dev 1/3: My Bookings page — every booking the signed-in
 * visitor has made *as a customer* (works for both "user" and
 * "provider" role accounts — see BookingCreateView's own docstring
 * on why booking isn't role-restricted), sourced from
 * GET /api/bookings/mine/.
 *
 * Route: /bookings (protected — see App.jsx). Linked from
 * UserNavbar/DashboardNavbar and from BookProviderPage's confirmation
 * screen. Same role-aware navbar pattern ReportProviderPage/
 * AccountPage already use — this route has no role restriction of its
 * own (see the paragraph above), so both navbars are equally correct
 * depending on which one the signed-in account actually has.
 *
 * Cancelling applies the new status to local state immediately via
 * useMyBookings()'s applyStatusUpdate (same "patch after a successful
 * mutation instead of waiting on a full refetch" idea
 * useConversations.js already uses) rather than reloading the whole
 * list, so the other rows don't visibly flicker while one row's
 * Cancel button is in flight.
 */
function MyBookingsPage() {
  const { user } = useAuth()
  const NavbarComponent = user?.role === 'provider' ? DashboardNavbar : UserNavbar

  const { bookings, isLoading, error, refetch, applyStatusUpdate } = useMyBookings()
  const { updateStatus, isPending, error: updateError } = useUpdateBookingStatus()

  async function handleCancel(bookingId) {
    const ok = await updateStatus({ bookingId, status: 'cancelled' })
    if (ok) applyStatusUpdate(bookingId, 'cancelled')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <NavbarComponent />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text)] sm:text-2xl">My bookings</h1>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Service requests you&rsquo;ve sent to providers.
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={refetch} disabled={isLoading}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          {updateError ? (
            <p role="alert" className="mb-4 text-sm font-medium text-[var(--color-danger)]">
              {updateError}
            </p>
          ) : null}

          {isLoading ? (
            <div className="flex flex-col gap-3" aria-live="polite" aria-busy="true">
              <div className="h-28 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
              <div className="h-28 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
            </div>
          ) : error ? (
            <Card className="flex flex-col items-center gap-2 py-16 text-center">
              <AlertCircle className="h-9 w-9 text-[var(--color-danger)]" aria-hidden="true" />
              <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={refetch}>
                Try again
              </Button>
            </Card>
          ) : bookings.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-16 text-center">
              <CalendarClock className="h-9 w-9 text-[var(--color-text-subtle)]" aria-hidden="true" />
              <p className="text-sm text-[var(--color-text-muted)]">
                You haven&rsquo;t booked any providers yet.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((booking) => (
                <MyBookingCard
                  key={booking.id}
                  booking={booking}
                  onCancel={handleCancel}
                  isCancelling={isPending(booking.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default MyBookingsPage