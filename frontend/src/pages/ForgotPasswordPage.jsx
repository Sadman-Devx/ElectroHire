import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, KeyRound } from 'lucide-react'

import { AuthLayout } from '@/components/AuthLayout'
import { FormField } from '@/components/FormField'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { validateForgotPasswordForm, hasErrors } from '@/lib/validators'
import { forgotPassword } from '@/services/authService'

const INITIAL_VALUES = { email: '' }

/**
 * Day 11: Forgot Password — step 1 of the password-reset flow.
 *   → Email input
 *   → POST /api/auth/forgot-password/ (users/views.py ForgotPasswordView)
 *   → "Enter the code" continues to /reset-password
 *
 * Not in the API Contract PDF — new feature, added alongside Reset
 * Password + Account Delete. Route: /forgot-password (public — see
 * App.jsx), linked from LoginPage's "Forgot password?" link.
 *
 * Backend always returns the same generic success message whether or
 * not the account exists/is verified (see ForgotPasswordView's own
 * docstring) — so this page always shows the same confirmation panel
 * on a successful submit, never a "no account found" error. That's
 * deliberate: revealing which emails are registered is exactly what
 * that generic message is designed to prevent, and this page
 * shouldn't undo that by branching its own UI on the outcome.
 *
 * Only a genuine request failure (malformed email caught client-side,
 * or a real network/server error) shows as an inline error — never
 * "email not found".
 *
 * email travels forward via router state into /reset-password (same
 * `state: { email }` pattern SignupPage -> VerifyOtpPage already
 * uses) purely so the next page doesn't make the person retype it;
 * ResetPasswordPage also lets it be edited there in case of a typo,
 * since nothing on this page can actually confirm the address exists.
 */
function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [values, setValues] = useState(INITIAL_VALUES)
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const errors = validateForgotPasswordForm(values)

  function shouldShow(field) {
    return submitAttempted || touched[field]
  }

  function updateField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (submitError) setSubmitError(null)
  }

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitAttempted(true)
    setSubmitError(null)

    if (hasErrors(errors)) return

    setSubmitting(true)
    try {
      await forgotPassword({ email: values.email.trim().toLowerCase() })
      setIsSubmitted(true)
    } catch (error) {
      setSubmitError(error.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleContinue() {
    navigate('/reset-password', { state: { email: values.email.trim().toLowerCase() } })
  }

  if (isSubmitted) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent a reset code if an account exists for that address"
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-secondary-tint)] text-[var(--color-secondary)]">
            <CheckCircle2 className="h-6 w-6" />
          </span>

          <p className="text-sm text-[var(--color-text-muted)]">
            If an account exists for <strong>{values.email}</strong>, a 6-digit password
            reset code has been sent. It expires in a few minutes, so continue below while
            it&rsquo;s still fresh.
          </p>

          <Button type="button" size="lg" className="w-full" onClick={handleContinue}>
            <KeyRound className="h-4 w-4" /> Enter the code
          </Button>

          <button
            type="button"
            onClick={() => setIsSubmitted(false)}
            className="text-sm font-medium text-[var(--color-secondary)] hover:underline"
          >
            Use a different email
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset code"
      footer={
        <>
          Remembered it after all?{' '}
          <Link to="/login" className="font-semibold text-[var(--color-secondary)] hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FormField id="email" label="Email address" error={shouldShow('email') ? errors.email : null}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            invalid={Boolean(shouldShow('email') && errors.email)}
            onChange={(e) => updateField('email', e.target.value)}
            onBlur={() => markTouched('email')}
          />
        </FormField>

        {submitError ? (
          <div className="rounded-[var(--radius-input)] bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]">
            {submitError}
          </div>
        ) : null}

        <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
          {submitting ? (
            <>
              <Spinner /> Sending…
            </>
          ) : (
            'Send reset code'
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default ForgotPasswordPage