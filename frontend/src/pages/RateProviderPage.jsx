import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ChevronRight, MessageCircle, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { UserNavbar } from '@/components/dashboard/UserNavbar'
import { Footer } from '@/components/home/Footer'
import { ProviderSummaryCard } from '@/components/providers/ProviderSummaryCard'
import { RatingTagSelector } from '@/components/providers/rate/RatingTagSelector'
import { StarRatingInput } from '@/components/providers/rate/StarRatingInput'
import { useAuth } from '@/context/useAuth'
import { useProviderDetail } from '@/hooks/useProviderDetail'
import { useSubmitRating } from '@/hooks/useSubmitRating'

/**
 * Day 8, Dev 3: Rating Submit Page.
 *   → Interactive Star Rating (Large, Clickable)
 *   → Quick Tags (On time, Professional, Good work, Fair price)
 *   → Optional Review Textarea
 * Output: Rating Page UI Ready — wired to the real POST /api/ratings/
 * (Dev 2, Day 7) rather than a mock, since that endpoint already
 * exists by the time this page is built.
 *
 * Route: /providers/:id/rate (protected — see App.jsx). Already
 * forward-linked from two places built on Day 7:
 * components/chat/RateProviderBanner.jsx's "Rate {name}" banner, and
 * (once wired below) ProviderDetailPage's contact card.
 *
 * Reuses useProviderDetail(id) (Day 6) for the provider identity card
 * at the top — same GET /api/providers/{id}/ call, same
 * loading/notFound/error handling ProviderDetailPage already has, so
 * this page behaves identically for a bad/missing :id.
 *
 * Eligibility ("must have contacted this provider first") is a real
 * backend rule (ratings/views.py RatingCreateView, checked against
 * ContactLog) — a submission from someone who hasn't contacted this
 * provider yet returns 400 "You must contact this provider before
 * rating", surfaced here as an actionable message with a link back to
 * the provider's contact card, not a generic error banner.
 *
 * `useSubmitRating()` is called once at this top level (not inside
 * the form) so `isSuccess` can swap the whole card for
 * RatingConfirmation — the form component itself stays a plain,
 * controlled child.
 *
 * Day 10, Dev 1 bug fix: this page always rendered the public
 * marketing Navbar — dead-link + "extra nav" bug for a logged-in
 * visitor (see UserNavbar.jsx's docstring). Same fix as
 * ReportProviderPage.jsx (this route is also always protected, so
 * no anonymous-visitor branch is needed): picks DashboardNavbar/
 * UserNavbar by role instead.
 */

function RateProviderSkeleton() {
  return (
    <div
      className="mx-auto flex max-w-xl animate-pulse flex-col gap-6"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-20 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
      <div className="h-96 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
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
      <Link to="/providers" className="mt-2 text-sm font-semibold text-[var(--color-secondary)] hover:underline">
        Browse all providers
      </Link>
    </div>
  )
}

function LoadError({ message }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center">
      <AlertCircle className="h-9 w-9 text-[var(--color-danger)]" aria-hidden="true" />
      <p className="text-sm font-medium text-[var(--color-danger)]">{message}</p>
    </div>
  )
}

/** Shown once POST /api/ratings/ succeeds — replaces the form. */
function RatingConfirmation({ provider }) {
  return (
    <Card className="flex flex-col items-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/10">
        <CheckCircle2 className="h-9 w-9 text-[var(--color-success)]" aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-bold text-[var(--color-text)]">Thanks for your feedback!</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Your rating for {provider.name} has been submitted and will help other users.
        </p>
      </div>
      <div className="mt-2 flex w-full flex-col gap-2.5 sm:flex-row">
        <Link to={`/providers/${provider.id}`} className="flex-1">
          <Button type="button" variant="secondary" className="w-full">
            Back to profile
          </Button>
        </Link>
        <Link to="/providers" className="flex-1">
          <Button type="button" className="w-full">
            Browse more providers
          </Button>
        </Link>
      </div>
    </Card>
  )
}

/** The eligibility error (400, "must contact before rating") gets its own actionable callout instead of a generic banner. */
function EligibilityNotice({ provider }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[var(--radius-input)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-tint)] p-4">
      <p className="text-sm font-medium text-[var(--color-danger)]">
        You need to contact {provider.name} before you can rate them.
      </p>
      <Link
        to={`/providers/${provider.id}`}
        className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-secondary)] hover:underline"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" /> Go message {provider.name}
      </Link>
    </div>
  )
}

function RatingForm({ provider, onSubmit, isSubmitting, error }) {
  const [ratingValue, setRatingValue] = useState(0)
  const [tags, setTags] = useState([])
  const [reviewText, setReviewText] = useState('')

  const isEligibilityError = error === 'You must contact this provider before rating'
  const canSubmit = ratingValue > 0 && !isSubmitting

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({ ratingValue, reviewText: reviewText.trim(), tags })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate your experience</CardTitle>
        <p className="text-sm text-[var(--color-text-muted)]">
          Your feedback helps other users find the best providers
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ProviderSummaryCard provider={provider} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <p className="mb-3 text-center text-sm font-medium text-[var(--color-text)]">
              How was your experience?
            </p>
            <StarRatingInput value={ratingValue} onChange={setRatingValue} disabled={isSubmitting} />
          </div>

          <div>
            <p className="mb-2.5 text-sm text-[var(--color-text-muted)]">Quick feedback</p>
            <RatingTagSelector selected={tags} onChange={setTags} disabled={isSubmitting} />
          </div>

          <div>
            <label htmlFor="review-text" className="mb-2 block text-sm font-medium text-[var(--color-text)]">
              Write a review{' '}
              <span className="font-normal text-[var(--color-text-subtle)]">(optional)</span>
            </label>
            <Textarea
              id="review-text"
              rows={4}
              placeholder="Share details about your experience with this provider..."
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              disabled={isSubmitting}
              maxLength={2000}
            />
          </div>

          {error ? (
            isEligibilityError ? (
              <EligibilityNotice provider={provider} />
            ) : (
              <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
                {error}
              </p>
            )
          ) : null}

          <div className="flex gap-3">
            <Link to={`/providers/${provider.id}`} className="flex-1">
              <Button type="button" variant="secondary" className="w-full" disabled={isSubmitting}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" className="flex-[2]" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Spinner /> Submitting…
                </>
              ) : (
                'Submit Review'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RateProviderPage() {
  const { id } = useParams()
  const { provider, isLoading, error: loadError, notFound } = useProviderDetail(id)
  const { submit, isSubmitting, error: submitError, isSuccess } = useSubmitRating()
  const { user } = useAuth()
  const NavbarComponent = user?.role === 'provider' ? DashboardNavbar : UserNavbar

  function handleSubmit({ ratingValue, reviewText, tags }) {
    submit({ providerId: provider.id, ratingValue, reviewText, tags })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <NavbarComponent />

      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm">
            <Link to="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" aria-hidden="true" />
            {provider ? (
              <Link
                to={`/providers/${provider.id}`}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                {provider.name}
              </Link>
            ) : (
              <Link to="/providers" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                Providers
              </Link>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" aria-hidden="true" />
            <span className="font-medium text-[var(--color-text)]">Rate</span>
          </nav>

          {isLoading ? (
            <RateProviderSkeleton />
          ) : notFound ? (
            <ProviderNotFound />
          ) : loadError ? (
            <LoadError message={loadError} />
          ) : provider ? (
            isSuccess ? (
              <RatingConfirmation provider={provider} />
            ) : (
              <RatingForm
                provider={provider}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                error={submitError}
              />
            )
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default RateProviderPage