import { Briefcase, MapPin } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { RatingStars } from './RatingStars'

/**
 * Day 6 spec: "Profile Header (Photo, Name, Rating Stars, Area)" +
 * "Category Chips". Field names match GET /api/providers/{id}/ exactly
 * (providers/serializers.py ProviderDetailSerializer) — no transforms.
 *
 * avg_rating/review_count are hardcoded to 0/0.0 by the backend until
 * Day 7, Dev 2 builds the Rating model — shown as "New" instead of
 * "0.0 (0 reviews)", same fallback ProviderCard already uses on the
 * list page, so a freshly-approved provider doesn't read as having a
 * bad rating.
 *
 * NOTE (contract gap, flagging for the team): the detail endpoint
 * doesn't return `status`, so unlike ProviderCard on the list page
 * this header can't show a "Verified" badge without guessing — a
 * pending/rejected provider's id is just as reachable here as an
 * active one's. Left out rather than shown unconditionally so this
 * never claims a provider is verified when the data doesn't say so.
 */
function ProviderProfileHeader({ provider }) {
  const {
    name,
    area,
    experience,
    categories = [],
    avg_rating: avgRating,
    review_count: reviewCount,
    photo,
  } = provider

  const hasRatings = reviewCount > 0

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar
          src={photo}
          alt={name}
          size="h-20 w-20"
          iconSize="h-9 w-9"
          className="ring-4 ring-[var(--color-primary-tint)]"
        />

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-[var(--color-text)] sm:text-2xl">{name}</h1>

          {categories.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categories.map((categoryName) => (
                <span
                  key={categoryName}
                  className="rounded-full bg-[var(--color-primary-tint)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary-hover)]"
                >
                  {categoryName}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <RatingStars value={avgRating} size="sm" />
              <span className="font-medium text-[var(--color-text)]">
                {hasRatings ? avgRating.toFixed(1) : 'New'}
              </span>
              {hasRatings ? (
                <span>
                  ({reviewCount} review{reviewCount === 1 ? '' : 's'})
                </span>
              ) : null}
            </span>

            {area ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden="true" /> {area}
              </span>
            ) : null}

            <span className="flex items-center gap-1.5">
              <Briefcase className="h-4 w-4" aria-hidden="true" /> {experience} yr
              {experience === 1 ? '' : 's'} experience
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export { ProviderProfileHeader }