function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-[var(--color-text-muted)] sm:px-6">
        &copy; {new Date().getFullYear()} ElectroHire. All rights reserved.
      </div>
    </footer>
  )
}

export { Footer }