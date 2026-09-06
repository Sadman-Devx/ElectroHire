import { Link } from 'react-router-dom'
import { CalendarClock, MapPin, X } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge'
import { formatDate, formatTime } from '@/lib/formatDate'

// Mirrors backend/bookings/views.py's own _CUSTOMER_TRANSITIONS table
// — only these two current statuses can move to "cancelled" from the
// customer's side. Kept here (not re-derived from anything the API
// returns) purely to decide whether to render the Cancel button at
// all; the backend is still the actual authority that enforces it on
// PATCH /api/bookings/{id}/status/.
const CUSTOMER_CANCELLABLE_STATUSES = new Set(['pending', 'confirmed'])

/**
 * Day 11: one row of MyBookingsPage's booking list — the customer's
 * side of a Booking, mirroring the shape MyRatingsSection.jsx already
 * uses for its own list items (provider identity + timestamp header,
 * body content below, Card wrapper) rather than inventing a new list
 * layout.
 *
 *   <MyBookingCard booking={booking} onCancel={handleCancel} isCancelling={false} />
 */
function MyBookingCard({ booking, onCancel, isCancelling }) {
  const canCancel = CUSTOMER_CANCELLABLE_STATUSES.has(booking.status)

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar
          src={booking.provider_photo}
          alt={booking.provider_name}
          size="h-11 w-11"
          iconSize="h-5 w-5"
          className="flex-shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/providers/${booking.provider_id}`}
                className="truncate text-sm font-semibold text-[var(--color-text)] hover:underline"
              >
                {booking.provider_name}
              </Link>
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
          </div>

          {booking.description ? (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{booking.description}</p>
          ) : null}

          {canCancel ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                onClick={() => onCancel(booking.id)}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <Spinner /> Cancelling…
                  </>
                ) : (
                  <>
                    <X className="h-3.5 w-3.5" /> Cancel booking
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

export { MyBookingCard }