import { Link } from 'react-router-dom'

import { getCategoryIcon } from '@/lib/categoryIcons'

const SKELETON_COUNT = 6

function CategorySkeleton() {
  return (
    <div className="flex animate-pulse flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="h-12 w-12 rounded-full bg-[var(--color-bg)]" />
      <div className="h-3.5 w-16 rounded bg-[var(--color-bg)]" />
    </div>
  )
}

/**
 * Popular Categories — Category API Connect করা (Dynamic দেখাবে).
 * `categories` / `isLoading` / `error` come from HomePage's single
 * useCategories() call (shared with the Hero search dropdown).
 */
function PopularCategories({ categories, isLoading, error }) {
  return (
    <section id="categories" className="bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
            Popular Categories
          </h2>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Browse services by category and get matched with a nearby provider.
          </p>
        </div>

        {error ? (
          <p className="mt-8 text-center text-sm text-[var(--color-danger)]">{error}</p>
        ) : null}

        {!error && !isLoading && categories.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
            No categories available yet — check back soon.
          </p>
        ) : null}

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {isLoading
            ? Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                <CategorySkeleton key={`skeleton-${index}`} />
              ))
            : categories.map((category) => {
                const Icon = getCategoryIcon(category.icon)
                return (
                  <Link
                    key={category.id}
                    to={`/providers?category=${category.id}`}
                    className="group flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-tint)]"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)] transition-colors group-hover:bg-[var(--color-primary)] group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text)]">
                      {category.name}
                    </span>
                  </Link>
                )
              })}
        </div>
      </div>
    </section>
  )
}

export { PopularCategories }