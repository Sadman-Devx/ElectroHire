import { Link } from 'react-router-dom'
import { Compass, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Day 10, Dev 3 — 404 Page.
 *
 * Was a bare inline `function NotFound()` right in App.jsx: plain
 * muted text, no icon, no card, no way back — the one page in the
 * app that didn't follow design.md's own system (16px card radius,
 * 12px button radius, the icon-in-tinted-circle pattern every other
 * "nothing here" state already uses — see ProviderNotFound in
 * ProviderDetailPage.jsx and ChatEmptyState.jsx). Pulled out into its
 * own file, both because every other route in App.jsx already gets
 * one (pages/*.jsx) and because a real page needs its own test.
 *
 * No Navbar/Footer here on purpose: the route that landed here is by
 * definition not one those components know how to highlight (there's
 * no matching nav item to mark "active"), and we don't know the
 * visitor's auth state without importing useAuth just to pick between
 * Navbar/DashboardNavbar/UserNavbar for a page that isn't part of any
 * of those flows. AuthLayout's own "just the logo, centered" header
 * already sets this precedent for chrome-light pages.
 */
function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4 py-12 text-center">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--color-primary)] text-white">
          <Zap className="h-5 w-5" fill="currentColor" />
        </span>
        <span className="text-lg font-bold tracking-tight text-[var(--color-text)]">
          ElectroHire
        </span>
      </Link>

      <div className="flex w-full max-w-sm flex-col items-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-10 shadow-sm shadow-slate-200/60">
        <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-tint)]">
          <Compass className="h-7 w-7 text-[var(--color-primary)]" aria-hidden="true" />
        </span>

        <p className="text-sm font-semibold tracking-wide text-[var(--color-text-subtle)]">
          404
        </p>
        <h1 className="mt-1 text-xl font-bold text-[var(--color-text)]">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
        </p>

        <div className="mt-7 flex w-full flex-col gap-2.5">
          <Button asChild size="lg" className="w-full">
            <Link to="/">Back to home</Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link to="/providers">Browse providers</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage