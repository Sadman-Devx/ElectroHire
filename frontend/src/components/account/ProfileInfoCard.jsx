import { AlertCircle, BadgeCheck, User as UserIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatMonthYear } from '@/lib/formatDate'

const ROLE_LABELS = {
  user: 'User',
  provider: 'Provider',
}

function ProfileInfoSkeleton() {
  return (
    <Card className="animate-pulse p-6">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 flex-shrink-0 rounded-full bg-[var(--color-bg)]" />
        <div className="flex-1">
          <div className="h-4 w-32 rounded bg-[var(--color-bg)]" />
          <div className="mt-2 h-3 w-24 rounded bg-[var(--color-bg)]" />
        </div>
      </div>
      <div className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-5">
        <div className="h-3 w-full rounded bg-[var(--color-bg)]" />
        <div className="h-3 w-3/4 rounded bg-[var(--color-bg)]" />
      </div>
    </Card>
  )
}

/**
 * Day 9, Dev 1: "User Account Page" -> "Profile Info" section.
 * Sourced from GET /api/auth/me/ via useMyProfile() (both new today —
 * not in the API Contract PDF).
 */
function ProfileInfoCard({ profile, isLoading, error }) {
  if (isLoading) return <ProfileInfoSkeleton />

  if (error) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm font-medium text-[var(--color-danger)]">
        <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {error}
      </Card>
    )
  }

  if (!profile) return null

  const memberSince = formatMonthYear(profile.member_since)

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)]">
          <UserIcon className="h-6 w-6 text-[var(--color-text-subtle)]" aria-hidden="true" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-[var(--color-text)]">{profile.name}</p>
            {profile.verified ? (
              <span className="flex items-center gap-1 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-success)]">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Verified
              </span>
            ) : null}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {ROLE_LABELS[profile.role] || profile.role}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--color-text-subtle)]">Email</dt>
          <dd className="text-sm font-medium text-[var(--color-text)]">{profile.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-text-subtle)]">Phone</dt>
          <dd className="text-sm font-medium text-[var(--color-text)]">{profile.phone}</dd>
        </div>
        {memberSince ? (
          <div>
            <dt className="text-xs text-[var(--color-text-subtle)]">Member since</dt>
            <dd className="text-sm font-medium text-[var(--color-text)]">{memberSince}</dd>
          </div>
        ) : null}
      </dl>
    </Card>
  )
}

export { ProfileInfoCard }