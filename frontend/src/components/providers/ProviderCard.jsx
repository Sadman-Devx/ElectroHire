import { Link } from 'react-router-dom'
import { Briefcase, MapPin, Star } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * Single provider card — Photo, Name, Categories, Rating, Area (Day 5
 * spec). Matches the exact field names GET /api/providers/ returns
 * (see providers/serializers.py ProviderListSerializer), so nothing
 * here needs to guess or transform the API response.
 *
 * "View Profile" points at /providers/:id — that detail page is
 * Day 6, Dev 1's task and doesn't exist yet. Same pattern Day 4
 * already used: PopularCategories and SearchBox link to /providers
 * before this very page existed.
 *
 * avg_rating / review_count come back as 0 / 0.0 from the backend
 * until the Rating model lands (Day 7, Dev 2) — shown as "New"
 * instead of "0.0 (0)" so a freshly-approved provider doesn't read as
 * having a bad rating.
 */
function ProviderCard({ provider }) {
  const {
    id,
    name,
    area,
    experience,
    photo,
    categories = [],
    avg_rating: avgRating,
    review_count: reviewCount,
    status,
  } = provider

  const hasRatings = reviewCount > 0

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-4">
        <Avatar src={photo} alt={name} size="h-14 w-14" iconSize="h-6 w-6" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-semibold text-[var(--color-text)]">{name}</p>
            {/* The list endpoint only ever returns status="active" providers,
                so this is always true today — kept explicit rather than
                unconditional in case the backend ever also lists other
                statuses (e.g. a future admin preview mode). */}
            {status === 'active' ? (
              <span className="rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-success)]">
                Verified
              </span>
            ) : null}
          </div>

          {categories.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {categories.map((categoryName) => (
                <span
                  key={categoryName}
                  className="rounded-full bg-[var(--color-primary-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-primary-hover)]"
                >
                  {categoryName}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-[var(--color-primary)] text-[var(--color-primary)]" />
              {hasRatings ? (
                <>
                  <span className="font-medium text-[var(--color-text)]">
                    {avgRating.toFixed(1)}
                  </span>
                  <span>({reviewCount})</span>
                </>
              ) : (
                'New'
              )}
            </span>
            {area ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {area}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" /> {experience} yr{experience === 1 ? '' : 's'} exp.
            </span>
          </div>
        </div>
      </div>

      <Button asChild size="sm" className="w-full flex-shrink-0 sm:w-auto">
        <Link to={`/providers/${id}`}>View Profile</Link>
      </Button>
    </Card>
  )
}

export { ProviderCard }