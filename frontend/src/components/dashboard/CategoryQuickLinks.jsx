import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { getCategoryIcon } from '@/lib/categoryIcons'

const MAX_VISIBLE = 5

/**
 * Day 9, Dev 3 (post-launch addition): compact "jump straight to a
 * category" chip row for the User Dashboard, sitting between the
 * quick-search box and the Recently Contacted / My Ratings cards.
 * Links to /providers?category=<id> — the exact same URL shape
 * SearchBox and PopularCategories already build (see
 * pages/ProvidersPage.jsx), so no changes needed anywhere else.
 *
 * Deliberately *not* PopularCategories reused as-is: that component
 * is HomePage's big marketing grid (section heading, description,
 * large cards) aimed at convincing an anonymous visitor there's a
 * category for them. A signed-in user has already been converted —
 * repeating that pitch on their own dashboard is friction, not
 * onboarding. This is the same list of categories in a much smaller,
 * shortcut-only form, sorted the same order the API returns (no
 * separate "popular" ranking exists yet).
 *
 * Renders nothing while loading, on error, or if there are no
 * categories at all — the search box directly above already covers
 * "search by category," so this row only ever adds value, never a
 * loading skeleton or an error banner competing for attention on a
 * dashboard.
 */
function CategoryQuickLinks({ categories, isLoading, error }) {
  if (isLoading || error || categories.length === 0) return null

  const visible = categories.slice(0, MAX_VISIBLE)
  const hasMore = categories.length > MAX_VISIBLE

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
      {visible.map((category) => {
        const Icon = getCategoryIcon(category.icon)
        return (
          <Link
            key={category.id}
            to={`/providers?category=${category.id}`}
            className="flex flex-shrink-0 items-center gap-2 rounded-full bg-[var(--color-surface)] py-1.5 pl-2 pr-3.5 text-sm font-medium text-[var(--color-text)] ring-1 ring-inset ring-[var(--color-border)] transition-colors hover:ring-[var(--color-primary)]"
          >
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            {category.name}
          </Link>
        )
      })}
      {hasMore ? (
        <Link
          to="/providers"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-dashed border-[var(--color-border)] py-1.5 pl-3 pr-3.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  )
}

export { CategoryQuickLinks }