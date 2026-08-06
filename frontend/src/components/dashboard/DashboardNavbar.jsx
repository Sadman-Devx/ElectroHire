import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, User as UserIcon, X, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/useAuth'
import { cn } from '@/lib/utils'

/**
 * Day 6 spec: "Navbar (Dashboard, Chats, Reviews, Profile)" — the
 * logged-in-provider counterpart to home/Navbar.jsx's public
 * marketing navbar.
 *
 * - Chats  -> /chats           (Day 7, Dev 3 — page doesn't exist yet)
 * - Reviews -> /provider/reviews (not yet built — same forward-link
 *   pattern the app already uses elsewhere, e.g. ProviderCard linking
 *   to /providers/:id a full day before that page existed)
 * - Profile -> /provider/profile-setup — reuses today's setup page,
 *   which already POSTs as an upsert (update_or_create), so it
 *   doubles as "edit profile" until Day 9, Dev 3 builds a dedicated
 *   Provider Profile Edit Page.
 */
const NAV_LINKS = [
  { label: 'Dashboard', to: '/provider/dashboard' },
  { label: 'Chats', to: '/chats' },
  { label: 'Reviews', to: '/provider/reviews' },
  { label: 'Profile', to: '/provider/profile-setup' },
]

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--color-primary)] text-white">
        <Zap className="h-5 w-5" fill="currentColor" />
      </span>
      <span className="text-lg font-bold tracking-tight text-[var(--color-text)]">
        ElectroHire
      </span>
    </Link>
  )
}

function NavItem({ to, label, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'text-sm font-medium transition-colors',
          isActive
            ? 'text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        )
      }
    >
      {label}
    </NavLink>
  )
}

function UserMenu({ onNavigate }) {
  const { user, logout } = useAuth()

  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2 sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg)]">
          <UserIcon className="h-4 w-4 text-[var(--color-text-subtle)]" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium text-[var(--color-text)]">{user?.name || 'Provider'}</span>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          logout()
          onNavigate?.()
        }}
      >
        Log out
      </Button>
    </div>
  )
}

function DashboardNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <ul className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavItem to={link.to} label={link.label} />
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden md:block">
          <UserMenu />
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-button)] text-[var(--color-text)] md:hidden"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {isMenuOpen ? (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-5 pt-2 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <div
                  className="block rounded-[var(--radius-button)] px-2 py-2.5 hover:bg-[var(--color-bg)]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <NavItem to={link.to} label={link.label} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
            <UserMenu onNavigate={() => setIsMenuOpen(false)} />
          </div>
        </div>
      ) : null}
    </header>
  )
}

export { DashboardNavbar }