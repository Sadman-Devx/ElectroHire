import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { getCategories } from '@/services/categoryService'
import { getProviders } from '@/services/providerService'

// Both services make real axios/HTTP calls in production; mocking
// them lets us drive ProvidersPage -> useCategories/useProviders ->
// service layer end-to-end while fully controlling the "backend".
vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn(),
}))

vi.mock('@/services/providerService', () => ({
  getProviders: vi.fn(),
}))

const CATEGORIES = [
  { id: 1, name: 'Electrician', icon: 'bulb' },
  { id: 2, name: 'Plumber', icon: 'pipe' },
]

const PROVIDERS = [
  {
    id: 1,
    name: 'Karim Uddin',
    area: 'Dhanmondi',
    experience: 8,
    photo: null,
    categories: ['Electrician', 'AC Repair'],
    avg_rating: 4.8,
    review_count: 24,
    status: 'active',
  },
  {
    id: 2,
    name: 'Rahim Mia',
    area: 'Dhanmondi',
    experience: 5,
    photo: null,
    categories: ['Electrician'],
    avg_rating: 0,
    review_count: 0,
    status: 'active',
  },
]

function renderProviders(initialPath = '/providers') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  getCategories.mockReset()
  getProviders.mockReset()
  getCategories.mockResolvedValue(CATEGORIES)
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ProvidersPage', () => {
  it('loads providers for the filters already present in the URL', async () => {
    getProviders.mockResolvedValue({ data: PROVIDERS, count: 2 })

    renderProviders('/providers?category=1&area=Dhanmondi')

    expect(await screen.findByText('Karim Uddin')).toBeInTheDocument()
    expect(screen.getByText('Rahim Mia')).toBeInTheDocument()

    expect(getProviders).toHaveBeenCalledWith({ category: '1', area: 'Dhanmondi', sort: '' })
    // Breadcrumb + result count reflect the same filters. The count
    // lives in its own <span> next to the rest of the sentence, so
    // this asserts on the paragraph's combined textContent rather
    // than a single (necessarily fragmented) text node.
    expect(screen.getByText('Electrician in Dhanmondi')).toBeInTheDocument()
    expect(screen.getByTestId('results-summary').textContent).toMatch(
      /2\s*providers found in Dhanmondi for Electrician/i
    )
  })

  it('shows a loading state before results arrive', async () => {
    let resolveProviders
    getProviders.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProviders = resolve
        })
    )

    renderProviders()

    expect(screen.getByText(/searching providers/i)).toBeInTheDocument()

    resolveProviders({ data: PROVIDERS, count: 2 })
    expect(await screen.findByText('Karim Uddin')).toBeInTheDocument()
  })

  it('shows a "no providers found" empty state when the list is empty', async () => {
    getProviders.mockResolvedValue({ data: [], count: 0 })

    renderProviders('/providers?area=Nowhereville')

    expect(await screen.findByText(/no providers found/i)).toBeInTheDocument()
  })

  it('shows the backend error message when the request fails', async () => {
    const error = new Error('Request failed')
    error.response = { data: { message: 'Could not load providers. Please try again.' } }
    getProviders.mockRejectedValue(error)

    renderProviders()

    expect(await screen.findByText(/could not load providers/i)).toBeInTheDocument()
  })

  it('does not refetch while typing — only applies filters on Apply click', async () => {
    getProviders.mockResolvedValue({ data: PROVIDERS, count: 2 })
    const user = userEvent.setup()

    renderProviders('/providers')
    await screen.findByText('Karim Uddin')
    expect(getProviders).toHaveBeenCalledTimes(1)

    await user.type(screen.getByLabelText(/^area$/i), 'Gulshan')
    expect(getProviders).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /apply/i }))

    await waitFor(() =>
      expect(getProviders).toHaveBeenLastCalledWith({ category: '', area: 'Gulshan', sort: '' })
    )
  })

  it('applies category + area together when Apply is clicked', async () => {
    getProviders.mockResolvedValue({ data: PROVIDERS, count: 2 })
    const user = userEvent.setup()

    renderProviders('/providers')
    await screen.findByText('Karim Uddin')

    await user.selectOptions(screen.getByLabelText(/category/i), 'Electrician')
    await user.type(screen.getByLabelText(/^area$/i), 'Mirpur')
    await user.click(screen.getByRole('button', { name: /apply/i }))

    await waitFor(() =>
      expect(getProviders).toHaveBeenLastCalledWith({ category: '1', area: 'Mirpur', sort: '' })
    )
  })

  it('applies the "Highest rated" sort immediately, without an Apply click', async () => {
    getProviders.mockResolvedValue({ data: PROVIDERS, count: 2 })
    const user = userEvent.setup()

    renderProviders('/providers')
    await screen.findByText('Karim Uddin')

    await user.click(screen.getByRole('radio', { name: /highest rated/i }))

    await waitFor(() =>
      expect(getProviders).toHaveBeenLastCalledWith({ category: '', area: '', sort: 'rating' })
    )
  })

  it('renders category options sourced from the categories API', async () => {
    getProviders.mockResolvedValue({ data: [], count: 0 })

    renderProviders()

    expect(await screen.findByRole('option', { name: 'Electrician' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Plumber' })).toBeInTheDocument()
  })

  it('shows a "View Profile" link to the (future) provider detail route', async () => {
    getProviders.mockResolvedValue({ data: PROVIDERS, count: 2 })

    renderProviders()
    await screen.findByText('Karim Uddin')

    const links = screen.getAllByRole('link', { name: /view profile/i })
    expect(links[0]).toHaveAttribute('href', '/providers/1')
  })
})