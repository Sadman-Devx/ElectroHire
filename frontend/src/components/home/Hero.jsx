import heroImage from '@/assets/hero.png'
import { SearchBox } from '@/components/home/SearchBox'

/**
 * Title + Search Box (Category + Area), per Day 4 spec.
 * `categories` / `isLoading` / `error` come from HomePage's single
 * useCategories() call and are just forwarded to SearchBox.
 */
function Hero({ categories, isLoading, error }) {
  return (
    <section id="home" className="bg-[var(--color-bg)]">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-2 lg:gap-8 lg:pb-24">
        <div>
          <span className="inline-flex items-center rounded-full bg-[var(--color-primary-tint)] px-3 py-1 text-xs font-semibold text-[var(--color-primary-hover)]">
            Trusted local service providers
          </span>

          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-[var(--color-text)] sm:text-5xl">
            Find a skilled <span className="text-[var(--color-primary)]">technician</span> near
            you, in minutes
          </h1>

          <p className="mt-4 max-w-md text-base text-[var(--color-text-muted)]">
            Electricians, plumbers, AC mechanics and more — search by category and area, then
            connect directly with a verified provider.
          </p>

          <div className="mt-8">
            <SearchBox categories={categories} isLoading={isLoading} error={error} />
            {error ? (
              <p className="mt-2 hidden text-xs text-[var(--color-danger)] sm:block">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <img
            src={heroImage}
            alt="Technician ready to help with a repair"
            className="w-full max-w-[320px] drop-shadow-xl"
            width={343}
            height={361}
          />
        </div>
      </div>
    </section>
  )
}

export { Hero }