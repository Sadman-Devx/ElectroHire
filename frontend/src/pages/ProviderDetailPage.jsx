import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ChevronRight, SearchX } from 'lucide-react'

import { Footer } from '@/components/home/Footer'
import { Navbar } from '@/components/home/Navbar'
import { ProviderAbout } from '@/components/providers/detail/ProviderAbout'
import { ProviderProfileHeader } from '@/components/providers/detail/ProviderProfileHeader'
import { ProviderReviewsPreview } from '@/components/providers/detail/ProviderReviewsPreview'
import { StickyContactCard } from '@/components/providers/detail/StickyContactCard'
import { useProviderDetail } from '@/hooks/useProviderDetail'

/**
 * Day 6 — Dev 1: Provider Profile Detail Page.
 *   → Profile Header (Photo, Name, Rating Stars, Area)
 *   → Category Chips + About Section
 *   → Reviews Preview (2-3টা দেখাবে)
 *   → Sticky Contact Card (Chat Button + Call/Number Reveal)
 *   → Report Button
 *   → Provider Detail API Connect
 *
 * Route: /providers/:id — matches the link ProviderCard.jsx already
 * builds (Day 5) and GET /api/providers/{id}/ (Dev 2, Day 4).
 */

function ProviderDetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 lg:grid-cols-[1fr_340px]" aria-live="polite" aria-busy="true">
      <div className="flex flex-col gap-6">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex gap-5">
            <div className="h-20 w-20 flex-shrink-0 rounded-full bg-[var(--color-bg)]" />
            <div className="flex-1">
              <div className="h-5 w-40 rounded bg-[var(--color-bg)]" />
              <div className="mt-3 h-4 w-56 rounded bg-[var(--color-bg)]" />
              <div className="mt-3 h-4 w-64 rounded bg-[var(--color-bg)]" />
            </div>
          </div>
        </div>
        <div className="h-32 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
        <div className="h-40 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </div>
      <div className="h-72 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
    </div>
  )
}

function ProviderNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center">
      <SearchX className="h-9 w-9 text-[var(--color-text-subtle)]" aria-hidden="true" />
      <p className="text-base font-semibold text-[var(--color-text)]">Provider not found</p>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        This provider may have been removed, or the link might be incorrect.
      </p>
      <Link
        to="/providers"
        className="mt-2 text-sm font-semibold text-[var(--color-secondary)] hover:underline"
      >
        Browse all providers
      </Link>
    </div>
  )
}

function ProviderDetailError({ message }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center">
      <AlertCircle className="h-9 w-9 text-[var(--color-danger)]" aria-hidden="true" />
      <p className="text-sm font-medium text-[var(--color-danger)]">{message}</p>
    </div>
  )
}

function ProviderDetailPage() {
  const { id } = useParams()
  const { provider, isLoading, error, notFound } = useProviderDetail(id)

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm">
            <Link to="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" aria-hidden="true" />
            <Link
              to="/providers"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Providers
            </Link>
            {provider ? (
              <>
                <ChevronRight
                  className="h-3.5 w-3.5 text-[var(--color-text-subtle)]"
                  aria-hidden="true"
                />
                <span className="truncate font-medium text-[var(--color-text)]">
                  {provider.name}
                </span>
              </>
            ) : null}
          </nav>

          {isLoading ? (
            <ProviderDetailSkeleton />
          ) : notFound ? (
            <ProviderNotFound />
          ) : error ? (
            <ProviderDetailError message={error} />
          ) : provider ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="flex flex-col gap-6">
                <ProviderProfileHeader provider={provider} />
                <ProviderAbout description={provider.description} />
                <ProviderReviewsPreview reviewCount={provider.review_count} />
              </div>

              <div>
                <StickyContactCard provider={provider} />
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ProviderDetailPage