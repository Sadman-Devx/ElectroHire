import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { analyzeProblem, draftBooking } from '@/services/assistantService'
import { createBooking } from '@/services/bookingService'

vi.mock('@/services/assistantService', () => ({
  analyzeProblem: vi.fn(),
  draftBooking: vi.fn(),
}))
vi.mock('@/services/bookingService', () => ({
  createBooking: vi.fn(),
  getMyBookings: vi.fn().mockResolvedValue([]),
}))

function isoDay(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const TOMORROW = isoDay(1)

const KARIM = { id: 7, name: 'Karim Uddin', area: 'Gulshan', experience: 8, photo: null, categories: ['Electrician'], avg_rating: 4.8, review_count: 24, status: 'active' }
const RUMA = { id: 8, name: 'Ruma Akter', area: 'Gulshan', experience: 4, photo: null, categories: ['Electrician'], avg_rating: 4.1, review_count: 6, status: 'active' }

function analysis(overrides = {}) {
  return {
    category: { id: 1, name: 'Electrician' },
    category_fallback: false,
    urgency: 'low',
    summary: 'The ceiling fan does not rotate.',
    safety_tips: ['Switch off the fan.', 'Do not touch the blades.'],
    cost_estimate: null,
    language: 'en',
    providers: {
      area: null, area_matched: null, matches: [KARIM, RUMA], message: 'Top-rated Electrician providers.',
      alternatives: { other_areas: [], other_categories: [] },
    },
    ...overrides,
  }
}

function draftResult(overrides = {}) {
  return {
    provider: { id: 7, name: 'Karim Uddin', area: 'Gulshan' },
    draft: {
      provider_id: 7, category_id: 1, scheduled_date: TOMORROW, scheduled_time: '10:00',
      address: 'House 12, Road 5, Gulshan', description: 'The ceiling fan does not rotate.',
    },
    missing_fields: [], problems: {}, ready: true, today: isoDay(0), language: 'en',
    ...overrides,
  }
}

function renderAssistant() {
  return render(
    <MemoryRouter initialEntries={['/assistant']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

async function openDraftFor(user, name = 'Karim Uddin') {
  await user.type(await screen.findByLabelText(/describe your problem/i), 'Ceiling fan ghure na')
  await user.click(screen.getByRole('button', { name: /^send$/i }))
  await user.click(await screen.findByRole('button', { name: `Draft with AI ${name}` }))
  return screen.findByRole('region', { name: `Booking draft for ${name}` })
}

async function makeDraft(user, panel, text = 'kal shokal 10 tar, House 12 Road 5 Gulshan') {
  await user.type(within(panel).getByLabelText(/when and where/i), text)
  await user.click(within(panel).getByRole('button', { name: /create draft/i }))
  await within(panel).findByText(/draft — not booked yet/i)
}

beforeEach(() => {
  localStorage.clear()
  analyzeProblem.mockReset()
  draftBooking.mockReset()
  createBooking.mockReset()
  analyzeProblem.mockResolvedValue(analysis())
  draftBooking.mockResolvedValue(draftResult())
  createBooking.mockResolvedValue({ id: 55, provider_name: 'Karim Uddin', scheduled_date: TOMORROW, scheduled_time: '10:00:00', status: 'pending' })
  saveSession({ accessToken: 'token-abc', refreshToken: 'refresh-abc', role: 'user', name: 'Mahmudul' })
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('AI booking draft', () => {
  it('offers a "Draft with AI" button on each recommended provider, alongside Contact and Book', async () => {
    const user = userEvent.setup()
    renderAssistant()
    await user.type(await screen.findByLabelText(/describe your problem/i), 'Ceiling fan ghure na')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(await screen.findByRole('button', { name: 'Draft with AI Karim Uddin' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draft with AI Ruma Akter' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Book Karim Uddin' })).toHaveAttribute('href', '/providers/7/book')
    expect(screen.getByRole('link', { name: 'Contact Karim Uddin' })).toBeInTheDocument()
  })

  it('turns the customer\'s words into a draft and sends provider, summary and category along', async () => {
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)

    expect(within(panel).getByText(/nothing is booked yet/i)).toBeInTheDocument()
    await makeDraft(user, panel)

    expect(draftBooking).toHaveBeenCalledWith({
      providerId: 7,
      message: 'kal shokal 10 tar, House 12 Road 5 Gulshan',
      problemSummary: 'The ceiling fan does not rotate.',
      categoryId: 1,
    })
    expect(within(panel).getByLabelText('Date')).toHaveValue(TOMORROW)
    expect(within(panel).getByLabelText('Time')).toHaveValue('10:00')
    expect(within(panel).getByLabelText('Address')).toHaveValue('House 12, Road 5, Gulshan')
    expect(within(panel).getByLabelText(/notes for the provider/i)).toHaveValue('The ceiling fan does not rotate.')
  })

  it('NEVER books until Confirm is pressed', async () => {
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)
    await makeDraft(user, panel)

    // the draft is on screen, fully valid — and still nothing is booked
    expect(within(panel).getByRole('button', { name: /confirm booking/i })).toBeEnabled()
    expect(createBooking).not.toHaveBeenCalled()

    // editing a field doesn't book either
    await user.clear(within(panel).getByLabelText('Address'))
    await user.type(within(panel).getByLabelText('Address'), 'Flat 4B, Road 9, Gulshan')
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('creates the real booking with the (edited) draft values only after Confirm', async () => {
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)
    await makeDraft(user, panel)

    await user.clear(within(panel).getByLabelText('Address'))
    await user.type(within(panel).getByLabelText('Address'), 'Flat 4B, Road 9, Gulshan')
    await user.click(within(panel).getByRole('button', { name: /confirm booking/i }))

    expect(createBooking).toHaveBeenCalledTimes(1)
    expect(createBooking).toHaveBeenCalledWith({
      providerId: 7,
      categoryId: 1,
      scheduledDate: TOMORROW,
      scheduledTime: '10:00',
      address: 'Flat 4B, Road 9, Gulshan',
      description: 'The ceiling fan does not rotate.',
    })
    expect(await within(panel).findByRole('status')).toHaveTextContent(/booking request sent to karim uddin/i)
    expect(within(panel).getByRole('link', { name: /view my bookings/i })).toHaveAttribute('href', '/bookings')
  })

  it('"Start over" goes back to the request box (text kept for editing) without booking anything', async () => {
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)
    await makeDraft(user, panel)

    await user.click(within(panel).getByRole('button', { name: /start over/i }))

    expect(within(panel).queryByText(/draft — not booked yet/i)).not.toBeInTheDocument()
    expect(within(panel).getByLabelText(/when and where/i)).toHaveValue('kal shokal 10 tar, House 12 Road 5 Gulshan')
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('closing the panel discards the draft without booking anything', async () => {
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)
    await makeDraft(user, panel)

    await user.click(within(panel).getByRole('button', { name: /close booking draft/i }))

    expect(screen.queryByRole('region', { name: /booking draft for/i })).not.toBeInTheDocument()
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('flags fields the AI could not find, and will not confirm until they are filled', async () => {
    draftBooking.mockResolvedValue(
      draftResult({
        draft: { provider_id: 7, category_id: 1, scheduled_date: TOMORROW, scheduled_time: '10:00', address: null, description: '' },
        missing_fields: ['address'],
        ready: false,
      })
    )
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)
    await makeDraft(user, panel, 'kal shokal 10 tar')

    expect(within(panel).getByText('Needed')).toBeInTheDocument()
    expect(within(panel).getByLabelText('Address')).toHaveValue('')

    await user.click(within(panel).getByRole('button', { name: /confirm booking/i }))
    expect(await within(panel).findByText(/address is required/i)).toBeInTheDocument()
    expect(createBooking).not.toHaveBeenCalled()

    await user.type(within(panel).getByLabelText('Address'), 'House 3, Banani')
    await user.click(within(panel).getByRole('button', { name: /confirm booking/i }))
    expect(createBooking).toHaveBeenCalledTimes(1)
  })

  it('shows problems found by the server rules (e.g. date in the past) next to the field', async () => {
    draftBooking.mockResolvedValue(
      draftResult({
        problems: { scheduled_date: ['Scheduled date cannot be in the past.'] },
        ready: false,
      })
    )
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)
    await makeDraft(user, panel)

    expect(within(panel).getByText('Scheduled date cannot be in the past.')).toBeInTheDocument()
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('shows a draft error and lets the customer try again', async () => {
    draftBooking.mockRejectedValueOnce(Object.assign(new Error('The AI assistant is having trouble right now.'), { status: 503 }))
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)

    await user.type(within(panel).getByLabelText(/when and where/i), 'kal shokal 10 tar')
    await user.click(within(panel).getByRole('button', { name: /create draft/i }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent(/having trouble right now/i)
    expect(within(panel).getByLabelText(/when and where/i)).toHaveValue('kal shokal 10 tar') // text kept

    await user.click(within(panel).getByRole('button', { name: /create draft/i }))
    expect(await within(panel).findByText(/draft — not booked yet/i)).toBeInTheDocument()
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('rejects an empty request without calling the AI', async () => {
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)

    await user.click(within(panel).getByRole('button', { name: /create draft/i }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent(/when and where/i)
    expect(draftBooking).not.toHaveBeenCalled()
  })

  it('keeps the draft editable when the real booking endpoint rejects it', async () => {
    createBooking.mockRejectedValueOnce(Object.assign(new Error('This provider is not currently accepting bookings.'), { status: 400 }))
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)
    await makeDraft(user, panel)

    await user.click(within(panel).getByRole('button', { name: /confirm booking/i }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent(/not currently accepting bookings/i)
    expect(within(panel).getByLabelText('Address')).toHaveValue('House 12, Road 5, Gulshan')
    expect(within(panel).queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not send a guessed category when the AI could not identify one', async () => {
    analyzeProblem.mockResolvedValue(
      analysis({
        category_fallback: true,
        providers: { area: null, area_matched: null, matches: [KARIM], message: '', alternatives: { other_areas: [], other_categories: [] } },
      })
    )
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)
    await makeDraft(user, panel)

    expect(draftBooking.mock.calls[0][0].categoryId).toBeNull()
  })

  it('keeps each provider\'s draft independent', async () => {
    const user = userEvent.setup()
    renderAssistant()
    await user.type(await screen.findByLabelText(/describe your problem/i), 'Ceiling fan ghure na')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await user.click(await screen.findByRole('button', { name: 'Draft with AI Karim Uddin' }))
    await user.click(screen.getByRole('button', { name: 'Draft with AI Ruma Akter' }))

    expect(screen.getByRole('region', { name: 'Booking draft for Karim Uddin' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Booking draft for Ruma Akter' })).toBeInTheDocument()
  })

  it('renders AI-drafted text as plain text (XSS)', async () => {
    draftBooking.mockResolvedValue(
      draftResult({
        draft: { provider_id: 7, category_id: 1, scheduled_date: TOMORROW, scheduled_time: '10:00', address: '<img src=x onerror=alert(1)>', description: '<script>alert(2)</script>' },
      })
    )
    const user = userEvent.setup()
    renderAssistant()
    const panel = await openDraftFor(user)
    await makeDraft(user, panel)

    expect(within(panel).getByLabelText('Address')).toHaveValue('<img src=x onerror=alert(1)>')
    expect(document.querySelector('img[src="x"]')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
  })
})
