import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { Footer } from '@/components/home/Footer'
import { Navbar } from '@/components/home/Navbar'
import { ProviderFilters } from '@/components/providers/ProviderFilters'
import { ProviderList } from '@/components/providers/ProviderList'
import { ProviderSort } from '@/components/providers/ProviderSort'
import { useCategories } from '@/hooks/useCategories'
import { useProviders } from '@/hooks/useProviders'

/**
 * Day 5 — Dev 1: Provider List Page.
 *   → Filter Sidebar (Category Dropdown + Area Input)
 *   → Sort (Rating অনুযায়ী)
 *   → Provider Card Component (Photo, Name, Categories, Rating, Area)
 *   → Provider List API Connect
 *   → Search Button Click করলে Filter Apply হবে
 *
 * Filters live in the URL (?category=&area=&sort=) rather than local
 * page state, for two reasons:
 *   1. Day 4's Home page already links here two different ways —
 *      SearchBox as /providers?category=<id>&area=<text>, and
 *      PopularCategories as /providers?category=<id> — this page
 *      needs to land on the right filters without knowing about
 *      either sender.
 *   2. Bookmarking/sharing a filtered search and the browser
 *      back/forward buttons both work for free this way.
 */
function ProvidersPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const categoryId = searchParams.get('category') ?? ''
  const area = searchParams.get('area') ?? ''
  const sort = searchParams.get('sort') ?? ''

  // Fetched once here and shared between the filter dropdown and the
  // breadcrumb/results label — same single-fetch pattern HomePage
  // uses for Hero + PopularCategories.
  const { categories, isLoading: isLoadingCategories } = useCategories()
  const { providers, count, isLoading, error } = useProviders({
    category: categoryId,
    area,
    sort,
  })

  const categoryName = useMemo(
    () => categories.find((category) => String(category.id) === String(categoryId))?.name,
    [categories, categoryId]
  )

  function handleApplyFilters({ category, area: nextArea }) {
    const next = new URLSearchParams(searchParams)
    if (category) next.set('category', category)
    else next.delete('category')
    if (nextArea) next.set('area', nextArea)
    else next.delete('area')
    setSearchParams(next)
  }

  function handleSortChange(nextSort) {
    const next = new URLSearchParams(searchParams)
    if (nextSort) next.set('sort', nextSort)
    else next.delete('sort')
    setSearchParams(next)
  }

  const breadcrumbLabel = categoryName
    ? `${categoryName}${area ? ` in ${area}` : ''}`
    : area
      ? `Providers in ${area}`
      : 'All providers'

  const resultsSuffix = `${area ? ` in ${area}` : ''}${categoryName ? ` for ${categoryName}` : ''}`

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm">
            <Link to="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" />
            <span className="font-medium text-[var(--color-text)]">{breadcrumbLabel}</span>
          </nav>

          <div className="grid gap-6 lg:grid-cols-[272px_1fr]">
            <aside className="flex flex-col gap-4">
              <ProviderFilters
                categories={categories}
                isLoadingCategories={isLoadingCategories}
                categoryId={categoryId}
                area={area}
                onApply={handleApplyFilters}
              />
              <ProviderSort sort={sort} onChange={handleSortChange} />
            </aside>

            <section>
              <p
                data-testid="results-summary"
                className="mb-4 text-sm text-[var(--color-text-muted)]"
              >
                {isLoading ? (
                  'Searching providers…'
                ) : (
                  <>
                    <span className="font-semibold text-[var(--color-text)]">{count}</span>{' '}
                    provider{count === 1 ? '' : 's'} found{resultsSuffix}
                  </>
                )}
              </p>

              <ProviderList providers={providers} isLoading={isLoading} error={error} />
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ProvidersPage