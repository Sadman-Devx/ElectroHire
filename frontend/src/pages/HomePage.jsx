import { Navigate } from 'react-router-dom'

import { Footer } from '@/components/home/Footer'
import { Hero } from '@/components/home/Hero'
import { HowItWorks } from '@/components/home/HowItWorks'
import { Navbar } from '@/components/home/Navbar'
import { PopularCategories } from '@/components/home/PopularCategories'
import { useAuth } from '@/context/useAuth'
import { useCategories } from '@/hooks/useCategories'

/**
 * Day 4 — Dev 3: Home Page.
 *
 * Categories are fetched exactly once here (useCategories) and passed
 * down to both Hero's search dropdown and PopularCategories' grid, so
 * the page only ever hits GET /api/categories/ a single time.
 *
 * Day 9, Dev 1/3: this is the public marketing landing page — a
 * "search for a technician" hero makes sense for an anonymous
 * visitor, but not for someone already signed in. LoginPage now sends
 * a fresh login straight to the right dashboard, but this covers every
 * other way an authenticated visitor can still land on '/' (typing the
 * URL, clicking the logo, a bookmark, browser back/forward) by
 * bouncing them the same place a fresh login would go.
 */
function HomePage() {
  const { isAuthenticated, user } = useAuth()
  const { categories, isLoading, error } = useCategories()

  if (isAuthenticated) {
    return (
      <Navigate to={user?.role === 'provider' ? '/provider/dashboard' : '/dashboard'} replace />
    )
  }

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