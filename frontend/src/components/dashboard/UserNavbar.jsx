import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, User as UserIcon, X, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/useAuth'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Messages', to: '/chats', showUnreadBadge: true },
  { label: 'Account', to: '/account' },
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

function NavItem({ to, label, badgeCount, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        )
      }
    >
      {label}
      {badgeCount > 0 ? (
        <span
          className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-[11px] font-semibold text-white"
          aria-label={`${badgeCount} unread message${badgeCount === 1 ? '' : 's'}`}
        >
          {badgeCount}
        </span>
      ) : null}
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
        <span className="text-sm font-medium text-[var(--color-text)]">{user?.name || 'there'}</span>
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

/**
 * Day 9, Dev 1/3 (post-launch fix): dedicated navbar for a signed-in
 * "user" (non-provider) account, used on UserDashboardPage, AccountPage
 * and ChatsPage — same three pages that previously reused the public
 * Navbar (components/home/Navbar.jsx) for that role.
 *
 * That reuse had a real bug, not just a style mismatch: Navbar's
 * "Home" / "Categories" / "How it Works" links are '#home' /
 * '#categories' / '#how-it-works' hash anchors, which only resolve to
 * something because HomePage.jsx renders matching `id="..."` sections.
 * On every other route (this navbar's three pages included) those ids
 * don't exist, so clicking them was a silent no-op — dead links dressed
 * up as navigation. HomePage.jsx also now redirects any authenticated
 * visitor away from '/' entirely, so an authenticated user was never
 * going to land somewhere those anchors worked anyway.
 *
 * Structurally this is DashboardNavbar with a different NAV_LINKS array
 * and route-set (Dashboard/Messages/Account vs. Dashboard/Chats/
 * Reviews/Profile) — including its hamburger-toggle mobile menu
 * (isMenuOpen state, conditionally rendered rather than a second
 * `sm:hidden` copy of the links that's just CSS-hidden). That distinction
 * matters beyond mobile polish: a CSS-only "hidden" duplicate still sits
 * in the DOM/accessibility tree, so every nav link would exist twice
 * with the same accessible name — this first shipped that way and broke
 * exactly that way in testing. Kept as its own component rather than a
 * shared/parameterized one with DashboardNavbar for the same reason
 * Navbar and DashboardNavbar are already two separate implementations:
 * the two roles' links are different enough that sharing one component
 * would need role-branching internally anyway, and duplicating this
 * (now proven) structure is safer than reshaping DashboardNavbar —
 * already in production use — to fit a second caller.
 *
 * "Messages" carries an unread-count badge (see
 * useUnreadMessagesCount.js) so a new message is noticeable from any
 * page a customer happens to be on, not only once they've already
 * opened Chats — added after testing surfaced that an unread reply
 * was otherwise invisible outside the Chats page itself.
 */
function UserNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const unreadCount = useUnreadMessagesCount()

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <ul className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavItem
                  to={link.to}
                  label={link.label}
                  badgeCount={link.showUnreadBadge ? unreadCount : undefined}
                />
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
                  <NavItem
                    to={link.to}
                    label={link.label}
                    badgeCount={link.showUnreadBadge ? unreadCount : undefined}
                  />
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

export { UserNavbar }