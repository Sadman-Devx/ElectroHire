import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Menu, X, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/useAuth'

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Categories', href: '#categories' },
  { label: 'How it Works', href: '#how-it-works' },
]

function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 text-lg font-bold text-[var(--color-text)]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]">
        <Zap className="h-5 w-5 text-white" />
      </span>

      <span>ElectroHire</span>
    </Link>
  )
}

function AuthActions({ onNavigate }) {
  const { user, isAuthenticated, logout } = useAuth()

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <Link
          to="/messages"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-[var(--radius-button)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Messages</span>
        </Link>

        <span className="hidden text-sm text-[var(--color-text-muted)] lg:inline">
          Hi, {user?.name}
        </span>

        <Button
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

  return (
    <div className="flex items-center gap-2">
      <Link to="/login" onClick={onNavigate}>
        <Button variant="ghost" size="sm">
          Log in
        </Button>
      </Link>

      <Link to="/signup" onClick={onNavigate}>
        <Button size="sm">Sign up</Button>
      </Link>
    </div>
  )
}

/**
 * Sticky home-page navbar:
 * - Logo + nav links + Login/Signup
 * - Nav links point at in-page section ids
 * - Collapses into a slide-down menu on small screens
 */
function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        {/* Desktop navigation */}
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop auth actions */}
        <div className="hidden md:block">
          <AuthActions />
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-button)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)] md:hidden"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {isMenuOpen ? (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-5 pt-2 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-[var(--radius-button)] px-2 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
            <AuthActions
              onNavigate={() => setIsMenuOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </header>
  )
}

export { Navbar }