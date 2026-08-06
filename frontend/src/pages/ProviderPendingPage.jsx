import { Link } from 'react-router-dom'
import { Clock4 } from 'lucide-react'

import { Footer } from '@/components/home/Footer'
import { Navbar } from '@/components/home/Navbar'
import { ProviderOnlyNotice } from '@/components/providers/ProviderOnlyNotice'
import { StatusStepTracker } from '@/components/providers/status/StatusStepTracker'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/context/useAuth'

// Real support inbox TBD by the team — a placeholder mailto beats a
// dead link or a button that silently does nothing.
const SUPPORT_EMAIL = 'support@electrohire.app'

/**
 * Day 6 — Dev 3: Pending Status Page.
 *   → Step Progress Tracker (4 Steps: Created → Profile → Review → Live)
 *   → "24-48 hours" message + Contact Support link
 *
 * Route: /provider/pending (protected — see App.jsx), reached today
 * from ProviderProfileSetupPage's post-submit success card ("View
 * application status").
 *
 * currentStep is a constant 3 ("Admin review"), not fetched from a
 * status API.
 */
function ProviderPendingPage() {
  const { user } = useAuth()

  if (user && user.role !== 'provider') {
    return (
      <ProviderOnlyNotice description="You're signed in as a user account. Application status is only shown for accounts that signed up to offer a service." />
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-12 text-center sm:px-6">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
            <Clock4 className="h-7 w-7" aria-hidden="true" />
          </span>

          <h1 className="mt-5 text-2xl font-bold text-[var(--color-text)]">
            Profile under review
          </h1>

          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-text-muted)]">
            Our admin team is reviewing your profile. You&rsquo;ll be notified
            by email as soon as your account is approved and goes live —
            usually within{' '}
            <strong className="text-[var(--color-text)]">
              24&ndash;48 hours
            </strong>
            .
          </p>

          <Card className="mt-8 p-6 text-left sm:p-7">
            <StatusStepTracker currentStep={3} />
          </Card>

          <p className="mt-6 text-sm text-[var(--color-text-muted)]">
            Have questions?{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-[var(--color-secondary)] hover:underline"
            >
              Contact support
            </a>
          </p>

          <Link
            to="/"
            className="mt-8 inline-block text-sm font-semibold text-[var(--color-secondary)] hover:underline"
          >
            Back to home
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ProviderPendingPage