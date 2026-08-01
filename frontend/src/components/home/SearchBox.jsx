import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Category + Area search used in the Hero section.
 *
 * `categories` / `isLoading` / `error` are passed down from HomePage
 * (which owns the single `useCategories()` fetch also used by
 * PopularCategories, so the API is only ever hit once per page load).
 *
 * Submitting pushes to /providers?category=<id>&area=<text> — the
 * provider listing page itself is a later day's task, this just wires
 * the query string contract up front so that page can read it as-is.
 */
function SearchBox({ categories, isLoading, error }) {
  const navigate = useNavigate()
  const [categoryId, setCategoryId] = useState('')
  const [area, setArea] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (categoryId) params.set('category', categoryId)
    if (area.trim()) params.set('area', area.trim())
    navigate(`/providers${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-md shadow-slate-200/60 sm:flex-row sm:items-center sm:gap-2"
    >
      <div className="flex-1">
        <label htmlFor="search-category" className="sr-only">
          Category
        </label>
        <select
          id="search-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          disabled={isLoading}
          className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
        >
          <option value="">
            {isLoading ? 'Loading categories…' : 'All categories'}
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden h-8 w-px bg-[var(--color-border)] sm:block" />

      <div className="flex-1">
        <label htmlFor="search-area" className="sr-only">
          Area
        </label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
          <input
            id="search-area"
            type="text"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            placeholder="Area, e.g. Dhanmondi"
            className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full gap-2 sm:w-auto">
        <Search className="h-4 w-4" />
        Search
      </Button>

      {error ? (
        <p className="w-full text-xs text-[var(--color-danger)] sm:hidden">{error}</p>
      ) : null}
    </form>
  )
}

export { SearchBox }