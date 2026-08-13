import { cn } from '@/lib/utils'

/**
 * Day 8 spec: "Quick Tags (On time, Professional, Good work, Fair
 * price)". These four values are kept in sync with
 * backend/ratings/serializers.py's ALLOWED_TAGS = {"on_time",
 * "professional", "good_work", "fair_price"} — any tag sent that
 * isn't in that set is silently dropped server-side
 * (RatingCreateSerializer.validate_tags), so this list intentionally
 * does NOT include a "Would hire again" chip the way the early
 * design mock sketch did (website_remaining_pages_2.html) — offering
 * a tag the backend would just discard would make a selected chip
 * quietly vanish after submit, which is worse than not offering it.
 */
const RATING_TAGS = [
  { value: 'on_time', label: 'On time', emoji: '✅' },
  { value: 'professional', label: 'Professional', emoji: '👍' },
  { value: 'good_work', label: 'Good work', emoji: '🔨' },
  { value: 'fair_price', label: 'Fair price', emoji: '💰' },
]

/**
 *   const [tags, setTags] = useState([])
 *   <RatingTagSelector selected={tags} onChange={setTags} />
 */
function RatingTagSelector({ selected = [], onChange, disabled = false }) {
  function toggleTag(tagValue) {
    if (selected.includes(tagValue)) {
      onChange(selected.filter((tag) => tag !== tagValue))
    } else {
      onChange([...selected, tagValue])
    }
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick feedback tags">
      {RATING_TAGS.map((tag) => {
        const isSelected = selected.includes(tag.value)
        return (
          <button
            key={tag.value}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => toggleTag(tag.value)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isSelected
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
            )}
          >
            <span aria-hidden="true">{tag.emoji}</span> {tag.label}
          </button>
        )
      })}
    </div>
  )
}

export { RatingTagSelector, RATING_TAGS }