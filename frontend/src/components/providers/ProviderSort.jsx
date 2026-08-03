import { Card } from '@/components/ui/card'

/**
 * Filter Sidebar "Sort by" card — Day 5 spec: "Sort (Rating অনুযায়ী)".
 *
 * Only offers what GET /api/providers/?sort=... actually supports per
 * the API Contract (`sort=rating`; anything else is newest-first).
 * The App Build mockup also shows a "Most reviewed" radio, but
 * avg_rating/review_count are hardcoded to 0 on the backend until the
 * Rating model exists (Day 7, Dev 2) — a review-count sort would just
 * be a no-op dressed up as a working feature, so it's left out until
 * it can actually do something. Once Day 7 lands, add a `review_count`
 * option here; ProviderListView already documents the same TODO.
 *
 * Selecting an option applies immediately (no Apply button needed),
 * matching the mockup's separation between the "Search" card (applies
 * on click) and this "Sort by" card (applies on selection).
 */
const SORT_OPTIONS = [
  { value: 'rating', label: 'Highest rated' },
  { value: '', label: 'Newest first' },
]

function ProviderSort({ sort, onChange }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Sort by</h2>
      <div className="flex flex-col gap-2.5">
        {SORT_OPTIONS.map((option) => (
          <label
            key={option.label}
            className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--color-text)]"
          >
            <input
              type="radio"
              name="provider-sort"
              value={option.value}
              checked={sort === option.value}
              onChange={() => onChange(option.value)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            {option.label}
          </label>
        ))}
      </div>
    </Card>
  )
}

export { ProviderSort }