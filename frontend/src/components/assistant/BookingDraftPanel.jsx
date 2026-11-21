import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useBookingDraft } from '@/hooks/useBookingDraft'
import { formatDate, formatTime } from '@/lib/formatDate'

function Field({ id, label, needed, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {needed ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            Needed
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Phase 4A: "Draft with AI" booking panel for one provider.
 *
 *   1. customer types when/where in their own words
 *   2. AI turns it into an editable DRAFT (nothing is booked)
 *   3. customer reviews/edits and presses Confirm -> the existing
 *      POST /api/bookings/ creates the booking
 *
 * The only code that books is useBookingDraft().confirm(), triggered
 * by the Confirm button below. All AI text is rendered as plain text.
 */
function BookingDraftPanel({ provider, categoryId, summary, onClose }) {
  const flow = useBookingDraft({ providerId: provider.id, categoryId, summary })
  const [message, setMessage] = useState('')
  const { stage, draft, values, fieldErrors, error } = flow
  const idPrefix = `draft-${provider.id}`
  const missing = draft?.missing_fields || []

  return (
    <Card className="ml-0 flex flex-col gap-4 border-[var(--color-primary)]/40 p-5 sm:ml-6" role="region" aria-label={`Booking draft for ${provider.name}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
          <Sparkles className="h-4 w-4 text-[var(--color-primary-hover)]" aria-hidden="true" />
          Book {provider.name} with AI
        </h4>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close booking draft"
          className="rounded-md p-1 text-[var(--color-text-subtle)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {stage === 'input' || stage === 'drafting' ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-message`}>When and where?</Label>
            <Textarea
              id={`${idPrefix}-message`}
              rows={2}
              maxLength={500}
              placeholder="e.g. kal shokal 10 tar, House 12 Road 5 Gulshan"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={stage === 'drafting'}
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              I&apos;ll prepare a draft for you to review. Nothing is booked yet.
            </p>
          </div>
          {error ? (
            <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-[var(--color-danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="self-start"
            onClick={() => flow.createDraft(message)}
            disabled={stage === 'drafting'}
          >
            {stage === 'drafting' ? (
              <>
                <Spinner /> Preparing draft…
              </>
            ) : (
              'Create draft'
            )}
          </Button>
        </div>
      ) : null}

      {stage === 'review' || stage === 'confirming' ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-[var(--radius-input)] bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            Draft — not booked yet. Check the details, then press Confirm.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={`${idPrefix}-date`}
              label="Date"
              needed={missing.includes('scheduled_date')}
              error={fieldErrors.scheduledDate}
            >
              <Input
                id={`${idPrefix}-date`}
                type="date"
                min={draft?.today}
                value={values.scheduledDate}
                invalid={Boolean(fieldErrors.scheduledDate)}
                onChange={(event) => flow.setField('scheduledDate', event.target.value)}
              />
            </Field>
            <Field
              id={`${idPrefix}-time`}
              label="Time"
              needed={missing.includes('scheduled_time')}
              error={fieldErrors.scheduledTime}
            >
              <Input
                id={`${idPrefix}-time`}
                type="time"
                value={values.scheduledTime}
                invalid={Boolean(fieldErrors.scheduledTime)}
                onChange={(event) => flow.setField('scheduledTime', event.target.value)}
              />
            </Field>
          </div>

          <Field
            id={`${idPrefix}-address`}
            label="Address"
            needed={missing.includes('address')}
            error={fieldErrors.address}
          >
            <Input
              id={`${idPrefix}-address`}
              maxLength={255}
              placeholder="House, road, area"
              value={values.address}
              invalid={Boolean(fieldErrors.address)}
              onChange={(event) => flow.setField('address', event.target.value)}
            />
          </Field>

          <Field id={`${idPrefix}-notes`} label="Notes for the provider" error={fieldErrors.description}>
            <Textarea
              id={`${idPrefix}-notes`}
              rows={3}
              maxLength={2000}
              value={values.description}
              invalid={Boolean(fieldErrors.description)}
              onChange={(event) => flow.setField('description', event.target.value)}
            />
          </Field>

          {error ? (
            <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-[var(--color-danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={flow.confirm} disabled={stage === 'confirming'}>
              {stage === 'confirming' ? (
                <>
                  <Spinner /> Booking…
                </>
              ) : (
                'Confirm booking'
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={flow.startOver} disabled={stage === 'confirming'}>
              Start over
            </Button>
          </div>
        </div>
      ) : null}

      {stage === 'confirmed' ? (
        <div role="status" className="flex flex-col items-start gap-3">
          <p className="flex items-start gap-2 text-sm font-semibold text-[var(--color-success)]">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            Booking request sent to {provider.name}
          </p>
          <p className="text-sm text-[var(--color-text)]">
            {formatDate(values.scheduledDate)} at {formatTime(values.scheduledTime)} · {values.address}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="sm">
              <Link to="/bookings">View my bookings</Link>
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

export { BookingDraftPanel }
