import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import { useConversations } from '@/hooks/useConversations'
import { listConversations } from '@/services/chatService'

/**
 * Regression test for a real, reported production bug (not caught by
 * ChatsPage.test.jsx, because that suite's `renderChats()` never wraps
 * in <StrictMode> — see main.jsx, where the real app always does).
 *
 * Symptom as reported: a provider's /chats page showed the loading
 * skeleton forever, even though the backend had real conversations for
 * that account (verified independently via curl and a Django test
 * client) and the Provider Dashboard — a different component, not
 * using this hook's polling path in the same way — correctly showed
 * "someone messaged you". The conversation list itself never painted.
 *
 * Root cause: React 18/19 StrictMode's dev-only mount → cleanup →
 * mount-again cycle. `useConversations`'s `isFetchingRef` is a ref, so
 * it survives that whole cycle as *one* value, while each effect
 * invocation's own `isMounted` closure variable does not. Sequence:
 *   1. Effect run #1 ("trial") starts loadConversations(), sets
 *      isFetchingRef.current = true, awaits the network call.
 *   2. React immediately cleans up run #1 (isMounted_A = false).
 *   3. Effect run #2 ("real") calls loadConversations() again, but
 *      isFetchingRef.current is still true from run #1's still-pending
 *      request, so it bails out via the guard and never fetches.
 *   4. Run #1's request eventually resolves, but its own closure's
 *      isMounted (A) is false, so setConversations()/setIsLoading
 *      (false) are both skipped by design.
 *   5. isLoading is stuck at `true` forever -- the panel never leaves
 *      its skeleton, even though the next *silent* 5s poll (run #2's
 *      own interval) does quietly populate `conversations` behind it.
 *
 * Fix: release isFetchingRef in the cleanup function too, not just
 * isMounted, so run #2's own call is never blocked by run #1's
 * already-torn-down request. See useConversations.js's cleanup
 * comment for the full write-up.
 */

vi.mock('@/services/chatService', () => ({
  listConversations: vi.fn(),
}))

const CONVERSATIONS = [
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

beforeEach(() => {
  listConversations.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useConversations under React StrictMode', () => {
  it('still leaves the loading state once the real (second) effect run resolves', async () => {
    // A real network call never resolves on the same tick — without
    // this microtask delay, the bug doesn't reproduce, because both
    // StrictMode runs would settle before the guard even matters.
    listConversations.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(CONVERSATIONS), 0))
    )

    const { result } = renderHook(() => useConversations(), {
      wrapper: StrictMode,
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.conversations).toEqual(CONVERSATIONS)
  })

  it('does not leave two overlapping fetches permanently stuck (ref guard still works within one run)', async () => {
    let callCount = 0
    listConversations.mockImplementation(() => {
      callCount += 1
      return new Promise((resolve) => setTimeout(() => resolve(CONVERSATIONS), 0))
    })

    renderHook(() => useConversations(), { wrapper: StrictMode })

    await waitFor(() => expect(callCount).toBeGreaterThan(0))
    // StrictMode's trial run and the real run may each fire one
    // request (a harmless dev-only duplicate — see the cleanup
    // comment), but the guard must still prevent it from spiraling:
    // nowhere near e.g. 5+ calls from a single mount.
    expect(callCount).toBeLessThanOrEqual(2)
  })
})