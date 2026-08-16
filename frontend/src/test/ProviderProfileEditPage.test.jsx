import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getCategories } from '@/services/categoryService'
import { getMyProviderProfile, setupProviderProfile } from '@/services/providerService'

vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn(),
}))

vi.mock('@/services/providerService', () => ({
  getMyProviderProfile: vi.fn(),
  setupProviderProfile: vi.fn(),
}))

const CATEGORIES = [
  { id: 1, name: 'Electrician', icon: 'bulb' },
  { id: 2, name: 'AC Repair', icon: 'ac' },
  { id: 3, name: 'Plumber', icon: 'pipe' },
]

const EXISTING_PROFILE = {
  id: 7,
  area: 'Dhanmondi',
  experience: 8,
  description: 'Professional electrician with 8 years of experience.',
  photo: 'http://127.0.0.1:8000/media/provider_photos/karim.jpg',
  status: 'active',
  categories: [
    { id: 1, name: 'Electrician' },
    { id: 2, name: 'AC Repair' },
  ],
  verified: true,
}

function renderEditPage(initialPath = '/provider/profile-edit') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

function loginAsProvider() {
  saveSession({
    accessToken: 'token-abc',
    refreshToken: 'refresh-abc',
    role: 'provider',
    name: 'Karim Uddin',
  })
}

function loginAsUser() {
  saveSession({ accessToken: 'token-xyz', refreshToken: 'refresh-xyz', role: 'user', name: 'Mahmudul' })
}

beforeEach(() => {
  localStorage.clear()
  getCategories.mockReset()
  getMyProviderProfile.mockReset()
  setupProviderProfile.mockReset()
  getCategories.mockResolvedValue(CATEGORIES)
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ProviderProfileEditPage', () => {
  it('redirects an unauthenticated visitor to /login (ProtectedRoute)', async () => {
    renderEditPage()

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('shows the provider-only gate for a signed-in "user" account', async () => {
    loginAsUser()
    renderEditPage()

    expect(
      await screen.findByRole('heading', { name: /this page is for service providers/i })
    ).toBeInTheDocument()
  })

  it('points an account with no provider profile yet at Setup instead of a broken edit form', async () => {
    loginAsProvider()
    getMyProviderProfile.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { response: { status: 403 } })
    )

    renderEditPage()

    expect(
      await screen.findByRole('heading', { name: /haven.t set up your provider profile yet/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /complete your profile/i })).toHaveAttribute(
      'href',
      '/provider/profile-setup'
    )
  })

  it('shows a real error banner on a genuine (non-403) profile fetch failure', async () => {
    loginAsProvider()
    const error = new Error('Server error')
    error.response = { status: 500, data: { message: 'Could not load your profile. Please try again.' } }
    getMyProviderProfile.mockRejectedValue(error)

    renderEditPage()

    expect(await screen.findByText(/could not load your profile/i)).toBeInTheDocument()
  })

  it('pre-fills the form with the caller\'s real current profile', async () => {
    loginAsProvider()
    getMyProviderProfile.mockResolvedValue(EXISTING_PROFILE)

    renderEditPage()

    expect(await screen.findByDisplayValue('Dhanmondi')).toBeInTheDocument()
    expect(screen.getByDisplayValue('8')).toBeInTheDocument()
    expect(
      screen.getByDisplayValue('Professional electrician with 8 years of experience.')
    ).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /electrician/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /ac repair/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /plumber/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the Verified and status badges sourced from the real profile', async () => {
    loginAsProvider()
    getMyProviderProfile.mockResolvedValue(EXISTING_PROFILE)

    renderEditPage()

    expect(await screen.findByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('does not show a Verified badge for an unverified pending provider', async () => {
    loginAsProvider()
    getMyProviderProfile.mockResolvedValue({
      ...EXISTING_PROFILE,
      status: 'pending',
      verified: false,
    })

    renderEditPage()

    expect(await screen.findByText('Pending review')).toBeInTheDocument()
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
  })

  it('blocks submit and shows validation errors when a required field is cleared', async () => {
    loginAsProvider()
    getMyProviderProfile.mockResolvedValue(EXISTING_PROFILE)
    const user = userEvent.setup()

    renderEditPage()
    const areaInput = await screen.findByDisplayValue('Dhanmondi')
    await user.clear(areaInput)

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/service area is required/i)).toBeInTheDocument()
    expect(setupProviderProfile).not.toHaveBeenCalled()
  })

  it('submits the existing category ids/area/experience unchanged with photo: null when nothing was edited', async () => {
    loginAsProvider()
    getMyProviderProfile.mockResolvedValue(EXISTING_PROFILE)
    setupProviderProfile.mockResolvedValue({ status: 'success' })
    const user = userEvent.setup()

    renderEditPage()
    await screen.findByDisplayValue('Dhanmondi')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(setupProviderProfile).toHaveBeenCalledTimes(1))
    expect(setupProviderProfile).toHaveBeenCalledWith({
      categories: [1, 2],
      area: 'Dhanmondi',
      experience: 8,
      description: 'Professional electrician with 8 years of experience.',
      photo: null,
    })
  })

  it('shows the "sent for review again" success screen after a successful save', async () => {
    loginAsProvider()
    getMyProviderProfile.mockResolvedValue(EXISTING_PROFILE)
    setupProviderProfile.mockResolvedValue({ status: 'success' })
    const user = userEvent.setup()

    renderEditPage()
    await screen.findByDisplayValue('Dhanmondi')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/profile updated and sent for review/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view application status/i })).toHaveAttribute(
      'href',
      '/provider/pending'
    )
  })

  it('reflects a newly picked category and unchecking an existing one in the submitted payload', async () => {
    loginAsProvider()
    getMyProviderProfile.mockResolvedValue(EXISTING_PROFILE)
    setupProviderProfile.mockResolvedValue({ status: 'success' })
    const user = userEvent.setup()

    renderEditPage()
    await screen.findByDisplayValue('Dhanmondi')

    // Uncheck AC Repair (was pre-selected), check Plumber (was not).
    await user.click(screen.getByRole('button', { name: /ac repair/i }))
    await user.click(screen.getByRole('button', { name: /plumber/i }))

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(setupProviderProfile).toHaveBeenCalledTimes(1))
    const payload = setupProviderProfile.mock.calls[0][0]
    expect(new Set(payload.categories)).toEqual(new Set([1, 3]))
  })
})