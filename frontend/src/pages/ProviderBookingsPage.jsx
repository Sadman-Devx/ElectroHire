import { AlertCircle, CalendarClock, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { Footer } from '@/components/home/Footer'
import { ProviderBookingCard } from '@/components/bookings/ProviderBookingCard'
import { ProviderOnlyNotice } from '@/components/providers/ProviderOnlyNotice'
import { useAuth } from '@/context/useAuth'
import { useProviderBookings } from '@/hooks/useProviderBookings'
import { useUpdateBookingStatus } from '@/hooks/useUpdateBookingStatus'

/**
 * Day 11, Dev 1/3: Provider Bookings page — the signed-in provider's
 * own incoming booking requests, sourced from
 * GET /api/bookings/provider/.
 *
 * Route: /provider/bookings (protected — see App.jsx). Linked from
 * DashboardNavbar. Same "you're signed in, but not as a provider"
 * role gate ProviderDashboardPage/ProviderProfileSetupPage already
 * use (ProviderOnlyNotice), since a "user"-role account has no
 * provider profile for GET /api/bookings/provider/ to look up (that
 * endpoint 404s for exactly that case — see
 * ProviderBookingListView's own docstring — which would otherwise
 * surface here as a confusing generic error rather than this page's
 * existing, friendlier "wrong account type" message).
 *
 * Confirm/Reject/Mark completed all apply the new status to local
 * state immediately via useProviderBookings()'s applyStatusUpdate
 * (same reasoning as MyBookingsPage's own Cancel action — see that
 * page's doc comment) rather than reloading the whole list.
 */
function ProviderBookingsPage() {
  const { user } = useAuth()

  const { bookings, isLoading, error, refetch, applyStatusUpdate } = useProviderBookings()
  const { updateStatus, isPending, error: updateError } = useUpdateBookingStatus()

  if (user && user.role !== 'provider') {
    return (
      <ProviderOnlyNotice description="You're signed in as a user account. Booking requests are only for accounts that signed up to offer a service." />
    )
  }

  async function handleUpdateStatus(bookingId, nextStatus) {
    const ok = await updateStatus({ bookingId, status: nextStatus })
    if (ok) applyStatusUpdate(bookingId, nextStatus)
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <DashboardNavbar />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text)] sm:text-2xl">Booking requests</h1>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Service requests customers have sent you.
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
              <p className="text-sm text-[var(--color-text-muted)]">No booking requests yet.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((booking) => (
                <ProviderBookingCard
                  key={booking.id}
                  booking={booking}
                  onUpdateStatus={handleUpdateStatus}
                  isUpdating={isPending(booking.id)}
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

export default ProviderBookingsPage