import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getMessageThread, listConversations, sendMessage } from '@/services/chatMockService'

// chatMockService stands in for the real Chat API until Day 8, Dev 1
// wires it up (see the file's header comment) — mocked here the same
// way ProviderDetailPage.test.jsx mocks providerService/contactService,
// so each test fully controls the "backend" instead of depending on
// the seeded demo dataset (or its 350ms simulated latency).
vi.mock('@/services/chatMockService', () => ({
  listConversations: vi.fn(),
  getMessageThread: vi.fn(),
  sendMessage: vi.fn(),
}))

const CONVERSATIONS = [
  {
    provider_id: 1,
    other_user_id: 1,
    other_user_name: 'Karim Uddin',
    other_user_role: 'provider',
    last_message: 'Kal shokal e ashbo.',
    last_message_at: '2025-01-15T10:35:00.000Z',
    unread_count: 0,
    is_online: true,
  },
  {
    provider_id: 2,
    other_user_id: 2,
    other_user_name: 'Rahim Mia',
    other_user_role: 'provider',
    last_message: 'Koto taka lagbe bolun.',
    last_message_at: '2025-01-14T09:00:00.000Z',
    unread_count: 2,
    is_online: false,
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

beforeEach(() => {
  localStorage.clear()
  listConversations.mockReset()
  getMessageThread.mockReset()
  sendMessage.mockReset()
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
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

  it('opens a conversation and loads its message thread', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)
    const user = userEvent.setup()

    renderChats()
    await user.click(await screen.findByRole('button', { name: /karim uddin/i }))

    expect(await screen.findByText('Ki kaj lagbe?')).toBeInTheDocument()
    expect(screen.getByText('AC thanda hocche na')).toBeInTheDocument()
    expect(getMessageThread).toHaveBeenCalledWith(1)
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

    expect(sendMessage).toHaveBeenCalledWith({ otherUserId: 1, content: 'Thank you!' })
    // Shows up twice once sent: the bubble in the thread, and the
    // conversation list's updated last-message preview.
    expect(await screen.findAllByText('Thank you!')).toHaveLength(2)
    expect(input).toHaveValue('')
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

  it('shows a placeholder acknowledgement when Report is chosen from the header menu', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)
    const user = userEvent.setup()

    renderChats()
    await user.click(await screen.findByRole('button', { name: /karim uddin/i }))
    await screen.findByText('Ki kaj lagbe?')

    await user.click(screen.getByRole('button', { name: /more options/i }))
    await user.click(screen.getByRole('menuitem', { name: /^report$/i }))

    expect(await screen.findByText(/reporting isn.t open yet/i)).toBeInTheDocument()
  })

  it('opens the conversation named by the ?with= URL param on load', async () => {
    loginAsUser()
    listConversations.mockResolvedValue(CONVERSATIONS)
    getMessageThread.mockResolvedValue(KARIM_THREAD)

    renderChats('/chats?with=1')

    expect(await screen.findByText('Ki kaj lagbe?')).toBeInTheDocument()
    expect(getMessageThread).toHaveBeenCalledWith(1)
  })
})