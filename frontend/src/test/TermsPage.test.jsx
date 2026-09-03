import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'

function renderTerms() {
  return render(
    <MemoryRouter initialEntries={['/terms']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('TermsPage', () => {
  it('renders the real Terms & Conditions content at /terms, not the placeholder', () => {
    renderTerms()

    expect(screen.getByRole('heading', { name: /terms & conditions/i, level: 1 })).toBeInTheDocument()
    // The Day 9 placeholder said "coming soon" — make sure that's gone.
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument()
  })

  it('covers the key disclaimer topics: verification, warranty, and ratings eligibility', () => {
    renderTerms()

    expect(screen.getByRole('heading', { name: /provider verification is lightweight/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /no warranty on service outcomes/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /ratings and reviews/i })).toBeInTheDocument()
    expect(
      screen.getByText(/a background check, license verification, or certification/i)
    ).toBeInTheDocument()
  })

  it('is reachable from the site Footer without logging in', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /terms & conditions/i })).toHaveAttribute('href', '/terms')
  })

  // Bug found after shipping: this page originally always rendered the
  // public marketing Navbar (components/home/Navbar.jsx), regardless of
  // auth state. That's the exact dead-link + "extra nav" bug Day 9
  // already found and fixed on AccountPage/UserDashboardPage/ChatsPage
  // (see UserNavbar.jsx's docstring) — Navbar's "Categories" / "How it
  // Works" links are '#anchor' hashes that only resolve on HomePage's
  // own sections, and its AuthActions block piles a second
  // Dashboard/Messages/Account/Log out cluster on top when someone is
  // logged in. These three tests lock in the fix: which navbar renders
  // now genuinely depends on auth state and role.
  it('shows the public marketing navbar (with working Login/Signup) for an anonymous visitor', () => {
    renderTerms()

    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
    // The dead #anchor links are fine here — this is the one place
    // (no logged-in state) where Navbar is actually the right choice.
    expect(screen.getByText(/how it works/i)).toBeInTheDocument()
  })

  it('shows UserNavbar (not the public Navbar) for a logged-in user', () => {
    saveSession({ accessToken: 'token-user', refreshToken: 'refresh-user', role: 'user', name: 'Mahmudul' })
    renderTerms()

    // UserNavbar's own links.
    expect(screen.getByRole('link', { name: /^messages$/i })).toHaveAttribute('href', '/chats')
    expect(screen.getByRole('link', { name: /^account$/i })).toHaveAttribute('href', '/account')
    // The public Navbar's dead marketing anchors must NOT be present.
    expect(screen.queryByText(/how it works/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument()
  })

  it('shows DashboardNavbar (not the public Navbar) for a logged-in provider', () => {
    saveSession({ accessToken: 'token-prov', refreshToken: 'refresh-prov', role: 'provider', name: 'Karim' })
    renderTerms()

    // DashboardNavbar's own, provider-only links.
    expect(screen.getByRole('link', { name: /^chats$/i })).toHaveAttribute('href', '/chats')
    expect(screen.getByRole('link', { name: /^reviews$/i })).toHaveAttribute('href', '/provider/reviews')
    // The public Navbar's dead marketing anchors must NOT be present.
    expect(screen.queryByText(/how it works/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument()
  })
})