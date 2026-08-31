import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getMessageThread, listConversations, sendMessage } from '@/services/chatService'
import { getProviderDetail } from '@/services/providerService'

// Day 8, Dev 1: chatService replaces the Day 7 mock — mocked here the
// same way ProviderDetailPage.test.jsx mocks providerService/contactService,
// so each test fully controls the "backend" instead of depending on
// the seeded demo dataset (or real network latency).
vi.mock('@/services/chatService', () => ({
  listConversations: vi.fn(),
  getMessageThread: vi.fn(),
  sendMessage: vi.fn(),
}))

// Day 9, Dev 1: the header's "Report" menu item now navigates to the
// real Report Provider Page (/providers/:id/report — see
// ChatWindowHeader.jsx), which itself calls getProviderDetail via
// useProviderDetail. Mocked here the same way
// ProviderDetailPage.test.jsx mocks it, purely so that navigation
// resolves to real page content instead of hanging on a real network
// call this test environment has no backend for.
vi.mock('@/services/providerService', () => ({
  getProviderDetail: vi.fn(),
}))

// Fixture shapes intentionally match the real API exactly (no
// mock-only extras like the old `is_online` field — see
// ConversationListItem.jsx's doc comment on why that field is always
// absent against the real ConversationSerializer).
const CONVERSATIONS = [
  {
    provider_id: 1,
    other_user_id: 1,
    other_user_name: 'Karim Uddin',
    other_user_role: 'provider',
    last_message: 'Kal shokal e ashbo.',
    last_message_at: '2025-01-15T10:35:00.000Z',
    unread_count: 0,
  },
  {
    provider_id: 2,
    other_user_id: 2,
    other_user_name: 'Rahim Mia',
    other_user_role: 'provider',
    last_message: 'Koto taka lagbe bolun.',
    last_message_at: '2025-01-14T09:00:00.000Z',
    unread_count: 2,
  },
]

// A provider's own view of a conversation with one of their
// customers: provider_id resolves to *their own* provider id (Day 8
// backend fix — see contacts/views.py ConversationListView and its
// regression tests), other_user_role is 'user'.
const PROVIDER_VIEW_CONVERSATIONS = [
  {
    provider_id: 7,
    other_user_id: 42,
    other_user_name: 'Mahmudul Hasan',
    other_user_role: 'user',
    last_message: 'AC thanda hocche na',
    last_message_at: '2025-01-15T10:32:00.000Z',
    unread_count: 1,
  },
]

const KARIM_THREAD = [
  {
    id: 1,
    sender_id: 1,
    sender_name: 'Karim Uddin',
    content: 'Ki kaj lagbe?',
    created_at: '2025-01-15T10:30:00.000Z',
    is_read: true,
  },
  {
    id: 2,
    sender_id: 999,
    sender_name: 'You',
    content: 'AC thanda hocche na',
    created_at: '2025-01-15T10:32:00.000Z',
    is_read: true,
  },
]

function renderChats(initialPath = '/chats') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

function loginAsUser() {
  saveSession({ accessToken: 'token-abc', refreshToken: 'refresh-abc', role: 'user', name: 'Mahmudul' })
}

function loginAsProvider() {
  saveSession({ accessToken: 'token-xyz', refreshToken: 'refresh-xyz', role: 'provider', name: 'Karim' })
}

beforeEach(() => {
  localStorage.clear()
  listConversations.mockReset()
  getMessageThread.mockReset()
  sendMessage.mockReset()
  getProviderDetail.mockReset()
  // jsdom has no real layout engine, so Element.prototype.scrollIntoView
  // doesn't exist — stub it so MessageThread's auto-scroll can be
  // asserted on, same idea as mocking window.matchMedia in other suites.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('ChatsPage', () => {
  it('sends an unauthenticated visitor to /login', async () => {
    renderChats()

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(listConversations).not.toHaveBeenCalled()
  })

  it('lists conversations with an unread badge', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)

    renderChats()

    expect(await screen.findByRole('button', { name: /karim uddin/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rahim mia/i })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows an empty-inbox state when there are no conversations', async () => {
    loginAsUser()
    listConversations.mockResolvedValue([])

    renderChats()

    expect(await screen.findByText('No conversations yet')).toBeInTheDocument()
  })

  it('opens a conversation and loads its message thread by provider_id', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)
    const user = userEvent.setup()

    renderChats()
    await user.click(await screen.findByRole('button', { name: /karim uddin/i }))

    expect(await screen.findByText('Ki kaj lagbe?')).toBeInTheDocument()
    expect(screen.getByText('AC thanda hocche na')).toBeInTheDocument()
    // A plain customer never sends '?with=' — providerId alone
    // identifies the thread from their side (see chatService.js).
    expect(getMessageThread).toHaveBeenCalledWith({ providerId: 1, withUserId: undefined })
  })

  it('filters the conversation list by search query', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    const user = userEvent.setup()

    renderChats()
    await screen.findByRole('button', { name: /karim uddin/i })

    await user.type(screen.getByPlaceholderText(/search conversations/i), 'Rahim')

    expect(screen.queryByRole('button', { name: /karim uddin/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rahim mia/i })).toBeInTheDocument()
  })

  it('sends a message and clears the composer', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)

    let currentThread = KARIM_THREAD
    getMessageThread.mockImplementation(async () => currentThread)
    sendMessage.mockImplementation(async ({ content }) => {
      const created = { id: 3, content, created_at: '2025-01-15T10:40:00.000Z' }
      currentThread = [...currentThread, { ...created, sender_id: 999, sender_name: 'You', is_read: false }]
      return created
    })
    const user = userEvent.setup()

    renderChats()
    await user.click(await screen.findByRole('button', { name: /karim uddin/i }))
    await screen.findByText('Ki kaj lagbe?')

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Thank you!')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(sendMessage).toHaveBeenCalledWith({ providerId: 1, withUserId: undefined, content: 'Thank you!' })
    // Shows up twice once sent: the bubble in the thread, and the
    // conversation list's updated last-message preview.
    expect(await screen.findAllByText('Thank you!')).toHaveLength(2)
    expect(input).toHaveValue('')
  })

  it("resolves provider_id from the conversation and adds '?with=' when a provider replies", async () => {
    loginAsProvider()
    listConversations.mockResolvedValue(PROVIDER_VIEW_CONVERSATIONS)
    getMessageThread.mockResolvedValue([
      {
        id: 10,
        sender_id: 42,
        sender_name: 'Mahmudul Hasan',
        content: 'Bari te ashben ki?',
        created_at: '2025-01-15T10:32:00.000Z',
        is_read: false,
      },
    ])
    sendMessage.mockResolvedValue({ id: 11, content: 'Kal ashbo', created_at: '2025-01-15T10:41:00.000Z' })
    const user = userEvent.setup()

    renderChats()
    await user.click(await screen.findByRole('button', { name: /mahmudul hasan/i }))
    await screen.findByText('Bari te ashben ki?')

    // provider_id 7 is Karim's own id (Day 8 backend fix); withUserId
    // 42 is the customer's id, required for the provider to reply.
    expect(getMessageThread).toHaveBeenCalledWith({ providerId: 7, withUserId: 42 })

    await user.type(screen.getByPlaceholderText(/type a message/i), 'Kal ashbo')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(sendMessage).toHaveBeenCalledWith({ providerId: 7, withUserId: 42, content: 'Kal ashbo' })
  })

  it('shows the "Rate this provider" banner for a provider conversation, dismissibly', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)
    const user = userEvent.setup()

    renderChats()
    await user.click(await screen.findByRole('button', { name: /karim uddin/i }))

    const banner = await screen.findByText(/rate karim uddin/i)
    expect(banner).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/rate karim uddin/i)).not.toBeInTheDocument()
  })

  it('navigates to the Report Provider page when Report is chosen from the header menu', async () => {
    // Day 9, Dev 1: updated for the Day 8, Dev 3 change where "Report"
    // in the chat header menu links to the real Report Provider page
    // (/providers/:id/report) instead of showing the old "not open
    // yet" placeholder text — see ChatWindowHeader.jsx.
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)
    getProviderDetail.mockResolvedValue({
      id: 1,
      user_id: 1,
      name: 'Karim Uddin',
      area: 'Dhanmondi',
      experience: 8,
      description: 'Professional electrician.',
      photo: null,
      categories: ['Electrician'],
      avg_rating: 4.8,
      review_count: 24,
      member_since: '2024-01-15',
    })
    const user = userEvent.setup()

    renderChats()
    await user.click(await screen.findByRole('button', { name: /karim uddin/i }))
    await screen.findByText('Ki kaj lagbe?')

    await user.click(screen.getByRole('button', { name: /more options/i }))
    await user.click(screen.getByRole('menuitem', { name: /^report$/i }))

    expect(await screen.findByRole('heading', { name: /report this provider/i })).toBeInTheDocument()
  })

  it('opens the conversation named by the ?with= URL param on load', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)

    renderChats('/chats?with=1')

    expect(await screen.findByText('Ki kaj lagbe?')).toBeInTheDocument()
    expect(getMessageThread).toHaveBeenCalledWith({ providerId: 1, withUserId: undefined })
  })

  it('resets the composer draft and dismissed banner when switching threads', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)
    const user = userEvent.setup()

    renderChats()
    await user.click(await screen.findByRole('button', { name: /karim uddin/i }))
    await screen.findByText(/rate karim uddin/i)

    await user.type(screen.getByPlaceholderText(/type a message/i), 'draft I forgot to send')
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/rate karim uddin/i)).not.toBeInTheDocument()

    // Switching to Rahim's thread should remount the window (see the
    // `key` on <ChatWindow> in ChatsPage.jsx — a pre-existing Day 7
    // gap between that component's doc comment and reality, fixed as
    // part of the Day 8 pre-build audit): the draft shouldn't follow,
    // and Rahim's own rate banner shouldn't come back pre-dismissed.
    await user.click(screen.getByRole('button', { name: /rahim mia/i }))
    await screen.findByText(/rate rahim mia/i)

    expect(screen.getByPlaceholderText(/type a message/i)).toHaveValue('')
  })

  it('polls the conversation list every 5 seconds and the open thread on its 20 second fallback', async () => {
    // Real-time chat pass (useChatThread.js): the open thread is kept
    // live via WebSocket, with a 20s poll only as a fallback safety
    // net -- no real socket delivers anything in this test (jsdom's
    // WebSocket never actually connects to a server), so the fallback
    // poll is the only thing that can refresh `messages` here. The
    // conversation list (useConversations.js) is unrelated and still
    // polls every 5s regardless of the thread's own real-time layer.
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)
    vi.useFakeTimers({ shouldAdvanceTime: true })

    renderChats('/chats?with=1')

    await screen.findByText('Ki kaj lagbe?')
    expect(listConversations).toHaveBeenCalledTimes(1)
    expect(getMessageThread).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    // Conversation list ticks on its own 5s cadence...
    expect(listConversations).toHaveBeenCalledTimes(2)
    // ...but 5s isn't enough to reach the thread's 20s fallback yet.
    expect(getMessageThread).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })

    // Now at t=20s: the conversation list has ticked five times total
    // (initial load at t=0, then every 5s: 5s/10s/15s/20s), and the
    // thread's 20s fallback has fired once.
    expect(listConversations).toHaveBeenCalledTimes(5)
    expect(getMessageThread).toHaveBeenCalledTimes(2)
  })

  it('auto-scrolls to newest on first load, but a background poll does not yank a reader away from scrolled-up history', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)
    vi.useFakeTimers({ shouldAdvanceTime: true })

    renderChats('/chats?with=1')
    await screen.findByText('Ki kaj lagbe?')

    // First load always scrolls (nothing to scroll away from yet).
    // vi.waitFor (not a bare assertion) because the scrollIntoView
    // call happens inside a passive effect, which can flush in a
    // later task than the DOM mutation findByText already resolved on.
    await vi.waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1))

    const container = screen.getByTestId('message-thread-scroll-container')
    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true })
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true, configurable: true })
    container.dispatchEvent(new Event('scroll'))

    const longerThread = [
      ...KARIM_THREAD,
      {
        id: 3,
        sender_id: 1,
        sender_name: 'Karim Uddin',
        content: 'Naki asben na?',
        created_at: '2025-01-15T10:45:00.000Z',
        is_read: false,
      },
    ]
    getMessageThread.mockResolvedValue(longerThread)

    // 20s, not 5s: the thread only refreshes here via its 20s fallback
    // poll (no real WebSocket delivers anything in this test).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    await screen.findByText('Naki asben na?')

    // Scrolled up reading history (distance from bottom = 600px, well
    // past the 150px "near bottom" threshold) — the silent poll's new
    // message must not have jumped the view down.
    await vi.waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1))

    // Now the reader is near the bottom — the *next* new message
    // should auto-scroll again.
    Object.defineProperty(container, 'scrollTop', { value: 620, writable: true, configurable: true })
    container.dispatchEvent(new Event('scroll'))

    getMessageThread.mockResolvedValue([
      ...longerThread,
      {
        id: 4,
        sender_id: 1,
        sender_name: 'Karim Uddin',
        content: 'Ok, kal dekha hobe.',
        created_at: '2025-01-15T10:46:00.000Z',
        is_read: false,
      },
    ])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    await screen.findByText('Ok, kal dekha hobe.')

    await vi.waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2))
  })
})