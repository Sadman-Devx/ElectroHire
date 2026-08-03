import { AlertCircle, SearchX } from 'lucide-react'

import { ProviderCard } from '@/components/providers/ProviderCard'

const SKELETON_COUNT = 4

function ProviderCardSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="h-14 w-14 flex-shrink-0 rounded-full bg-[var(--color-bg)]" />
      <div className="flex-1">
        <div className="h-3.5 w-32 rounded bg-[var(--color-bg)]" />
        <div className="mt-2.5 h-3 w-48 rounded bg-[var(--color-bg)]" />
        <div className="mt-2.5 h-3 w-40 rounded bg-[var(--color-bg)]" />
      </div>
    </div>
  )
}

/**
 * Provider List API Connect — renders whatever useProviders() /
 * ProvidersPage hands it: skeleton loaders while the request is in
 * flight, an inline error, "No providers found" when the filters
 * match nothing, or the actual ProviderCard results.
 *
 * Kept dumb on purpose — no fetching here — so it's trivially
 * testable and reusable if another page ever needs a provider list
 * (e.g. a future "similar providers" section).
 */
function ProviderList({ providers, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-live="polite" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <ProviderCardSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] py-14 text-center">
        <AlertCircle className="h-8 w-8 text-[var(--color-danger)]" />
        <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] py-14 text-center">
        <SearchX className="h-8 w-8 text-[var(--color-text-subtle)]" />
        <p className="text-sm font-medium text-[var(--color-text)]">No providers found</p>
        <p className="text-xs text-[var(--color-text-muted)]">Try a different category or area.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  )
}

export { ProviderList }