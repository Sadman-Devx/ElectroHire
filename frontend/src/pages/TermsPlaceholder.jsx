import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'

import { Footer } from '@/components/home/Footer'
import { Navbar } from '@/components/home/Navbar'

/**
 * Day 9, Dev 1: the Account Page's "Terms & Conditions Link" (today's
 * schedule item) needs somewhere to actually go. The real Terms &
 * Conditions Page with full content is Day 10, Dev 1's task — this is
 * a forward-declared placeholder so the link isn't a dead 404 in the
 * meantime, same pattern the project already used repeatedly (e.g.
 * HomePlaceholder before Day 4's real HomePage, AccountPlaceholder
 * before today's real AccountPage).
 *
 * Route: /terms (public — no reason to gate legal text behind login).
 */
function TermsPlaceholder() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-20 text-center sm:px-6">
          <FileText className="h-9 w-9 text-[var(--color-text-subtle)]" aria-hidden="true" />
          <h1 className="text-xl font-bold text-[var(--color-text)]">Terms & Conditions</h1>
          <p className="max-w-md text-sm text-[var(--color-text-muted)]">
            The full Terms & Conditions page is coming soon. In the meantime, if you have any
            questions about using ElectroHire, please contact support.
          </p>
          <Link to="/" className="mt-2 text-sm font-semibold text-[var(--color-secondary)] hover:underline">
            Back to home
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default TermsPlaceholder