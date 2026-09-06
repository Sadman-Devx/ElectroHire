import { useState } from 'react'
import { CheckCircle2, ChevronRight, KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'
import { Spinner } from '@/components/ui/spinner'
import { useChangePassword } from '@/hooks/useChangePassword'
import { validateChangePasswordForm, hasErrors } from '@/lib/validators'

const INITIAL_VALUES = { currentPassword: '', newPassword: '', confirmPassword: '' }

/**
 * Day 12: Account Page — "Change Password", the frontend side of
 * POST /api/auth/change-password/ (users/views.py ChangePasswordView).
 *
 * The "I know my password and just want to update it" counterpart to
 * Forgot/Reset Password (which exist for when the caller *doesn't*
 * know their password — see ChangePasswordView's own docstring for
 * why the two flows deliberately don't share a form). Reuses the same
 * Dialog primitive DeleteAccountSection.jsx introduced, for the same
 * "one short field group, not a whole page" reasoning that
 * component's own doc comment already explains — here it's three
 * fields instead of one, but still not a fifth full-page route.
 *
 * Unlike Delete Account, a successful change doesn't clear the local
 * session or navigate anywhere (see useChangePassword's own doc
 * comment) — the dialog just swaps to a short confirmation state with
 * a "Done" button that closes it, the same way BookProviderPage's
 * confirmation screen replaces its form in place rather than
 * redirecting immediately.
 */
function ChangePasswordSection() {
  const { submit, isSubmitting, error, isSuccess, reset } = useChangePassword()

  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState(INITIAL_VALUES)
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const errors = validateChangePasswordForm(values)

  function shouldShow(field) {
    return submitAttempted || touched[field]
  }

  function updateField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function openDialog() {
    setIsOpen(true)
  }

  function closeDialog() {
    if (isSubmitting) return
    setIsOpen(false)
    setValues(INITIAL_VALUES)
    setTouched({})
    setSubmitAttempted(false)
    reset()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitAttempted(true)
    if (hasErrors(errors)) return

    await submit({ currentPassword: values.currentPassword, newPassword: values.newPassword })
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)] sm:px-6"
      >
        <span className="flex items-center gap-2.5">
          <KeyRound className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
          Change Password
        </span>
        <ChevronRight className="h-4 w-4 text-[var(--color-text-subtle)]" aria-hidden="true" />
      </button>

      <Dialog
        open={isOpen}
        onClose={closeDialog}
        title={isSuccess ? 'Password changed' : 'Change your password'}
        description={isSuccess ? undefined : 'Enter your current password and choose a new one.'}
      >
        {isSuccess ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your password has been changed successfully.
            </p>
            <Button type="button" className="w-full" onClick={closeDialog}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <FormField
              id="change-current-password"
              label="Current password"
              error={shouldShow('currentPassword') ? errors.currentPassword : null}
            >
              <PasswordInput
                id="change-current-password"
                autoComplete="current-password"
                placeholder="Your current password"
                value={values.currentPassword}
                invalid={Boolean(shouldShow('currentPassword') && errors.currentPassword)}
                onChange={(e) => updateField('currentPassword', e.target.value)}
                onBlur={() => markTouched('currentPassword')}
                autoFocus
              />
            </FormField>

            <FormField
              id="change-new-password"
              label="New password"
              error={shouldShow('newPassword') ? errors.newPassword : null}
            >
              <PasswordInput
                id="change-new-password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={values.newPassword}
                invalid={Boolean(shouldShow('newPassword') && errors.newPassword)}
                onChange={(e) => updateField('newPassword', e.target.value)}
                onBlur={() => markTouched('newPassword')}
              />
            </FormField>

            <FormField
              id="change-confirm-password"
              label="Confirm new password"
              error={shouldShow('confirmPassword') ? errors.confirmPassword : null}
            >
              <PasswordInput
                id="change-confirm-password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                value={values.confirmPassword}
                invalid={Boolean(shouldShow('confirmPassword') && errors.confirmPassword)}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                onBlur={() => markTouched('confirmPassword')}
              />
            </FormField>

            {error ? (
              <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={closeDialog}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-[2]" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner /> Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  )
}

export { ChangePasswordSection }