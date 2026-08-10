import { toServiceError } from '@/lib/apiError'

import apiClient from './apiClient'

/**
 * Real Chat API service — Day 8, Dev 1 ("Chat API সব React-এ Connect
 * করো"). Replaces chatMockService.js, which was the Day 7, Dev 3
 * placeholder — see that file's former header comment (removed along
 * with the file) for the hand-off plan this follows.
 *
 * Function names match the mock's ~1:1, but the params changed from
 * a single `otherUserId` to `{ providerId, withUserId }`: the real
 * endpoint is keyed by *provider_id* (a Provider PK), not by the
 * other user's id — see contacts/urls.py
 * (`messages/<int:provider_id>/`) and contacts/views.py's
 * MessageListCreateView docstring. `withUserId` is only sent as
 * `?with=` when the signed-in user is the provider replying (see
 * MessageListCreateView._resolve_other_user on the backend) — a
 * plain customer never needs it, since provider_id alone identifies
 * the thread from their side. useChatThread() decides when to pass it.
 */

/**
 * GET /api/contacts/conversations/ — Auth required.
 * Backend: contacts/views.py ConversationListView (Day 7, Dev 1; not
 * in the API Contract PDF — see that view's docstring for why).
 *
 * Response shape (ConversationSerializer):
 *   [{ provider_id, other_user_id, other_user_name, other_user_role,
 *      last_message, last_message_at, unread_count }, ...]
 * newest last-message first (already sorted server-side).
 *
 *   const conversations = await listConversations()
 */
export async function listConversations() {
  try {
    const { data } = await apiClient.get('/contacts/conversations/')
    return data?.data ?? []
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * GET /api/contacts/messages/{provider_id}/ — Auth required.
 * Backend: contacts/views.py MessageListCreateView.get() (Day 7, Dev 1).
 *
 * Opening a thread also marks the other party's messages read on the
 * backend (per MessageListCreateView.get()'s trailing .update() call) —
 * callers should follow up with useConversations().markThreadRead() the
 * same way the mock service's callers did, so the conversation list's
 * unread badge clears immediately instead of waiting for the next poll.
 *
 * Response shape (MessageListItemSerializer), oldest first:
 *   [{ id, sender_id, sender_name, content, created_at, is_read }, ...]
 *
 *   const messages = await getMessageThread({ providerId: 1 })                 // customer side
 *   const messages = await getMessageThread({ providerId: 1, withUserId: 5 })  // provider replying
 */
export async function getMessageThread({ providerId, withUserId } = {}) {
  try {
    const { data } = await apiClient.get(`/contacts/messages/${providerId}/`, {
      params: withUserId ? { with: withUserId } : undefined,
    })
    return data?.data ?? []
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * POST /api/contacts/messages/{provider_id}/ — Auth required.
 * Backend: contacts/views.py MessageListCreateView.post() (Day 7, Dev 1).
 * Sending as the customer also creates a ContactLog entry server-side
 * (rating-eligibility bookkeeping) — nothing the frontend needs to do
 * for that, it's automatic on the backend.
 *
 * Response shape (MessageCreateResponseSerializer) — deliberately no
 * sender_id, matching the API Contract exactly:
 *   { id, content, created_at }
 *
 *   const created = await sendMessage({ providerId: 1, content: 'Kal sokal ashun' })
 */
export async function sendMessage({ providerId, withUserId, content }) {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Message content cannot be empty.')
  }

  try {
    const { data } = await apiClient.post(
      `/contacts/messages/${providerId}/`,
      { content: trimmed },
      { params: withUserId ? { with: withUserId } : undefined }
    )
    return data?.data ?? null
  } catch (error) {
    throw toServiceError(error)
  }
}

export default { listConversations, getMessageThread, sendMessage }