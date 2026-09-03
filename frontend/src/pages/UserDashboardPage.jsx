import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ContactHistorySection } from '@/components/account/ContactHistorySection'
import { MyRatingsSection } from '@/components/account/MyRatingsSection'
import { CategoryQuickLinks } from '@/components/dashboard/CategoryQuickLinks'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { UserNavbar } from '@/components/dashboard/UserNavbar'
import { Footer } from '@/components/home/Footer'
import { SearchBox } from '@/components/home/SearchBox'
import { useAuth } from '@/context/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useContactHistory } from '@/hooks/useContactHistory'
import { useMyRatings } from '@/hooks/useMyRatings'

// How many items to show in each "recent" list before pointing to the
// full history on /account — both APIs already return newest-first
// (see contactService.js / ratingService.js), so this is a plain
// client-side slice, no new query params needed on either endpoint.
const RECENT_ITEMS_LIMIT = 5

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Day 9 — Dev 3: User Dashboard.
 *   → Quick Search Box (Home-এর মতো)
 *   → Recently Contacted List
 *   → My Ratings List
 *
 * Route: /dashboard (protected — see App.jsx).
 *
 * "Provider Dashboard API Connect করো" in the Day 9 schedule reads
 * like a copy-paste leftover from Dev 2's card on the same day — a
 * *User* Dashboard has no reason to call GET /api/providers/dashboard/,
 * that endpoint is scoped to the caller's own Provider row (see its
 * docstring) and 403s for anyone without one. What a user landing page
 * actually needs — recent contacts and recent ratings — already
 * exists as of today (Day 9, Dev 1: GET /api/contacts/history/ and
 * GET /api/ratings/mine/, via useContactHistory()/useMyRatings()), so
 * this reuses those instead of inventing a new endpoint.
 *
 * Reuses ContactHistorySection / MyRatingsSection / SearchBox as-is
 * (sliced to RECENT_ITEMS_LIMIT items) rather than building parallel
 * components — same reasoning AccountPage.jsx already documents for
 * why one broken section shouldn't take down the rest of the page.
 *
 * Navbar picked by role, same pattern AccountPage.jsx and
 * ChatsPage.jsx already use: nothing stops a provider account from
 * also contacting/rating other providers, so this stays open to both
 * roles rather than gating one out. A non-provider gets UserNavbar
 * (Day 9, Dev 1/3 post-launch fix) rather than the public Navbar —
 * see UserNavbar.jsx's docstring for why reusing the marketing Navbar
 * here was an actual dead-link bug, not just a style mismatch.
 *
 * CategoryQuickLinks (same fix) sits between the search box and the
 * two list cards — a fast "jump straight to a category" shortcut for
 * a returning user, distinct from HomePage's bigger marketing-oriented
 * PopularCategories grid (see CategoryQuickLinks.jsx's docstring).
 */
function UserDashboardPage() {
  const { user } = useAuth()
  const { categories, isLoading: isLoadingCategories, error: categoriesError } = useCategories()
  const { history, isLoading: historyLoading, error: historyError } = useContactHistory()
  const { ratings, isLoading: ratingsLoading, error: ratingsError } = useMyRatings()

  const NavbarComponent = user?.role === 'provider' ? DashboardNavbar : UserNavbar

  const recentHistory = history.slice(0, RECENT_ITEMS_LIMIT)
  const recentRatings = ratings.slice(0, RECENT_ITEMS_LIMIT)

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <NavbarComponent />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              {getGreeting()}{user?.name ? `, ${user.name}` : ''} 👋
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Find a service provider today
            </p>
          </div>

          <div className="mb-6">
            <SearchBox categories={categories} isLoading={isLoadingCategories} error={categoriesError} />
          </div>

          <CategoryQuickLinks
            categories={categories}
            isLoading={isLoadingCategories}
            error={categoriesError}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <ContactHistorySection
              title="Recently contacted"
              history={recentHistory}
              isLoading={historyLoading}
              error={historyError}
            />
            <MyRatingsSection ratings={recentRatings} isLoading={ratingsLoading} error={ratingsError} />
          </div>

          <Link
            to="/account"
            className="mt-5 flex items-center justify-center gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)]"
          >
            View your full account &amp; history
            <ChevronRight className="h-4 w-4 text-[var(--color-text-subtle)]" aria-hidden="true" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default UserDashboardPage