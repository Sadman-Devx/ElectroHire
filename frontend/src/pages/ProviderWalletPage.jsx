import { AlertCircle, ReceiptText, RefreshCw } from 'lucide-react'

import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { Footer } from '@/components/home/Footer'
import { ProviderOnlyNotice } from '@/components/providers/ProviderOnlyNotice'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { WalletSummaryCard } from '@/components/wallet/WalletSummaryCard'
import { WalletTransactionList } from '@/components/wallet/WalletTransactionList'
import { useAuth } from '@/context/useAuth'
import { useWallet } from '@/hooks/useWallet'
import { useWalletTransactions } from '@/hooks/useWalletTransactions'

/**
 * Provider Wallet page — the provider's balance, due and full ledger
 * statement (GET /api/wallet/ + GET /api/wallet/transactions/).
 *
 * Route: /provider/wallet (protected — see App.jsx). Same "you're signed
 * in, but not as a provider" gate as ProviderBookingsPage.
 */
function ProviderWalletPage() {
  const { user } = useAuth()
  const { wallet, isLoading, error, refetch } = useWallet()
  const {
    items,
    count,
    hasMore,
    isLoading: isLoadingTx,
    isLoadingMore,
    error: txError,
    loadMore,
    refetch: refetchTx,
  } = useWalletTransactions()

  if (user && user.role !== 'provider') {
    return (
      <ProviderOnlyNotice description="You're signed in as a user account. The wallet is only for accounts that signed up to offer a service." />
    )
  }

  function handleRefresh() {
    refetch()
    refetchTx()
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <DashboardNavbar />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text)] sm:text-2xl">Wallet</h1>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Your balance, commission due and every movement.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isLoadingTx}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          {isLoading ? (
            <div
              className="h-44 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
              aria-busy="true"
            />
          ) : error ? (
            <Card className="flex flex-col items-center gap-2 py-12 text-center">
              <AlertCircle className="h-9 w-9 text-[var(--color-danger)]" aria-hidden="true" />
              <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={refetch}>
                Try again
              </Button>
            </Card>
          ) : (
            <WalletSummaryCard wallet={wallet} />
          )}

          <h2 className="mb-3 mt-8 text-sm font-semibold text-[var(--color-text)]">
            Statement{count > 0 ? ` (${count})` : ''}
          </h2>

          {isLoadingTx ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <div className="h-16 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
              <div className="h-16 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
            </div>
          ) : txError && items.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm font-medium text-[var(--color-danger)]">{txError}</p>
              <Button type="button" variant="secondary" size="sm" onClick={refetchTx}>
                Try again
              </Button>
            </Card>
          ) : items.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-12 text-center">
              <ReceiptText className="h-9 w-9 text-[var(--color-text-subtle)]" aria-hidden="true" />
              <p className="text-sm text-[var(--color-text-muted)]">
                No wallet activity yet. It appears here when you complete a job.
              </p>
            </Card>
          ) : (
            <>
              <WalletTransactionList transactions={items} />
              {txError ? (
                <p role="alert" className="mt-3 text-sm font-medium text-[var(--color-danger)]">
                  {txError}
                </p>
              ) : null}
              {hasMore ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? <Spinner /> : null} Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ProviderWalletPage