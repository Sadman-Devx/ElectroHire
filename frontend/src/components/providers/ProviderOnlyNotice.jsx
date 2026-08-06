import { Link } from 'react-router-dom'

import { Footer } from '@/components/home/Footer'
import { Navbar } from '@/components/home/Navbar'
import { Card } from '@/components/ui/card'

/**
 * Day 6 — Dev 3: extracted from ProviderProfileSetupPage (Day 5, Dev 3),
 * which had this exact markup inline for its own role-gate. Both the new
 * Pending Status Page and Provider Dashboard need the same "you're
 * signed in, but not as a provider" gate, so a third copy-paste was the
 * signal to pull it out instead — one implementation, three call sites.
 *
 * ProviderProfileSetupPage now renders this too; its own gate behavior
 * is unchanged, only where the markup lives.
 */
function ProviderOnlyNotice({ description }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            This page is for service providers
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{description}</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-[var(--radius-button)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            Back to home
          </Link>
        </Card>
      </main>
      <Footer />
    </div>
  )
}

export { ProviderOnlyNotice }