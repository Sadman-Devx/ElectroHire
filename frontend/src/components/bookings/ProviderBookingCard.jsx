import { useState } from 'react'
import { CalendarClock, CheckCircle2, MapPin, Phone, PlayCircle, XCircle } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge'
import { CommissionStatusBadge } from '@/components/bookings/CommissionStatusBadge'
import { formatDate, formatTime } from '@/lib/formatDate'
import { formatMoney, isValidQuote, previewCommission } from '@/lib/formatMoney'

/**
 * One row of ProviderBookingsPage's incoming-requests list — the
 * provider's side of a Booking.
 *
 * Provider-only commission: confirming a pending booking now needs a
 * price. That quote is the FINAL total the customer pays; the platform's
 * commission comes out of the provider's earnings, so the form shows a
 * live "you keep" preview. After confirming/completing, the card shows
 * the real numbers the server calculated (quote, commission, what the
 * provider keeps, and where the commission stands).
 *
 * Mirrors backend _PROVIDER_TRANSITIONS to decide which buttons show;
 * the backend still enforces everything.
 *
 * Props:
 *   booking          item from GET /api/bookings/provider/
 *   onUpdateStatus   (bookingId, status, { quotedPrice? }) => void
 *   isUpdating       this row's request is in flight
 *   commissionRate   current rate (percent) for the live preview, or null
 *   isBlocked        provider has hit the unpaid-commission limit —
 *                    Confirm is disabled (the server also refuses)
 */
function MoneyRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className={strong ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text)]'}>
        {value}
      </dd>
    </div>
  )
}

function ProviderBookingCard({ booking, onUpdateStatus, isUpdating, commissionRate = null, isBlocked = false }) {
  const [quote, setQuote] = useState('')
  const [touched, setTouched] = useState(false)

  const isQuoteValid = isValidQuote(quote)
  const preview = isQuoteValid ? previewCommission(quote, commissionRate) : null
  const showQuoteError = touched && quote.trim() !== '' && !isQuoteValid

  const hasMoney = booking.quoted_price !== null && booking.quoted_price !== undefined
  const showMoneyBreakdown = hasMoney && ['confirmed', 'completed'].includes(booking.status)

  function handleConfirm() {
    setTouched(true)
    if (!isQuoteValid) return
    onUpdateStatus(booking.id, 'confirmed', { quotedPrice: quote.trim() })
  }

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

          {showMoneyBreakdown ? (
            <div className="mt-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <dl className="flex flex-col gap-1.5 text-sm">
                <MoneyRow label="Customer pays (your quote)" value={formatMoney(booking.quoted_price)} strong />
                <MoneyRow
                  label={`Platform commission${booking.commission_rate ? ` (${Number(booking.commission_rate)}%)` : ''}`}
                  value={`− ${formatMoney(booking.commission_amount) ?? '৳0'}`}
                />
                {booking.provider_net_amount !== null && booking.provider_net_amount !== undefined ? (
                  <MoneyRow label="You keep" value={formatMoney(booking.provider_net_amount)} strong />
                ) : null}
              </dl>
              <div className="mt-2">
                <CommissionStatusBadge status={booking.commission_status} />
              </div>
              {booking.status === 'completed' && booking.commission_status === 'due' ? (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  You collected the full amount in cash, so this commission is owed to the platform.
                </p>
              ) : null}
            </div>
          ) : null}

          {booking.status === 'pending' ? (
            <div className="mt-3">
              <label
                htmlFor={`quote-${booking.id}`}
                className="mb-1.5 block text-sm font-medium text-[var(--color-text)]"
              >
                Your price (total the customer pays)
              </label>
              <div className="flex flex-wrap items-start gap-2">
                <div className="w-full sm:w-48">
                  <Input
                    id={`quote-${booking.id}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 1500"
                    value={quote}
                    invalid={showQuoteError}
                    disabled={isUpdating || isBlocked}
                    onChange={(event) => setQuote(event.target.value)}
                    onBlur={() => setTouched(true)}
                  />
                </div>
                <Button type="button" size="sm" className="h-11" onClick={handleConfirm} disabled={isUpdating || isBlocked}>
                  {isUpdating ? <Spinner /> : <CheckCircle2 className="h-3.5 w-3.5" />} Confirm
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-11 border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                  onClick={() => onUpdateStatus(booking.id, 'rejected')}
                  disabled={isUpdating}
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>

              {showQuoteError ? (
                <p role="alert" className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">
                  Enter a price between ৳1 and ৳1,000,000 (up to 2 decimals).
                </p>
              ) : preview ? (
                <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                  Commission {formatMoney(preview.commission)} · you keep{' '}
                  <span className="font-semibold text-[var(--color-text)]">{formatMoney(preview.net)}</span>. The
                  customer sees {formatMoney(quote)} as the final price.
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                  The customer sees this as the final price — nothing is added on top.
                </p>
              )}

              {isBlocked ? (
                <p role="alert" className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">
                  Pay your unpaid commission to confirm new bookings.
                </p>
              ) : null}
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