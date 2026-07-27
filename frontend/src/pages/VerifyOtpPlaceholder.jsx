import { Link, useLocation } from 'react-router-dom'
import { MailCheck } from 'lucide-react'

/**
 * Placeholder only — the real OTP verify page (6-box input, countdown
 * timer, resend button) is Day 3, Dev 3's task. This just confirms
 * signup handed off the right email and gives a working link back.
 */
function VerifyOtpPlaceholder() {
  const location = useLocation()
  const email = location.state?.email

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
        <MailCheck className="h-6 w-6" />
      </span>
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
        Coming Day 3
      </p>
      <h1 className="text-2xl font-bold text-[var(--color-text)]">Account created</h1>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        {email ? (
          <>
            We&rsquo;d have sent a verification code to <strong>{email}</strong>. The real
            OTP-entry screen (6-digit input, countdown, resend) is built Day 3.
          </>
        ) : (
          'The real OTP-entry screen (6-digit input, countdown, resend) is built Day 3.'
        )}
      </p>
      <Link
        to="/login"
        className="mt-2 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
      >
        Back to login
      </Link>
    </div>
  )
}

export default VerifyOtpPlaceholder