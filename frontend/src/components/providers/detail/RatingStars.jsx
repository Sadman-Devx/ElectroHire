import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

const SIZE_CLASSES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

/**
 * A row of 5 stars, filled up to Math.round(value). Rounds to the
 * nearest whole star rather than rendering partial/half-star clipping
 * — simpler to get right and matches how ProviderCard already reads
 * avg_rating elsewhere in the app.
 */
function RatingStars({ value = 0, size = 'md', className }) {
  const filledCount = Math.min(5, Math.max(0, Math.round(value)))
  const starClass = SIZE_CLASSES[size] || SIZE_CLASSES.md

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={cn(
            starClass,
            index < filledCount
              ? 'fill-[var(--color-primary)] text-[var(--color-primary)]'
              : 'fill-transparent text-[var(--color-border-strong)]'
          )}
        />
      ))}
    </div>
  )
}

export { RatingStars }