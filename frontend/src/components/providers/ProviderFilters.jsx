import { useState } from 'react'
import { MapPin, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Filter Sidebar "Search" card — Category dropdown + Area input, per
 * Day 5 spec. Keeps its own draft state instead of writing straight
 * to the URL on every keystroke: the spec is "Search Button Click
 * করলে Filter Apply হবে" (filters apply on the button click), so
 * `onApply` only fires on submit — typing in the area box must not
 * trigger a fetch on every character.
 *
 * `categories` / `isLoadingCategories` come from ProvidersPage's
 * single useCategories() call, same sharing pattern HomePage already
 * uses between Hero and PopularCategories.
 */
function ProviderFilters({ categories, isLoadingCategories, categoryId, area, onApply }) {
  const [draftCategory, setDraftCategory] = useState(categoryId)
  const [draftArea, setDraftArea] = useState(area)

  // Stay in sync when the URL changes from elsewhere — a category
  // card clicked on the Home page, or the browser back/forward button
  // — so the sidebar never shows stale filters next to fresh results.
  // Adjusted during render (React's documented pattern for deriving
  // state from changed props) rather than in a useEffect, so this
  // doesn't cost an extra render pass.
  const [prevCategoryId, setPrevCategoryId] = useState(categoryId)
  const [prevArea, setPrevArea] = useState(area)
  if (categoryId !== prevCategoryId) {
    setPrevCategoryId(categoryId)
    setDraftCategory(categoryId)
  }
  if (area !== prevArea) {
    setPrevArea(area)
    setDraftArea(area)
  }

  function handleSubmit(event) {
    event.preventDefault()
    onApply({ category: draftCategory, area: draftArea.trim() })
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Search</h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-category">Category</Label>
          <select
            id="filter-category"
            value={draftCategory}
            onChange={(event) => setDraftCategory(event.target.value)}
            disabled={isLoadingCategories}
            className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
          >
            <option value="">{isLoadingCategories ? 'Loading categories…' : 'All categories'}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-area">Area</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
            <Input
              id="filter-area"
              value={draftArea}
              onChange={(event) => setDraftArea(event.target.value)}
              placeholder="e.g. Dhanmondi"
              className="pl-9"
            />
          </div>
        </div>

        <Button type="submit" className="w-full gap-2">
          <Search className="h-4 w-4" />
          Apply
        </Button>
      </form>
    </Card>
  )
}

export { ProviderFilters }