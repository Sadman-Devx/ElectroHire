import { Link } from 'react-router-dom'
import { ChevronRight, LogOut, ScrollText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ContactHistorySection } from '@/components/account/ContactHistorySection'
import { MyRatingsSection } from '@/components/account/MyRatingsSection'
import { ProfileInfoCard } from '@/components/account/ProfileInfoCard'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { UserNavbar } from '@/components/dashboard/UserNavbar'
import { Footer } from '@/components/home/Footer'
import { useAuth } from '@/context/useAuth'
import { useContactHistory } from '@/hooks/useContactHistory'
import { useMyProfile } from '@/hooks/useMyProfile'
import { useMyRatings } from '@/hooks/useMyRatings'

/**
 * Day 9, Dev 1: User Account Page.
 *   → Profile Info + My Ratings + Contact History
 *   → Terms & Conditions Link + Logout Button
 *
 * Replaces AccountPlaceholder.jsx (the Day 3 placeholder that only
 * ever showed "Welcome, {name}" + a logout button — this is the real
 * page the App Build schedule asked for). Route stays /account
 * (protected — see App.jsx), so nothing else in the app needs to
 * change to pick this up.
 *
 * All three data sections hit endpoints that are new today and not in
 * the API Contract PDF (GET /api/auth/me/, GET /api/ratings/mine/,
 * GET /api/contacts/history/ — flagged in each service/view's own
 * docstring). Each has its own hook and its own
 * loading/empty/error state, so one section failing (e.g. a flaky
 * network blip on just the ratings call) doesn't take down the whole
 * page the way one shared loading flag would.
 *
 * Navbar picked by role the same way ChatsPage.jsx already does
 * (DashboardNavbar for a provider, UserNavbar for a user — Day 9,
 * Dev 1/3 post-launch fix, previously the public Navbar; see
 * UserNavbar.jsx's docstring for why that reuse was an actual
 * dead-link bug, not just a style mismatch) — this page is titled
 * "User Account Page" in the schedule, but nothing stops a provider
 * from having also contacted/rated another provider, so it stays open
 * to both roles rather than gating one out with a
 * ProviderOnlyNotice-style block.
 */
function AccountPage() {
  const { user, logout } = useAuth()
  const { profile, isLoading: profileLoading, error: profileError } = useMyProfile()
  const { ratings, isLoading: ratingsLoading, error: ratingsError } = useMyRatings()
  const { history, isLoading: historyLoading, error: historyError } = useContactHistory()

  const NavbarComponent = user?.role === 'provider' ? DashboardNavbar : UserNavbar

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <NavbarComponent />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">My Account</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Your profile, ratings you&rsquo;ve given, and providers you&rsquo;ve contacted.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <ProfileInfoCard profile={profile} isLoading={profileLoading} error={profileError} />

            <div className="grid gap-5 sm:grid-cols-2">
              <MyRatingsSection ratings={ratings} isLoading={ratingsLoading} error={ratingsError} />
              <ContactHistorySection
                history={history}
                isLoading={historyLoading}
                error={historyError}
              />
            </div>

            <Card className="divide-y divide-[var(--color-border)] p-0">
              <Link
                to="/terms"
                className="flex items-center justify-between px-5 py-4 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)] sm:px-6"
              >
                <span className="flex items-center gap-2.5">
                  <ScrollText className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
                  Terms &amp; Conditions
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--color-text-subtle)]" aria-hidden="true" />
              </Link>

              <div className="px-5 py-4 sm:px-6">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-center gap-2 border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Log out
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default AccountPage