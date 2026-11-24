import { AlertCircle, CalendarClock, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { Footer } from '@/components/home/Footer'
import { CommissionSummaryCard } from '@/components/bookings/CommissionSummaryCard'
import { ProviderBookingCard } from '@/components/bookings/ProviderBookingCard'
import { ProviderOnlyNotice } from '@/components/providers/ProviderOnlyNotice'
import { useAuth } from '@/context/useAuth'
import { useProviderBookings } from '@/hooks/useProviderBookings'
import { useProviderCommission } from '@/hooks/useProviderCommission'
import { useUpdateBookingStatus } from '@/hooks/useUpdateBookingStatus'
import { toMoneyNumber } from '@/lib/formatMoney'

/**
 * Provider Bookings page — the signed-in provider's own incoming
 * booking requests (GET /api/bookings/provider/), plus their platform
 * commission ledger (GET /api/bookings/provider/commission/).
 *
 * Route: /provider/bookings (protected — see App.jsx). Same "you're
 * signed in, but not as a provider" role gate as ProviderDashboardPage.
 *
 * Provider-only commission flow on this page:
 *   - Confirm needs a price (the customer's final total). The server
 *     returns the locked-in commission, which is merged into the card
 *     straight away via applyStatusUpdate's third argument.
 *   - Completing a cash job makes the commission "due", so the
 *     commission summary is refetched after every successful change.
 *   - When unpaid commission reaches the limit, Confirm is disabled on
 *     every pending card (and the server refuses it too).
 */
function ProviderBookingsPage() {
  const { user } = useAuth()

  const { bookings, isLoading, error, refetch, applyStatusUpdate } = useProviderBookings()
  const { summary, refetch: refetchCommission } = useProviderCommission()
  const { updateStatus, isPending, error: updateError } = useUpdateBookingStatus()

  if (user && user.role !== 'provider') {
    return (
      <ProviderOnlyNotice description="You're signed in as a user account. Booking requests are only for accounts that signed up to offer a service." />
    )
  }

  async function handleUpdateStatus(bookingId, nextStatus, { quotedPrice } = {}) {
    const result = await updateStatus({ bookingId, status: nextStatus, quotedPrice })
    if (result) {
      applyStatusUpdate(bookingId, nextStatus, typeof result === 'object' ? result : {})
      // Confirming locks a rate, completing makes the commission due,
      // rejecting voids it — every one changes the ledger.
      refetchCommission()
    }
  }

  function handleRefresh() {
    refetch()
    refetchCommission()
  }

  const commissionRate = toMoneyNumber(summary?.rate_percent)
  const isBlocked = Boolean(summary?.is_blocked)

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
            <Button type="button" variant="secondary" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          <CommissionSummaryCard summary={summary} />

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
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={handleRefresh}>
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
                  commissionRate={commissionRate}
                  isBlocked={isBlocked}
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