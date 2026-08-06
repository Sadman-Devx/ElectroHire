import { AlertCircle, Star, TrendingUp, Users } from 'lucide-react'

import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { RecentMessagesPreview } from '@/components/dashboard/RecentMessagesPreview'
import { StatCard } from '@/components/dashboard/StatCard'
import { Footer } from '@/components/home/Footer'
import { ProviderOnlyNotice } from '@/components/providers/ProviderOnlyNotice'
import { RatingStars } from '@/components/providers/detail/RatingStars'
import { useAuth } from '@/context/useAuth'
import { useProviderDashboard } from '@/hooks/useProviderDashboard'

/**
 * Day 6 — Dev 3: Provider Dashboard.
 *   → Stats Cards (Contacts, Ratings, Avg Rating)
 *   → Recent Messages Preview Section
 *   → Navbar (Dashboard, Chats, Reviews, Profile)
 *
 * Route: /provider/dashboard (protected — see App.jsx).
 *
 * No "Active"/"Pending" status pill in the header on purpose: the
 * backend has no endpoint today that tells a provider their own
 * status, so showing one here would mean either hardcoding "Active"
 * for every provider — wrong for anyone still pending — or inventing
 * data. Left out rather than guessed.
 *
 * Stats + recent messages both come from useProviderDashboard(), which
 * hits a route that doesn't exist until Day 9, Dev 2. Today every
 * provider sees the honest "not available yet" state below — that's
 * correct behavior for Day 6, not a bug.
 */
function ProviderDashboardPage() {
  const { user } = useAuth()
  const { dashboard, isLoading, error, isAvailable } = useProviderDashboard()

  if (user && user.role !== 'provider') {
    return (
      <ProviderOnlyNotice description="You're signed in as a user account. The provider dashboard is only for accounts that signed up to offer a service." />
    )
  }

  const notAvailableNote = 'Coming soon'

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <DashboardNavbar />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Provider Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Welcome back{user?.name ? `, ${user.name}` : ''}. Here&rsquo;s how your profile is
              doing.
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-6 flex items-center gap-2 rounded-[var(--radius-input)] bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Users}
              label="Total contacts"
              value={dashboard?.contacts_count}
              isLoading={isLoading}
              isAvailable={isAvailable}
              unavailableNote={notAvailableNote}
            />
            <StatCard
              icon={Star}
              label="Total ratings"
              value={dashboard?.ratings_count}
              isLoading={isLoading}
              isAvailable={isAvailable}
              unavailableNote={notAvailableNote}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg. rating"
              value={dashboard?.avg_rating}
              isLoading={isLoading}
              isAvailable={isAvailable}
              unavailableNote={notAvailableNote}
              render={(value) => (
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-[var(--color-text)]">
                    {Number(value ?? 0).toFixed(1)}
                  </p>
                  <RatingStars value={Number(value ?? 0)} size="sm" />
                </div>
              )}
            />
          </div>

          <div className="mt-6">
            <RecentMessagesPreview
              messages={dashboard?.recent_messages}
              isLoading={isLoading}
              isAvailable={isAvailable}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ProviderDashboardPage