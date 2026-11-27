import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatMoney, toMoneyNumber } from '@/lib/formatMoney'
import { cn } from '@/lib/utils'

/**
 * Ledger statement rows. `transactions` are the items returned by
 * GET /api/wallet/transactions/. A credit (+) raised the provider's
 * balance, a debit (−) lowered it; `balance_after` is the wallet
 * balance right after that line (negative = due).
 *
 *   <WalletTransactionList transactions={items} />
 */
function formatSigned(value) {
  const amount = toMoneyNumber(value)
  if (amount === null) return ''
  const sign = amount >= 0 ? '+' : '−'
  return `${sign} ${formatMoney(Math.abs(amount))}`
}

function formatBalance(value) {
  const amount = toMoneyNumber(value)
  if (amount === null) return ''
  if (amount < 0) return `${formatMoney(Math.abs(amount))} due`
  return `${formatMoney(amount)} available`
}

function formatDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function WalletTransactionList({ transactions }) {
  return (
    <Card className="divide-y divide-[var(--color-border)]">
      {transactions.map((tx) => {
        const isCredit = tx.direction === 'credit'
        const Icon = isCredit ? ArrowDownLeft : ArrowUpRight
        const cleared = toMoneyNumber(tx.due_cleared) ?? 0

        return (
          <div key={tx.id} className="flex items-start gap-3 p-4">
            <div
              className={cn(
                'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                isCredit
                  ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-text)]">{tx.entry_label}</p>
              {tx.note ? (
                <p className="text-xs text-[var(--color-text-muted)]">{tx.note}</p>
              ) : null}
              {tx.entry_type === 'online_earning' && cleared > 0 ? (
                <p className="text-xs text-[var(--color-success)]">
                  {formatMoney(cleared)} of this cleared your due automatically
                </p>
              ) : null}
              {tx.reference ? (
                <p className="text-xs text-[var(--color-text-subtle)]">Ref: {tx.reference}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-[var(--color-text-subtle)]">
                {formatDate(tx.created_at)}
              </p>
            </div>

            <div className="text-right">
              <p
                className={cn(
                  'text-sm font-semibold',
                  isCredit ? 'text-[var(--color-success)]' : 'text-[var(--color-text)]'
                )}
              >
                {formatSigned(tx.amount)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatBalance(tx.balance_after)}
              </p>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

export { WalletTransactionList }
export default WalletTransactionList