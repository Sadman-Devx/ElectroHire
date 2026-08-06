import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * One stat tile — Day 6 spec: "Stats Cards (Contacts, Ratings, Avg
 * Rating)". Three states, all handled explicitly rather than one
 * component silently guessing:
 *   - isLoading   → skeleton pulse, matches ProviderDetailSkeleton's
 *                   look elsewhere in the app
 *   - !isAvailable → "—" placeholder + the given `unavailableNote`.
 *                    Deliberately never fabricates a number here — the
 *                    backend for this doesn't exist until Day 9, Dev 2
 *                    (see useProviderDashboard.js), and showing a real
 *                    provider a made-up "0 contacts" would just read
 *                    as a bug report waiting to happen.
 *   - default      → the real value, via `render` if the raw number
 *                    needs formatting (e.g. avg rating as stars).
 */
function StatCard({ icon: Icon, label, value, unavailableNote, isLoading, isAvailable, render, className }) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="h-7 w-16 animate-pulse rounded bg-[var(--color-bg)]" />
        ) : !isAvailable ? (
          <>
            <p className="text-2xl font-bold text-[var(--color-text-subtle)]">—</p>
            {unavailableNote ? (
              <p className="mt-1 text-xs text-[var(--color-text-subtle)]">{unavailableNote}</p>
            ) : null}
          </>
        ) : render ? (
          render(value)
        ) : (
          <p className="text-2xl font-bold text-[var(--color-text)]">{value}</p>
        )}
      </div>
    </Card>
  )
}

export { StatCard }