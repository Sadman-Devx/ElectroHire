import { Link } from 'react-router-dom'

/**
 * Placeholder only — the real Home page (hero, search, categories,
 * top providers) is Day 4, Dev 3's task. This just gives the router a
 * valid "/" so Signup/Login have somewhere real to land for now.
 */
function HomePlaceholder() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
        Coming Day 4
      </p>
      <h1 className="text-2xl font-bold text-[var(--color-text)]">Home page placeholder</h1>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        The real home page (search, categories, top providers) hasn&rsquo;t been built yet.
        Signup and Login are ready to try below.
      </p>
      <div className="mt-2 flex gap-3">
        <Link
          to="/login"
          className="rounded-[var(--radius-button)] border border-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-[var(--color-secondary)]"
        >
          Log in
        </Link>
        <Link
          to="/signup"
          className="rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          Sign up
        </Link>
      </div>
    </div>
  )
}

export default HomePlaceholder