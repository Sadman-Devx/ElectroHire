import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ChevronRight, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Footer } from '@/components/home/Footer'
import { Navbar } from '@/components/home/Navbar'
import { ProviderSummaryCard } from '@/components/providers/ProviderSummaryCard'
import { ReasonList } from '@/components/providers/report/ReasonList'
import { useProviderDetail } from '@/hooks/useProviderDetail'
import { useSubmitReport } from '@/hooks/useSubmitReport'

/**
 * Day 8, Dev 3: Report Provider Page.
 *   → Provider Info Card
 *   → Predefined Reason List
 *   → Optional Details Text
 *   → Submit + Confirmation Screen
 * Output: Report Page UI Ready — wired to the real POST /api/reports/
 * (Dev 2, Day 8) rather than a placeholder acknowledgement.
 *
 * Route: /providers/:id/report (protected — see App.jsx). Replaces
 * the "Reporting isn't open yet" placeholder text that
 * StickyContactCard.jsx (Day 6) and ChatWindowHeader.jsx's report
 * menu (Day 7) both showed while this page and the Report API didn't
 * exist yet — both now link straight here.
 *
 * Always submits reported_type: "provider" with reported_id =
 * provider.id — reporting a *user* (the bidirectional half of the
 * backend model) isn't part of today's scope; see
 * services/reportService.js's header comment.
 *
 * Reuses useProviderDetail(id) (Day 6) for the same provider identity
 * card + loading/notFound/error handling RateProviderPage (also
 * Day 8) uses, so both "act on a specific provider" pages behave
 * identically for a bad/missing :id.
 */

function ReportProviderSkeleton() {
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

/** Shown once POST /api/reports/ succeeds — replaces the form. Uses the backend's own confirmation copy. */
function ReportConfirmation({ provider, message }) {
  return (
    <Card className="flex flex-col items-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/10">
        <CheckCircle2 className="h-9 w-9 text-[var(--color-success)]" aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-bold text-[var(--color-text)]">Report submitted</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {message || 'We will review within 24-48 hours.'}
        </p>
      </div>
      <div className="mt-2 flex w-full flex-col gap-2.5 sm:flex-row">
        <Link to={`/providers/${provider.id}`} className="flex-1">
          <Button type="button" variant="secondary" className="w-full">
            Back to profile
          </Button>
        </Link>
        <Link to="/" className="flex-1">
          <Button type="button" className="w-full">
            Back to home
          </Button>
        </Link>
      </div>
    </Card>
  )
}

function ReportForm({ provider, onSubmit, isSubmitting, error }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')

  const canSubmit = Boolean(reason) && !isSubmitting

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({ reason, details: details.trim() })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report this provider</CardTitle>
        <p className="text-sm text-[var(--color-text-muted)]">
          Let us know what went wrong. Reports are reviewed by our admin team.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ProviderSummaryCard provider={provider} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <p className="mb-2.5 text-sm font-medium text-[var(--color-text)]">
              Why are you reporting {provider.name}?
            </p>
            <ReasonList selected={reason} onChange={setReason} disabled={isSubmitting} />
          </div>

          <div>
            <label htmlFor="report-details" className="mb-2 block text-sm font-medium text-[var(--color-text)]">
              Additional details{' '}
              <span className="font-normal text-[var(--color-text-subtle)]">(optional)</span>
            </label>
            <Textarea
              id="report-details"
              rows={4}
              placeholder="Tell us more about what happened..."
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              disabled={isSubmitting}
              maxLength={2000}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <Link to={`/providers/${provider.id}`} className="flex-1">
              <Button type="button" variant="secondary" className="w-full" disabled={isSubmitting}>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              className="flex-[2] bg-[var(--color-danger)] shadow-none hover:bg-red-700"
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <>
                  <Spinner /> Submitting…
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ReportProviderPage() {
  const { id } = useParams()
  const { provider, isLoading, error: loadError, notFound } = useProviderDetail(id)
  const { submit, isSubmitting, error: submitError, isSuccess, message } = useSubmitReport()

  function handleSubmit({ reason, details }) {
    submit({ reportedId: provider.id, reportedType: 'provider', reason, details })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />

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
            <span className="font-medium text-[var(--color-text)]">Report</span>
          </nav>

          {isLoading ? (
            <ReportProviderSkeleton />
          ) : notFound ? (
            <ProviderNotFound />
          ) : loadError ? (
            <LoadError message={loadError} />
          ) : provider ? (
            isSuccess ? (
              <ReportConfirmation provider={provider} message={message} />
            ) : (
              <ReportForm
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

export default ReportProviderPage