import { Star, User as UserIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RatingStars } from './RatingStars'

const PREVIEW_LIMIT = 3

/**
 * Day 6 spec: "Reviews Preview (2-3টা দেখাবে)".
 *
 * GET /api/providers/{id}/ only returns avg_rating/review_count, both
 * hardcoded to 0/0.0 until Day 7, Dev 2 builds the Rating model (see
 * providers/serializers.py ProviderDetailSerializer's TODO comments).
 * There's no embedded review list on this endpoint, and the list
 * endpoint (GET /api/providers/{id}/ratings/) doesn't exist yet
 * either — so `reviews` always defaults to [] today and this always
 * renders the empty state.
 *
 * `reviews` is accepted as a prop on purpose rather than fetched here,
 * so wiring in the real list once Day 7 lands is a one-line change on
 * the page (pass real data in) instead of a rewrite of this component.
 * Expected shape per the contract's ratings list response:
 *   { user_name, rating_value, review_text, created_at }
 */
function ProviderReviewsPreview({ reviewCount = 0, reviews = [] }) {
  const preview = reviews.slice(0, PREVIEW_LIMIT)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reviews{reviewCount > 0 ? ` (${reviewCount})` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        {preview.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Star className="h-7 w-7 text-[var(--color-text-subtle)]" aria-hidden="true" />
            <p className="text-sm font-medium text-[var(--color-text)]">No reviews yet</p>
            <p className="max-w-xs text-xs text-[var(--color-text-muted)]">
              Reviews show up here once users who&rsquo;ve contacted this provider rate their
              experience.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {preview.map((review, index) => (
              <li
                key={`${review.user_name}-${review.created_at}-${index}`}
                className="border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)]">
                    <UserIcon className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" aria-hidden="true" />
                  </div>
                  <p className="flex-1 truncate text-sm font-medium text-[var(--color-text)]">
                    {review.user_name}
                  </p>
                  <RatingStars value={review.rating_value} size="sm" />
                </div>
                {review.review_text ? (
                  <p className="text-sm text-[var(--color-text-muted)]">{review.review_text}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export { ProviderReviewsPreview }