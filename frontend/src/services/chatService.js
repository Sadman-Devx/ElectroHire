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
 *
 * Attachments update: sendMessage() can now also send a photo, a
 * document or a voice note. Text-only messages still go out as JSON
 * exactly as before; anything with an attachment goes out as
 * multipart/form-data (same approach providerService.setupProviderProfile
 * uses for the profile photo).
 */

/**
 * GET /api/contacts/conversations/ — Auth required.
 * Backend: contacts/views.py ConversationListView (Day 7, Dev 1; not
 * in the API Contract PDF — see that view's docstring for why).
 *
 * Response shape (ConversationSerializer):
 *   [{ provider_id, other_user_id, other_user_name, other_user_role,
 *      last_message, last_message_at, unread_count }, ...]
 * newest last-message first (already sorted server-side). For
 * attachment messages `last_message` is a short label such as
 * "📷 Photo" or "🎤 Voice message".
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
 *   [{ id, sender_id, sender_name, content, created_at, is_read,
 *      message_type, attachment_url, attachment_name, attachment_size,
 *      attachment_mime, duration_seconds }, ...]
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
 * Backend: contacts/views.py MessageListCreateView.post().
 * Sending as the customer also creates a ContactLog entry server-side
 * (rating-eligibility bookkeeping) — nothing the frontend needs to do
 * for that, it's automatic on the backend.
 *
 *   // text
 *   await sendMessage({ providerId: 1, content: 'Kal sokal ashun' })
 *   // photo / file (content is an optional caption)
 *   await sendMessage({ providerId: 1, attachment: file, messageType: 'image', content: 'Here it is' })
 *   // voice note
 *   await sendMessage({ providerId: 1, attachment: file, messageType: 'voice', durationSeconds: 12 })
 *
 * `onUploadProgress(fraction)` (0..1) is called while an attachment
 * uploads, so the chat bubble can show a progress ring.
 *
 * Response shape (MessageCreateResponseSerializer) — deliberately no
 * sender_id, matching the API Contract:
 *   { id, content, created_at, message_type, attachment_url, attachment_name,
 *     attachment_size, attachment_mime, duration_seconds, preview }
 */
export async function sendMessage({
  providerId,
  withUserId,
  content = '',
  attachment,
  messageType,
  durationSeconds,
  onUploadProgress,
}) {
  const trimmed = (content ?? '').trim()
  if (!trimmed && !attachment) {
    throw new Error('Message content cannot be empty.')
  }

  const url = `/contacts/messages/${providerId}/`
  const params = withUserId ? { with: withUserId } : undefined

  try {
    if (attachment) {
      const formData = new FormData()
      formData.append('attachment', attachment)
      if (messageType) formData.append('message_type', messageType)
      if (trimmed) formData.append('content', trimmed)
      if (durationSeconds != null) formData.append('duration_seconds', String(Math.round(durationSeconds)))

      const { data } = await apiClient.post(url, formData, {
        params,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (onUploadProgress && event.total) onUploadProgress(event.loaded / event.total)
        },
      })
      return data?.data ?? null
    }

    const { data } = await apiClient.post(url, { content: trimmed }, { params })
    return data?.data ?? null
  } catch (error) {
    throw toServiceError(error)
  }
}

export default { listConversations, getMessageThread, sendMessage }