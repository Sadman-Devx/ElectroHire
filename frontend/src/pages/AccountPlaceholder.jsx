import { useAuth } from '@/context/useAuth'

function AccountPlaceholder() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">Protected route</p>
      <h1 className="text-2xl font-bold text-[var(--color-text)]">Welcome, {user?.name || 'there'}</h1>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        You&rsquo;re signed in as <strong>{user?.role}</strong>. এটা শুধু লগইন থাকলেই দেখা যায়।
      </p>
      <button
        type="button"
        onClick={logout}
        className="mt-2 rounded-[var(--radius-button)] border border-[var(--color-secondary)] px-4 py-2 text-sm font-semibold text-[var(--color-secondary)]"
      >
        Log out
      </button>
    </div>
  )
}

export default AccountPlaceholder