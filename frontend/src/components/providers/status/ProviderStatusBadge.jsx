import { CheckCircle2, Clock4, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Small colored pill for a Provider's `status` field
 * ("pending" | "active" | "rejected" — see backend Provider model).
 *
 * Day 9, Dev 3: pulled out as its own component because it's used in
 * two places that both needed the exact same three states as soon as
 * GET /api/providers/me/ made a provider's real status available —
 * ProviderProfileEditPage's header badge and ProviderDashboardPage's
 * new header badge — rather than copy-pasting the same lookup table
 * twice.
 *
 * Renders nothing for an unrecognized/missing status rather than
 * guessing a fallback label.
 *
 *   <ProviderStatusBadge status={profile.status} />
 */
const STATUS_CONFIG = {
  active: {
    label: 'Active',
    icon: CheckCircle2,
    className: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  },
  pending: {
    label: 'Pending review',
    icon: Clock4,
    className: 'bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  },
}

function ProviderStatusBadge({ status, className }) {
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

export { ProviderStatusBadge }
export default ProviderStatusBadge