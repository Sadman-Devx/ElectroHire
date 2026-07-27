import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4 py-12">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--color-primary)] text-white">
          <Zap className="h-5 w-5" fill="currentColor" />
        </span>
        <span className="text-lg font-bold tracking-tight text-[var(--color-text)]">
          ElectroHire
        </span>
      </Link>

      <div className="w-full max-w-[420px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm shadow-slate-200/60">
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-bold text-[var(--color-text)]">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
          ) : null}
        </div>

        {children}
      </div>

      {footer ? <div className="mt-6 text-sm text-[var(--color-text-muted)]">{footer}</div> : null}
    </div>
  )
}

export { AuthLayout }