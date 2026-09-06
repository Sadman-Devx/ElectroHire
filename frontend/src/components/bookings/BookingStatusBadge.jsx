import { CheckCircle2, Clock4, PlayCircle, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Small colored pill for a Booking's `status` field ("pending" |
 * "confirmed" | "completed" | "cancelled" | "rejected" — see backend
 * Booking.STATUS_CHOICES). Mirrors ProviderStatusBadge.jsx's own
 * shape/reasoning (see that component's doc comment) — same "used in
 * more than one place, don't copy-paste the lookup table" motivation,
 * here shared by MyBookingsPage and ProviderBookingsPage.
 *
 * Renders nothing for an unrecognized/missing status rather than
 * guessing a fallback label.
 *
 *   <BookingStatusBadge status={booking.status} />
 */
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock4,
    className: 'bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]',
  },
  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle2,
    className: 'bg-[var(--color-secondary-tint)] text-[var(--color-secondary)]',
  },
  completed: {
    label: 'Completed',
    icon: PlayCircle,
    className: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-slate-100 text-[var(--color-text-muted)]',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  },
}

function BookingStatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status]
  if (!config) return null

  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        config.className,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label}
    </span>
  )
}

export { BookingStatusBadge }
export default BookingStatusBadge