import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'

import { AuthLayout } from '@/components/AuthLayout'
import { FormField } from '@/components/FormField'
import { OtpInput } from '@/components/OtpInput'
import { PasswordInput } from '@/components/PasswordInput'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { validateResetPasswordForm, hasErrors } from '@/lib/validators'
import { resetPassword } from '@/services/authService'

const OTP_LENGTH = 6

function buildInitialValues(prefilledEmail) {
  return { email: prefilledEmail || '', otp: '', newPassword: '', confirmPassword: '' }
}

/**
 * Day 11: Reset Password — step 2 of the password-reset flow.
 *   → Email (prefilled from ForgotPasswordPage's router state, still
 *     editable — see that page's own doc comment for why it isn't
 *     locked/redirected the way VerifyOtpPage locks its email)
 *   → 6-digit OTP (reuses OtpInput, same widget VerifyOtpPage uses)
 *   → New password + confirm
 *   → POST /api/auth/reset-password/ (users/views.py ResetPasswordView)
 *
 * Not in the API Contract PDF. Route: /reset-password (public — see
 * App.jsx). Reachable either via ForgotPasswordPage's "Enter the
 * code" button (email prefilled) or directly (e.g. a bookmarked link,
 * or a person who already knows their still-valid code) with the
 * email field left blank for the visitor to fill in themselves.
 *
 * Backend does NOT log the user in on success (no access/refresh
 * token in the response — see ResetPasswordView's own docstring), so
 * this always finishes by sending the visitor to /login instead of
 * into the app, carrying a one-time `notice` in router state for
 * LoginPage to show as a confirmation banner (same `state: {...}`
 * pattern SignupPage -> VerifyOtpPage already uses, just a plain
 * string instead of an email this time).
 *
 * A wrong/expired OTP and a too-weak new password produce two
 * different, specific backend error messages (see
 * ResetPasswordSerializer / ResetPasswordView) — both are shown
 * as-is via the shared submitError banner rather than a generic
 * "something went wrong", same as every other auth form in this app.
 */
function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const prefilledEmail = location.state?.email || ''

  const [values, setValues] = useState(() => buildInitialValues(prefilledEmail))
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const errors = validateResetPasswordForm(values)

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

  function handleOtpChange(nextValue) {
    updateField('otp', nextValue)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitAttempted(true)
    setSubmitError(null)

    if (hasErrors(errors)) return

    setSubmitting(true)
    try {
      await resetPassword({
        email: values.email.trim().toLowerCase(),
        otp: values.otp.trim(),
        newPassword: values.newPassword,
      })
      navigate('/login', {
        replace: true,
        state: { notice: 'Password has been reset. Please log in with your new password.' },
      })
    } catch (error) {
      setSubmitError(error.message || 'Could not reset your password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the code we emailed you and choose a new password"
      footer={
        <>
          Didn&rsquo;t get a code?{' '}
          <Link
            to="/forgot-password"
            className="font-semibold text-[var(--color-secondary)] hover:underline"
          >
            Request a new one
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

        <FormField id="otp" label="6-digit code" error={shouldShow('otp') ? errors.otp : null}>
          <OtpInput
            length={OTP_LENGTH}
            value={values.otp}
            onChange={handleOtpChange}
            disabled={submitting}
            error={Boolean(shouldShow('otp') && errors.otp)}
          />
        </FormField>

        <FormField
          id="newPassword"
          label="New password"
          error={shouldShow('newPassword') ? errors.newPassword : null}
        >
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={values.newPassword}
            invalid={Boolean(shouldShow('newPassword') && errors.newPassword)}
            onChange={(e) => updateField('newPassword', e.target.value)}
            onBlur={() => markTouched('newPassword')}
          />
        </FormField>

        <FormField
          id="confirmPassword"
          label="Confirm new password"
          error={shouldShow('confirmPassword') ? errors.confirmPassword : null}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={values.confirmPassword}
            invalid={Boolean(shouldShow('confirmPassword') && errors.confirmPassword)}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
            onBlur={() => markTouched('confirmPassword')}
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
              <Spinner /> Resetting…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" /> Reset password
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default ResetPasswordPage