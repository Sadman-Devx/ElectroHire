import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/components/AuthLayout'
import { FormField } from '@/components/FormField'
import { RoleSelect } from '@/components/RoleSelect'
import { PasswordInput } from '@/components/PasswordInput'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { validateSignupForm, hasErrors } from '@/lib/validators'
import { register } from '@/services/authService'

const INITIAL_VALUES = { name: '', email: '', phone: '', password: '', role: '' }

function SignupPage() {
  const navigate = useNavigate()

  const [values, setValues] = useState(INITIAL_VALUES)
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const errors = validateSignupForm(values)

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
      await register(values)
      navigate('/verify-otp', { state: { email: values.email } })
    } catch (error) {
      setSubmitError(error.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join ElectroHire to find help or get hired"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[var(--color-secondary)] hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FormField id="role" label="I am signing up as">
          <RoleSelect
            value={values.role}
            onChange={(role) => {
              updateField('role', role)
              markTouched('role')
            }}
            error={shouldShow('role') ? errors.role : null}
          />
        </FormField>

        <FormField id="name" label="Full name" error={shouldShow('name') ? errors.name : null}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="e.g. Mahmudul Hasan"
            value={values.name}
            invalid={Boolean(shouldShow('name') && errors.name)}
            onChange={(e) => updateField('name', e.target.value)}
            onBlur={() => markTouched('name')}
          />
        </FormField>

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

        <FormField id="phone" label="Phone number" error={shouldShow('phone') ? errors.phone : null}>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="01712345678"
            value={values.phone}
            invalid={Boolean(shouldShow('phone') && errors.phone)}
            onChange={(e) => updateField('phone', e.target.value)}
            onBlur={() => markTouched('phone')}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          error={shouldShow('password') ? errors.password : null}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={values.password}
            invalid={Boolean(shouldShow('password') && errors.password)}
            onChange={(e) => updateField('password', e.target.value)}
            onBlur={() => markTouched('password')}
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
              <Spinner /> Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default SignupPage