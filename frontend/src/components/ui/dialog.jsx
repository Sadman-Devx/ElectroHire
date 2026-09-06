import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Day 11: minimal modal primitive, added for the Account Page's
 * "Delete account" confirmation (no dialog/modal component existed in
 * ui/ before this — every other confirm-style flow in this app so far
 * used a dedicated page instead, e.g. RateProviderPage/
 * ReportProviderPage). A password re-confirmation is a single short
 * field, not a whole page's worth of content, so a modal fits better
 * here than a fifth full-page route.
 *
 * Deliberately framework-free (no @radix-ui/react-dialog — not an
 * installed dependency, see package.json) rather than pulling in a
 * new package for one use site: a fixed overlay + centered panel,
 * Escape-to-close, backdrop-click-to-close, and a body-scroll lock
 * while open covers this app's actual need. design.md already
 * anticipates this shape (`--radius-modal: 20px`, defined in
 * index.css but unused until now).
 *
 * Not a full focus trap (Tab can still escape the panel to browser
 * chrome) — acceptable for a single-field confirmation dialog with
 * one primary and one secondary action, same scope tradeoff a page
 * that just doesn't have anything to close doesn't need to think
 * about at all.
 *
 *   <Dialog open={isOpen} onClose={handleClose} title="Delete account">
 *     ...
 *   </Dialog>
 */
function Dialog({ open, onClose, title, description, children, className }) {
  const panelRef = useRef(null)

  // Bug fix (found while testing Account Delete): keeping onClose in
  // this effect's own dependency array meant that *any* re-render of
  // a consumer that doesn't itself memoize its onClose handler with
  // useCallback (e.g. typing into a field re-renders the parent,
  // producing a fresh onClose closure every keystroke) re-ran this
  // whole effect — re-locking scroll (harmless) but also re-calling
  // panelRef.current.focus(), which stole focus straight back out of
  // whatever input the visitor was actively typing into after every
  // single character. Storing the latest onClose in a ref instead
  // means the effect body always calls the current version without
  // needing it as a dependency, so the effect (and the one-time
  // focus grab) only actually runs on a real open/close transition —
  // a plain function prop from any consumer is now safe by default,
  // not just ones that happen to remember useCallback.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)

    // Focus the panel itself on open so Escape/Tab work immediately
    // without requiring a click first — same "make it usable from the
    // keyboard right away" reasoning OtpInput's autofocus-first-box
    // already applies.
    panelRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={description ? 'dialog-description' : undefined}
        tabIndex={-1}
        className={cn(
          'w-full max-w-sm rounded-[var(--radius-modal)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl shadow-slate-900/10 focus:outline-none',
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 id="dialog-title" className="text-lg font-bold text-[var(--color-text)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id="dialog-description" className="mt-1 text-sm text-[var(--color-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-button)] text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

export { Dialog }