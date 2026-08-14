import { Link } from 'react-router-dom'
import { AlertCircle, Star } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { RatingStars } from '@/components/providers/detail/RatingStars'
import { formatConversationTime } from '@/lib/formatChatTime'

const TAG_LABELS = {
  on_time: 'On time',
  professional: 'Professional',
  good_work: 'Good work',
  fair_price: 'Fair price',
}

function RatingItemSkeleton() {
  return (
    <div className="animate-pulse py-3">
      <div className="h-3.5 w-28 rounded bg-[var(--color-bg)]" />
      <div className="mt-2 h-3 w-full rounded bg-[var(--color-bg)]" />
    </div>
  )
}

/**
 * Day 9, Dev 1: "User Account Page" -> "My Ratings" section. Sourced
 * from GET /api/ratings/mine/ via useMyRatings() (both new today —
 * not in the API Contract PDF). Same skeleton/empty/error shape as
 * components/dashboard/RecentMessagesPreview.jsx.
 */
function MyRatingsSection({ ratings, isLoading, error }) {
  return (
    <Card className="p-5 sm:p-6">
      <p className="mb-1 text-sm font-semibold text-[var(--color-text)]">My ratings</p>

      {isLoading ? (
        <div className="divide-y divide-[var(--color-border)]">
          <RatingItemSkeleton />
          <RatingItemSkeleton />
        </div>
      ) : error ? (
        <p className="flex items-center gap-2 py-6 text-sm font-medium text-[var(--color-danger)]">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : ratings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Star className="h-7 w-7 text-[var(--color-text-subtle)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-text-muted)]">
            You haven&rsquo;t rated any providers yet.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {ratings.map((rating, index) => (
            <li key={`${rating.provider_id}-${index}`} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/providers/${rating.provider_id}`}
                  className="text-sm font-medium text-[var(--color-text)] hover:underline"
                >
                  {rating.provider_name}
                </Link>
                <span className="flex-shrink-0 text-xs text-[var(--color-text-subtle)]">
                  {formatConversationTime(rating.created_at)}
                </span>
              </div>

              <RatingStars value={rating.rating_value} size="sm" className="mt-1.5" />

              {rating.review_text ? (
                <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">{rating.review_text}</p>
              ) : null}

              {rating.tags?.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rating.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--color-primary-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-primary-hover)]"
                    >
                      {TAG_LABELS[tag] || tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export { MyRatingsSection }