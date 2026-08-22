import { Link } from 'react-router-dom'

/**
 * Day 10, Dev 1: added the Terms & Conditions link now that
 * TermsPage.jsx (replacing TermsPlaceholder.jsx) is real content, not
 * a "coming soon" stub. Previously only reachable from the logged-in
 * Account Page — an anonymous visitor had no way to find it at all.
 */
function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-6 text-center text-sm text-[var(--color-text-muted)] sm:px-6">
        <Link to="/terms" className="hover:text-[var(--color-text)] hover:underline">
          Terms &amp; Conditions
        </Link>
        <span>&copy; {new Date().getFullYear()} ElectroHire. All rights reserved.</span>
      </div>
    </footer>
  )
}

export { Footer }