/**
 * MOCK Chat service — Day 7, Dev 3.
 *
 * The schedule splits chat into two days on purpose: Dev 1 builds the
 * real Chat API today (Message model, GET/POST
 * /api/contacts/messages/{provider_id}/, GET /api/contacts/conversations/),
 * while Dev 3's job today is only the *Chat Page UI* — "Chat Page UI
 * Ready" is this day's output, not "Chat API Connected". That's Day 8,
 * Dev 1's task ("Chat API সব React-এ Connect করো ... Auto-Refresh ...
 * Auto-Scroll"). Same staged pattern the Signup/Login pages used on
 * Day 2 ("Mock, API Connect পরে") before Day 3 wired them up.
 *
 * This module fakes the three endpoints Dev 1 is building today, with
 * the exact same function names, arguments, and return shapes the
 * real service module will have — see contacts/serializers.py:
 *   - listConversations()                 -> ConversationSerializer[]
 *   - getMessageThread(otherUserId)       -> MessageListItemSerializer[]
 *   - sendMessage({ otherUserId, content }) -> MessageCreateResponseSerializer
 *
 * Day 8, Dev 1 hand-off: replace the body of these three functions
 * with real apiClient calls (see contactService.js for the pattern),
 * delete the in-memory store below, and nothing in hooks/ or
 * components/chat/ needs to change.
 *
 * KNOWN GAP TO FLAG FOR DEV 1 (found while building this): the real
 * GET/POST /api/contacts/messages/{provider_id}/ route is keyed by
 * `provider_id`, but contacts/serializers.py's ConversationSerializer
 * only fills `provider_id` from the *other* party's provider profile —
 * so when the signed-in user is the provider replying to a plain
 * "user" customer, `provider_id` comes back null and there's no way
 * for the frontend to build that URL from conversation-list data
 * alone (it would need the provider's own provider_id, not the
 * customer's). Sidestepped here by keying everything off
 * `other_user_id` instead, which works for both directions — worth a
 * look before Day 8 wiring.
 */

const MOCK_DELAY_MS = 350

// AuthContext today only stores { role, name } (see
// services/tokenStorage.js) — no user id — so there's no real "my
// id" to key these mock threads off of. This fixed placeholder just
// stands in for "whoever is logged in" so sent messages render with
// a stable, consistent sender_id. Real wiring won't need this at all:
// the backend already knows request.user, and the frontend can tell
// "mine" from "theirs" purely by comparing sender_id to the
// conversation's other_user_id (see hooks/useChatThread.js) — no
// current-user id required on this side either.
const ME_ID = 999

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
}

// Sample data reuses the same demo people the provided design mocks
// and the rest of this app already use (Karim Uddin the electrician,
// ProviderDetailPage.test.jsx's "Karim Uddin" fixture, etc) so the
// Chat Page looks at home next to the pages built on earlier days.
let conversations = [
  {
    provider_id: 1,
    other_user_id: 1,
    other_user_name: 'Karim Uddin',
    other_user_role: 'provider',
    last_message: 'Dhanmondi 15 no, Green Villa building — thik ache, kal shokal e ashbo.',
    last_message_at: minutesAgo(2),
    unread_count: 0,
    // Decorative only — no presence/online field exists anywhere in
    // the schema (App Build doc, Phase 3) or the API Contract. Real
    // "online now" status needs a backend feature that doesn't exist
    // yet; flagged the same way StickyContactCard flags the missing
    // phone number rather than silently inventing live data.
    is_online: true,
  },
  {
    provider_id: 2,
    other_user_id: 2,
    other_user_name: 'Rahim Mia',
    other_user_role: 'provider',
    last_message: 'Koto taka lagbe bolun, ami kal e chole asbo.',
    last_message_at: minutesAgo(48),
    unread_count: 2,
    is_online: false,
  },
  {
    provider_id: 3,
    other_user_id: 3,
    other_user_name: 'Salam Hossain',
    other_user_role: 'provider',
    last_message: 'Thank you for contacting. Ami apnar sathe jogajog korbo.',
    last_message_at: daysAgo(1),
    unread_count: 0,
    is_online: false,
  },
]

let threads = {
  1: [
    {
      id: 1,
      sender_id: 1,
      sender_name: 'Karim Uddin',
      content: 'Assalamualaikum, ami electrician Karim. Ki kaj lagbe?',
      created_at: minutesAgo(30),
      is_read: true,
    },
    {
      id: 2,
      sender_id: ME_ID,
      sender_name: 'You',
      content: 'Bari te AC thanda hocche na, dekhben?',
      created_at: minutesAgo(28),
      is_read: true,
    },
    {
      id: 3,
      sender_id: 1,
      sender_name: 'Karim Uddin',
      content: 'Ji, kal sokal e ashte parbo. Address diben?',
      created_at: minutesAgo(25),
      is_read: true,
    },
    {
      id: 4,
      sender_id: ME_ID,
      sender_name: 'You',
      content: 'Dhanmondi 15 no, Green Villa building',
      created_at: minutesAgo(24),
      is_read: true,
    },
    {
      id: 5,
      sender_id: 1,
      sender_name: 'Karim Uddin',
      content: 'Dhanmondi 15 no, Green Villa building — thik ache, kal shokal e ashbo.',
      created_at: minutesAgo(2),
      is_read: true,
    },
  ],
  2: [
    {
      id: 6,
      sender_id: ME_ID,
      sender_name: 'You',
      content: 'Assalamualaikum, amar basay pipe theke pani leak korche, dekhben?',
      created_at: minutesAgo(90),
      is_read: true,
    },
    {
      id: 7,
      sender_id: 2,
      sender_name: 'Rahim Mia',
      content: 'Kon area apni? Ami ashte pari kalke.',
      created_at: minutesAgo(75),
      is_read: true,
    },
    {
      id: 8,
      sender_id: 2,
      sender_name: 'Rahim Mia',
      content: 'Kaj ta koto boro? Chobi pathaite parben ekta?',
      created_at: minutesAgo(50),
      is_read: false,
    },
    {
      id: 9,
      sender_id: 2,
      sender_name: 'Rahim Mia',
      content: 'Koto taka lagbe bolun, ami kal e chole asbo.',
      created_at: minutesAgo(48),
      is_read: false,
    },
  ],
  3: [
    {
      id: 10,
      sender_id: ME_ID,
      sender_name: 'You',
      content: 'Tutor lagbe amar chele-r jonno, class 8 — math ar science.',
      created_at: daysAgo(1),
      is_read: true,
    },
    {
      id: 11,
      sender_id: 3,
      sender_name: 'Salam Hossain',
      content: 'Thank you for contacting. Ami apnar sathe jogajog korbo.',
      created_at: daysAgo(1),
      is_read: true,
    },
  ],
}

let nextMessageId = 12

/**
 * GET /api/contacts/conversations/ (mocked).
 * Returns every conversation, newest last-message first — same order
 * ConversationListView already sorts in on the backend.
 */
export async function listConversations() {
  await delay()
  return conversations
    .slice()
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
}

/**
 * GET /api/contacts/messages/{provider_id}/ (mocked, keyed by
 * other_user_id — see the KNOWN GAP note above).
 * Opening a thread marks the other party's messages read, mirroring
 * MessageListCreateView.get()'s real behavior.
 */
export async function getMessageThread(otherUserId) {
  await delay()
  const thread = threads[otherUserId] || []
  threads[otherUserId] = thread.map((message) =>
    message.sender_id === otherUserId ? { ...message, is_read: true } : message
  )
  conversations = conversations.map((conversation) =>
    conversation.other_user_id === otherUserId ? { ...conversation, unread_count: 0 } : conversation
  )
  return threads[otherUserId]
}

/**
 * POST /api/contacts/messages/{provider_id}/ (mocked).
 * Response shape matches MessageCreateResponseSerializer exactly —
 * { id, content, created_at }, no sender_name — same gap the real
 * endpoint has, so nothing here trains the UI to depend on a field
 * the real response won't provide.
 */
export async function sendMessage({ otherUserId, content }) {
  await delay()

  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Message content cannot be empty.')
  }

  const message = {
    id: nextMessageId++,
    sender_id: ME_ID,
    sender_name: 'You',
    content: trimmed,
    created_at: new Date().toISOString(),
    is_read: false,
  }

  threads[otherUserId] = [...(threads[otherUserId] || []), message]
  conversations = conversations.map((conversation) =>
    conversation.other_user_id === otherUserId
      ? { ...conversation, last_message: trimmed, last_message_at: message.created_at }
      : conversation
  )

  return { id: message.id, content: message.content, created_at: message.created_at }
}

export default { listConversations, getMessageThread, sendMessage }