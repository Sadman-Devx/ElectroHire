import { useState } from 'react'
import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

const RATING_LABELS = {
  0: 'Select a rating',
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
}

const STARS = [1, 2, 3, 4, 5]

/**
 * Day 8 spec: "Interactive Star Rating (Large, Clickable)" — matches
 * the design mock's 5 large tappable stars + "Very Good (4/5)" label
 * underneath (website_remaining_pages_2.html, Rating Submit page).
 *
 * Built as a `role="radiogroup"` of 5 `role="radio"` buttons rather
 * than reusing detail/RatingStars.jsx (that component is a read-only
 * *display* of an existing average, used on the provider list/detail
 * pages — this one needs click + keyboard + hover-preview input
 * behavior, different enough to warrant its own component instead of
 * bolting an `onChange` onto a display primitive).
 *
 * Hover/focus previews the star count without committing it —
 * `value` (the actually-selected rating) only changes on click/Enter.
 *
 *   const [rating, setRating] = useState(0)
 *   <StarRatingInput value={rating} onChange={setRating} />
 */
function StarRatingInput({ value = 0, onChange, disabled = false }) {
  const [previewValue, setPreviewValue] = useState(0)
  const displayValue = previewValue || value
  const label = RATING_LABELS[displayValue] ?? ''

  function clearPreview() {
    setPreviewValue(0)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Rate your experience out of 5 stars"
        className="flex items-center gap-1.5"
        onMouseLeave={clearPreview}
      >
        {STARS.map((star) => {
          const isFilled = star <= displayValue
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              disabled={disabled}
              onClick={() => onChange(star)}
              onMouseEnter={() => setPreviewValue(star)}
              onFocus={() => setPreviewValue(star)}
              onBlur={clearPreview}
              className={cn(
                'rounded-full p-1 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                !disabled && 'hover:scale-110'
              )}
            >
              <Star
                aria-hidden="true"
                className={cn(
                  'h-11 w-11 transition-colors',
                  isFilled
                    ? 'fill-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'fill-transparent text-[var(--color-border-strong)]'
                )}
              />
            </button>
          )
        })}
      </div>

      <p
        className={cn(
          'h-5 text-sm font-medium',
          displayValue > 0 ? 'text-[var(--color-primary-hover)]' : 'text-[var(--color-text-subtle)]'
        )}
      >
        {displayValue > 0 ? `${label} (${displayValue}/5)` : label}
      </p>
    </div>
  )
}

export { StarRatingInput }