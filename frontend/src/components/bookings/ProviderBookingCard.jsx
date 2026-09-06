import { CalendarClock, CheckCircle2, MapPin, Phone, PlayCircle, XCircle } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge'
import { formatDate, formatTime } from '@/lib/formatDate'

/**
 * Day 11: one row of ProviderBookingsPage's incoming-requests list —
 * the provider's side of a Booking. Same list-row shape
 * MyBookingCard.jsx uses for the customer's side (see that
 * component's own doc comment), with the identity/action set swapped
 * for a provider: customer name + phone instead of provider
 * name/photo (ProviderBookingListItemSerializer has no photo field —
 * this app has no customer profile photo at all, unlike a provider's),
 * and Confirm/Reject/Mark Completed instead of Cancel.
 *
 * Mirrors backend/bookings/views.py's own _PROVIDER_TRANSITIONS table
 * to decide which action buttons to show at all — pending can move to
 * confirmed or rejected, confirmed can move to completed, anything
 * else (completed/cancelled/rejected) shows no actions. The backend
 * is still the actual authority that enforces this on
 * PATCH /api/bookings/{id}/status/.
 *
 *   <ProviderBookingCard booking={booking} onUpdateStatus={handleUpdateStatus} isUpdating={false} />
 */
function ProviderBookingCard({ booking, onUpdateStatus, isUpdating }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar alt={booking.customer_name} size="h-11 w-11" iconSize="h-5 w-5" className="flex-shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-text)]">{booking.customer_name}</p>
              {booking.category_name ? (
                <p className="text-xs text-[var(--color-text-muted)]">{booking.category_name}</p>
              ) : null}
            </div>
            <BookingStatusBadge status={booking.status} />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {formatDate(booking.scheduled_date)} · {formatTime(booking.scheduled_time)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {booking.address}
            </span>
            {booking.customer_phone ? (
              <a
                href={`tel:${booking.customer_phone}`}
                className="flex items-center gap-1.5 text-[var(--color-secondary)] hover:underline"
              >
                <Phone className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {booking.customer_phone}
              </a>
            ) : null}
          </div>

          {booking.description ? (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{booking.description}</p>
          ) : null}

          {booking.status === 'pending' ? (
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => onUpdateStatus(booking.id, 'confirmed')}
                disabled={isUpdating}
              >
                {isUpdating ? <Spinner /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirm
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                onClick={() => onUpdateStatus(booking.id, 'rejected')}
                disabled={isUpdating}
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          ) : booking.status === 'confirmed' ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                onClick={() => onUpdateStatus(booking.id, 'completed')}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Spinner /> Updating…
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-3.5 w-3.5" /> Mark completed
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

export { ProviderBookingCard }