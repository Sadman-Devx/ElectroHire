import { AlertTriangle, Wallet } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatMoney, toMoneyNumber } from '@/lib/formatMoney'
import { cn } from '@/lib/utils'

/**
 * Top-of-page commission ledger for ProviderBookingsPage.
 *
 * Explains the model in plain words (the customer pays your quote, the
 * platform takes its percentage from YOUR side), shows how much the
 * provider currently owes from cash jobs, and — when they've reached the
 * limit — warns that new bookings can't be confirmed until dues are paid.
 *
 * `summary` is the `data` block of GET /api/bookings/provider/commission/.
 * Renders nothing until it's loaded (the booking list below works fine
 * without it).
 *
 *   <CommissionSummaryCard summary={summary} />
 */
function CommissionSummaryCard({ summary }) {
  if (!summary) return null

  const outstanding = toMoneyNumber(summary.outstanding) ?? 0
  const threshold = toMoneyNumber(summary.block_threshold) ?? 0
  const rate = toMoneyNumber(summary.rate_percent)
  const isBlocked = Boolean(summary.is_blocked)
  const usedFraction = threshold > 0 ? Math.min(outstanding / threshold, 1) : 0
  const isNearLimit = !isBlocked && threshold > 0 && usedFraction >= 0.75

  return (
    <Card
      className={cn(
        'mb-6 p-4 sm:p-5',
        isBlocked && 'border-[var(--color-danger)]/50 bg-[var(--color-danger-tint)]'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
            isBlocked
              ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
              : 'bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]'
          )}
        >
          {isBlocked ? (
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Wallet className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Platform commission</h2>
            {rate !== null ? (
              <span className="text-xs text-[var(--color-text-muted)]">
                {rate}% of each completed job
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Customers pay exactly the price you quote — no extra fees are added for them. The
            commission is taken from your earnings. For cash jobs you collect the full amount, so
            the commission is tracked here until you pay it.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">You owe</p>
              <p
                className={cn(
                  'text-lg font-bold',
                  isBlocked ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'
                )}
              >
                {formatMoney(outstanding) ?? '৳0'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Already paid</p>
              <p className="text-lg font-bold text-[var(--color-text)]">
                {formatMoney(summary.total_paid) ?? '৳0'}
              </p>
            </div>
          </div>

          {threshold > 0 ? (
            <div className="mt-3 sm:max-w-md">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usedFraction * 100)}
                aria-label="Unpaid commission compared with your limit"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isBlocked
                      ? 'bg-[var(--color-danger)]'
                      : isNearLimit
                        ? 'bg-[var(--color-primary)]'
                        : 'bg-[var(--color-success)]'
                  )}
                  style={{ width: `${Math.round(usedFraction * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Limit before new bookings are paused: {formatMoney(threshold)}
              </p>
            </div>
          ) : null}

          {isBlocked ? (
            <p role="alert" className="mt-3 text-sm font-medium text-[var(--color-danger)]">
              You can&rsquo;t confirm new bookings until you pay your dues. Contact support with
              your payment reference and we&rsquo;ll mark it paid.
            </p>
          ) : isNearLimit ? (
            <p className="mt-3 text-sm font-medium text-[var(--color-primary-hover)]">
              You&rsquo;re close to your limit. Pay your dues soon to keep accepting bookings.
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

export { CommissionSummaryCard }
export default CommissionSummaryCard