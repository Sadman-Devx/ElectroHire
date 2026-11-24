import { cn } from '@/lib/utils'

/**
 * Small pill for a Booking's `commission_status` (provider-only view).
 * Renders nothing for "none" / unknown, so cancelled or never-quoted
 * bookings show no commission badge at all.
 *
 *   <CommissionStatusBadge status={booking.commission_status} />
 */
const CONFIG = {
  pending: {
    label: 'Commission after job',
    className: 'bg-slate-100 text-[var(--color-text-muted)]',
  },
  due: {
    label: 'Commission due',
    className: 'bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]',
  },
  paid: {
    label: 'Commission paid',
    className: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  },
  waived: {
    label: 'Commission waived',
    className: 'bg-slate-100 text-[var(--color-text-muted)]',
  },
  deducted: {
    label: 'Deducted from payout',
    className: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  },
}

function CommissionStatusBadge({ status, className }) {
  const config = CONFIG[status]
  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}

export { CommissionStatusBadge }
export default CommissionStatusBadge