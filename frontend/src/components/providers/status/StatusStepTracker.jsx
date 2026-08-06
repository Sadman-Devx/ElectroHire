import { Check, Circle, Clock, Rocket } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Day 6 — Dev 3 spec: "Step Progress Tracker (4 Steps: Created →
 * Profile → Review → Live)".
 *
 * A vertical stepper rather than StepProgress.jsx's horizontal bar
 * (providers/setup/StepProgress.jsx) — that component answers "how far
 * through a form am I", this one answers "where is my application in a
 * multi-day review pipeline", which reads better as a checklist with a
 * description per stage. Different question, different shape; kept as
 * its own component instead of overloading StepProgress with a mode prop.
 *
 * `currentStep` is 1-indexed against STEPS below. Steps before it are
 * "complete" (check, success color), the step it points at is
 * "current" (clock, primary color — the in-progress admin review),
 * steps after are "upcoming" (muted). The final step always gets the
 * Rocket icon regardless of status, since "goes live" reads better as
 * a destination than a checkbox even while still upcoming.
 */
const STEPS = [
  {
    id: 1,
    label: 'Account created',
    description: 'Your signup and email verification are complete.',
  },
  {
    id: 2,
    label: 'Profile completed',
    description: 'Categories, service area and experience submitted.',
  },
  {
    id: 3,
    label: 'Admin review',
    description: 'Our team checks new profiles — usually 24–48 hours.',
  },
  {
    id: 4,
    label: 'Profile goes live',
    description: 'Visible to users searching your categories and area.',
  },
]

function getStatus(stepId, currentStep) {
  if (stepId < currentStep) return 'complete'
  if (stepId === currentStep) return 'current'
  return 'upcoming'
}

function StepIcon({ step, status }) {
  if (status === 'complete') return <Check className="h-4 w-4" aria-hidden="true" />
  if (status === 'current') return <Clock className="h-4 w-4" aria-hidden="true" />
  if (step.id === STEPS.length) return <Rocket className="h-4 w-4" aria-hidden="true" />
  return <Circle className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
}

const STATUS_LABEL = {
  complete: 'Completed',
  current: 'In progress',
  upcoming: 'Not started yet',
}

function StatusStepTracker({ currentStep = 3, className }) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {STEPS.map((step) => {
        const status = getStatus(step.id, currentStep)
        const isLast = step.id === STEPS.length

        return (
          <li key={step.id} className="flex gap-4" aria-current={status === 'current' ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                  status === 'complete' && 'bg-[var(--color-success)] text-white',
                  status === 'current' &&
                    'bg-[var(--color-primary)] text-white ring-4 ring-[var(--color-primary-tint)]',
                  status === 'upcoming' && 'bg-slate-200 text-[var(--color-text-subtle)]'
                )}
              >
                <StepIcon step={step} status={status} />
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    'w-0.5 flex-1 py-1',
                    status === 'complete' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'
                  )}
                  style={{ minHeight: '2.25rem' }}
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <div className={cn('pb-8', isLast && 'pb-0')}>
              <p
                className={cn(
                  'text-sm font-semibold',
                  status === 'upcoming' ? 'text-[var(--color-text-subtle)]' : 'text-[var(--color-text)]'
                )}
              >
                {step.label}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-xs',
                  status === 'current'
                    ? 'font-medium text-[var(--color-primary-hover)]'
                    : status === 'complete'
                      ? 'text-[var(--color-success)]'
                      : 'text-[var(--color-text-subtle)]'
                )}
              >
                {status === 'current' || status === 'complete' ? step.description : STATUS_LABEL.upcoming}
              </p>
              <span className="sr-only"> — {STATUS_LABEL[status]}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export { StatusStepTracker }