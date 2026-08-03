import { Check } from 'lucide-react'

import { getCategoryIcon } from '@/lib/categoryIcons'
import { cn } from '@/lib/utils'

/**
 * Chip/tag style multi-select — Day 5 spec: "Multiple Category Select
 * (Chip/Tag Style)". Each chip is an independent aria-pressed toggle
 * (not a radiogroup) since any number of categories can be selected.
 */
function CategoryMultiSelect({ categories, selectedIds, onToggle, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2" aria-busy="true" aria-label="Loading categories">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-9 w-28 animate-pulse rounded-full bg-slate-200" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-[var(--color-danger)]">{error}</p>
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        No categories are available right now. Please try again later.
      </p>
    )
  }

  return (
    <div role="group" aria-label="Service categories — select all that apply" className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const selected = selectedIds.includes(category.id)
        const Icon = getCategoryIcon(category.icon)

        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(category.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)]',
              selected
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]'
            )}
          >
            {selected ? (
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
            ) : (
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {category.name}
          </button>
        )
      })}
    </div>
  )
}

export { CategoryMultiSelect }