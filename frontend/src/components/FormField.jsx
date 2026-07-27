import { Label } from '@/components/ui/label'

/**
 * Wraps a single form control with its label and inline validation
 * message. `error` is only shown once the field has been touched
 * (see SignupPage/LoginPage) so the user isn't shown red text before
 * they've had a chance to type anything.
 */
function FormField({ id, label, error, children, className }) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 block">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export { FormField }