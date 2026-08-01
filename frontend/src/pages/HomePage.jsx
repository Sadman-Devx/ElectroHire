import { Footer } from '@/components/home/Footer'
import { Hero } from '@/components/home/Hero'
import { HowItWorks } from '@/components/home/HowItWorks'
import { Navbar } from '@/components/home/Navbar'
import { PopularCategories } from '@/components/home/PopularCategories'
import { useCategories } from '@/hooks/useCategories'

/**
 * Day 4 — Dev 3: Home Page.
 *
 * Categories are fetched exactly once here (useCategories) and passed
 * down to both Hero's search dropdown and PopularCategories' grid, so
 * the page only ever hits GET /api/categories/ a single time.
 */
function HomePage() {
  const { categories, isLoading, error } = useCategories()

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />
      <main className="flex-1">
        <Hero categories={categories} isLoading={isLoading} error={error} />
        <PopularCategories categories={categories} isLoading={isLoading} error={error} />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  )
}

export default HomePage