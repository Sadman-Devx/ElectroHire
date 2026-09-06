import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { UserNavbar } from '@/components/dashboard/UserNavbar'
import { Footer } from '@/components/home/Footer'
import { ProviderSummaryCard } from '@/components/providers/ProviderSummaryCard'
import { FormField } from '@/components/FormField'
import { useAuth } from '@/context/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useProviderDetail } from '@/hooks/useProviderDetail'
import { useSubmitBooking } from '@/hooks/useSubmitBooking'
import { formatDate, formatTime } from '@/lib/formatDate'
import { validateBookingForm, hasErrors } from '@/lib/validators'

/**
 * Day 11, Dev 1/3: Book Provider Page — Provider Booking System.
 *   → Provider Info Card
 *   → Category (optional), Date, Time, Address, Description
 *   → Submit + Confirmation Screen
 * New feature, not in the API Contract PDF or App Build doc (see
 * backend/bookings/models.py's own docstring for the same note).
 *
 * Route: /providers/:id/book (protected — see App.jsx). Reuses
 * useProviderDetail(id) for the same loading/notFound/error handling
 * RateProviderPage and ReportProviderPage already share, and mirrors
 * ReportProviderPage.jsx's exact page shell (breadcrumb, role-aware
 * navbar, skeleton/not-found/error states, confirmation screen) so
 * "act on a specific provider" pages keep behaving identically for a
 * bad/missing :id rather than inventing a fourth slightly-different
 * version of the same states.
 *
 * Only an *active* provider can actually be booked — the backend
 * (BookingCreateSerializer.validate_provider_id) is the real gate,
 * but a non-active provider's detail page never renders a "Book Now"
 * button in the first place (see StickyContactCard.jsx), so this
 * page reaching a rejected/pending provider at all means the visitor
 * typed the URL directly; the backend's own error message is shown
 * as-is via the same submitError banner rather than special-cased.
 */

function BookProviderSkeleton() {
  return (
    <div
      className="mx-auto flex max-w-xl animate-pulse flex-col gap-6"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-20 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
      <div className="h-[28rem] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
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

/** Shown once POST /api/bookings/ succeeds — replaces the form. */
function BookingConfirmation({ provider, booking }) {
  return (
    <Card className="flex flex-col items-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/10">
        <CheckCircle2 className="h-9 w-9 text-[var(--color-success)]" aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-bold text-[var(--color-text)]">Booking request sent</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {booking ? (
            <>
              {provider.name} will confirm your booking for{' '}
              <strong>{formatDate(booking.scheduled_date)}</strong> at{' '}
              <strong>{formatTime(booking.scheduled_time)}</strong>.
            </>
          ) : (
            `${provider.name} will review and confirm your booking soon.`
          )}
        </p>
      </div>
      <div className="mt-2 flex w-full flex-col gap-2.5 sm:flex-row">
        <Link to={`/providers/${provider.id}`} className="flex-1">
          <Button type="button" variant="secondary" className="w-full">
            Back to profile
          </Button>
        </Link>
        <Link to="/bookings" className="flex-[2]">
          <Button type="button" className="w-full">
            View my bookings
          </Button>
        </Link>
      </div>
    </Card>
  )
}

function BookingForm({ provider, categories, isLoadingCategories, onSubmit, isSubmitting, error }) {
  const [values, setValues] = useState({
    categoryId: '',
    scheduledDate: '',
    scheduledTime: '',
    address: '',
    description: '',
  })
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const errors = validateBookingForm(values)

  function shouldShow(field) {
    return submitAttempted || touched[field]
  }

  function updateField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitAttempted(true)
    if (hasErrors(errors)) return
    onSubmit(values)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book {provider.name}</CardTitle>
        <p className="text-sm text-[var(--color-text-muted)]">
          Tell {provider.name} when and where you need the service.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ProviderSummaryCard provider={provider} />

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-category">
              Category <span className="font-normal text-[var(--color-text-subtle)]">(optional)</span>
            </Label>
            <select
              id="booking-category"
              value={values.categoryId}
              onChange={(event) => updateField('categoryId', event.target.value)}
              disabled={isLoadingCategories || isSubmitting}
              className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
            >
              <option value="">Not sure / general enquiry</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              id="scheduledDate"
              label="Date"
              error={shouldShow('scheduledDate') ? errors.scheduledDate : null}
            >
              <Input
                id="scheduledDate"
                type="date"
                value={values.scheduledDate}
                invalid={Boolean(shouldShow('scheduledDate') && errors.scheduledDate)}
                onChange={(e) => updateField('scheduledDate', e.target.value)}
                onBlur={() => markTouched('scheduledDate')}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField
              id="scheduledTime"
              label="Time"
              error={shouldShow('scheduledTime') ? errors.scheduledTime : null}
            >
              <Input
                id="scheduledTime"
                type="time"
                value={values.scheduledTime}
                invalid={Boolean(shouldShow('scheduledTime') && errors.scheduledTime)}
                onChange={(e) => updateField('scheduledTime', e.target.value)}
                onBlur={() => markTouched('scheduledTime')}
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <FormField id="address" label="Address" error={shouldShow('address') ? errors.address : null}>
            <Input
              id="address"
              type="text"
              placeholder="House 12, Road 5, Dhanmondi"
              value={values.address}
              invalid={Boolean(shouldShow('address') && errors.address)}
              onChange={(e) => updateField('address', e.target.value)}
              onBlur={() => markTouched('address')}
              disabled={isSubmitting}
              maxLength={255}
            />
          </FormField>

          <div>
            <label htmlFor="booking-description" className="mb-2 block text-sm font-medium text-[var(--color-text)]">
              Describe the job{' '}
              <span className="font-normal text-[var(--color-text-subtle)]">(optional)</span>
            </label>
            <Textarea
              id="booking-description"
              rows={4}
              placeholder="AC not cooling, need a checkup..."
              value={values.description}
              onChange={(event) => updateField('description', event.target.value)}
              disabled={isSubmitting}
              maxLength={2000}
            />
            {shouldShow('description') && errors.description ? (
              <p className="mt-1.5 text-sm font-medium text-[var(--color-danger)]">{errors.description}</p>
            ) : null}
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
            <Button type="submit" className="flex-[2]" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : (
                <>
                  <CalendarClock className="h-4 w-4" /> Request Booking
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function BookProviderPage() {
  const { id } = useParams()
  const { provider, isLoading, error: loadError, notFound } = useProviderDetail(id)
  const { categories, isLoading: isLoadingCategories } = useCategories()
  const { submit, isSubmitting, error: submitError, isSuccess, data } = useSubmitBooking()
  const { user } = useAuth()
  const NavbarComponent = user?.role === 'provider' ? DashboardNavbar : UserNavbar

  function handleSubmit(values) {
    submit({
      providerId: provider.id,
      categoryId: values.categoryId ? Number(values.categoryId) : null,
      scheduledDate: values.scheduledDate,
      scheduledTime: values.scheduledTime,
      address: values.address.trim(),
      description: values.description.trim(),
    })
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
            <span className="font-medium text-[var(--color-text)]">Book</span>
          </nav>

          {isLoading ? (
            <BookProviderSkeleton />
          ) : notFound ? (
            <ProviderNotFound />
          ) : loadError ? (
            <LoadError message={loadError} />
          ) : provider ? (
            isSuccess ? (
              <BookingConfirmation provider={provider} booking={data} />
            ) : (
              <BookingForm
                provider={provider}
                categories={categories}
                isLoadingCategories={isLoadingCategories}
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

export default BookProviderPage