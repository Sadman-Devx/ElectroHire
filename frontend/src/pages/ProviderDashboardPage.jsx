import { AlertCircle, BadgeCheck, Star, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { RecentMessagesPreview } from '@/components/dashboard/RecentMessagesPreview'
import { StatCard } from '@/components/dashboard/StatCard'
import { Footer } from '@/components/home/Footer'
import { ProviderOnlyNotice } from '@/components/providers/ProviderOnlyNotice'
import { RatingStars } from '@/components/providers/detail/RatingStars'
import { ProviderStatusBadge } from '@/components/providers/status/ProviderStatusBadge'
import { useAuth } from '@/context/useAuth'
import { useProviderDashboard } from '@/hooks/useProviderDashboard'
import { useProviderMyProfile } from '@/hooks/useProviderMyProfile'

/**
 * Day 6 — Dev 3: Provider Dashboard.
 *   → Stats Cards (Contacts, Ratings, Avg Rating)
 *   → Recent Messages Preview Section
 *   → Navbar (Dashboard, Chats, Reviews, Profile)
 *
 * Route: /provider/dashboard (protected — see App.jsx).
 *
 * Verified/Active/Pending badge + "Edit profile" link (Day 9, Dev 3):
 * the Day 6 version of this page deliberately left the status pill
 * out because no endpoint existed to tell a provider their own
 * status — see GET /api/providers/me/ (providers/views.py
 * ProviderMeView), built today for the Provider Profile Edit Page and
 * reused here via useProviderMyProfile() to finally close that gap.
 * Kept lightweight on purpose: this second fetch has its own
 * loading/error state and simply renders nothing extra until it
 * resolves, so a slow or failed profile fetch never blocks the stats
 * cards or recent-messages section below, which still come from
 * useProviderDashboard() as before.
 *
 * Stats + recent messages both come from useProviderDashboard().
 * A provider who hasn't completed POST /api/providers/profile/ yet
 * sees the honest "not available yet" state below rather than an
 * error — see that hook's own docstring.
 */
function ProviderDashboardPage() {
  const { user } = useAuth()
  const { dashboard, isLoading, error, isAvailable } = useProviderDashboard()
  const { profile } = useProviderMyProfile()

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
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">Provider Dashboard</h1>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Welcome back{user?.name ? `, ${user.name}` : ''}. Here&rsquo;s how your profile is
                doing.
              </p>
            </div>

            {profile ? (
              <div className="flex items-center gap-2">
                {profile.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-success)]">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Verified
                  </span>
                ) : null}
                <ProviderStatusBadge status={profile.status} />
                <Link
                  to="/provider/profile-edit"
                  className="text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline"
                >
                  Edit profile
                </Link>
              </div>
            ) : null}
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