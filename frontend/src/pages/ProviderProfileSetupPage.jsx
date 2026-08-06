import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

import { Footer } from '@/components/home/Footer'
import { Navbar } from '@/components/home/Navbar'
import { ProviderOnlyNotice } from '@/components/providers/ProviderOnlyNotice'
import { CategoryMultiSelect } from '@/components/providers/setup/CategoryMultiSelect'
import { PhotoDropzone } from '@/components/providers/setup/PhotoDropzone'
import { StepProgress } from '@/components/providers/setup/StepProgress'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useProviderProfileSetup } from '@/hooks/useProviderProfileSetup'
import { hasErrors, validateProviderProfileForm } from '@/lib/validators'

const INITIAL_VALUES = {
  categories: [],
  area: '',
  experience: '',
  description: '',
  photo: null,
}

/**
 * Day 5 — Dev 3: Provider Profile Setup Page.
 * Rendered behind <ProtectedRoute> (App.jsx). Gates non-"provider"
 * accounts to an explanatory screen instead of showing them the form.
 */
function ProviderProfileSetupPage() {
  const { user } = useAuth()
  const { categories, isLoading: isLoadingCategories, error: categoriesError } = useCategories()
  const { submit, isSubmitting, error: submitError, fieldErrors } = useProviderProfileSetup()

  const [values, setValues] = useState(INITIAL_VALUES)
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)

  const errors = validateProviderProfileForm(values)

  function shouldShow(field) {
    return submitAttempted || touched[field]
  }

  function updateValue(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function toggleCategory(categoryId) {
    markTouched('categories')
    setValues((prev) => {
      const isSelected = prev.categories.includes(categoryId)
      return {
        ...prev,
        categories: isSelected
          ? prev.categories.filter((id) => id !== categoryId)
          : [...prev.categories, categoryId],
      }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitAttempted(true)

    if (hasErrors(errors)) return

    const ok = await submit({
      categories: values.categories,
      area: values.area.trim(),
      experience: Number(values.experience),
      description: values.description.trim(),
      photo: values.photo,
    })

    if (ok) setJustSubmitted(true)
  }

    if (user && user.role !== 'provider') {
      return (
        <ProviderOnlyNotice description="You're signed in as a user account. Provider profile setup is only for accounts that signed up to offer a service." />
      )
    }

  if (justSubmitted) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <Card className="max-w-md p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-[var(--color-text)]">
              Profile submitted for review
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Our admin team will review your profile, usually within 24&ndash;48 hours. You can
              come back and resubmit any time before then.
            </p>
            <Link
              to="/provider/pending"
              className="mt-6 inline-block rounded-[var(--radius-button)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              View application status
            </Link>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <div className="mb-6">
            <StepProgress currentStep={2} totalSteps={2} label="Complete your profile" />
          </div>

          <Card className="p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-[var(--color-text)]">
                Complete your provider profile
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Help users find and trust you.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
              <div className="border-b border-[var(--color-border)] pb-6">
                <PhotoDropzone
                  file={values.photo}
                  onChange={(file) => {
                    updateValue('photo', file)
                    markTouched('photo')
                  }}
                  error={shouldShow('photo') ? errors.photo : null}
                  disabled={isSubmitting}
                />
              </div>

              <FormField
                id="categories"
                label="Service categories (select all that apply)"
                error={shouldShow('categories') ? errors.categories : null}
              >
                <CategoryMultiSelect
                  categories={categories}
                  selectedIds={values.categories}
                  onToggle={toggleCategory}
                  isLoading={isLoadingCategories}
                  error={categoriesError}
                />
              </FormField>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField id="area" label="Service area" error={shouldShow('area') ? errors.area : null}>
                  <Input
                    id="area"
                    placeholder="e.g. Dhanmondi, Dhaka"
                    value={values.area}
                    invalid={Boolean(shouldShow('area') && errors.area)}
                    onChange={(e) => updateValue('area', e.target.value)}
                    onBlur={() => markTouched('area')}
                    disabled={isSubmitting}
                  />
                </FormField>

                <FormField
                  id="experience"
                  label="Years of experience"
                  error={shouldShow('experience') ? errors.experience : null}
                >
                  <Input
                    id="experience"
                    inputMode="numeric"
                    placeholder="e.g. 5"
                    value={values.experience}
                    invalid={Boolean(shouldShow('experience') && errors.experience)}
                    onChange={(e) => updateValue('experience', e.target.value.replace(/[^\d]/g, ''))}
                    onBlur={() => markTouched('experience')}
                    disabled={isSubmitting}
                  />
                </FormField>
              </div>

              <FormField id="description" label="About you">
                <Textarea
                  id="description"
                  placeholder="Describe your skills, experience and the services you offer..."
                  value={values.description}
                  onChange={(e) => updateValue('description', e.target.value)}
                  disabled={isSubmitting}
                  rows={4}
                />
              </FormField>

              {submitError ? (
                <div
                  role="alert"
                  className="rounded-[var(--radius-input)] bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]"
                >
                  {submitError}
                  {fieldErrors ? (
                    <ul className="mt-1.5 list-disc pl-4 text-xs font-normal">
                      {Object.entries(fieldErrors).map(([field, messages]) => (
                        <li key={field}>
                          {Array.isArray(messages) ? messages.join(' ') : String(messages)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Spinner /> Submitting…
                  </>
                ) : (
                  'Submit for review'
                )}
              </Button>
            </form>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ProviderProfileSetupPage