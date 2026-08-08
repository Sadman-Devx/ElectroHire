/**
 * Timestamp formatting for the Chat Page (Day 7, Dev 3). Three
 * distinct labels, same idea as formatDate.js's single-purpose
 * formatMonthYear() — each function does one job so call sites stay
 * readable (`formatConversationTime(c.last_message_at)` reads better
 * than a single formatter with a `mode` flag).
 */

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Compact relative label for the conversation list's last-message
 * time — "2m", "3h", "Yesterday", "Mon", or a short date once it's
 * more than a week old. Matches the at-a-glance style in the provided
 * mock (website_remaining_pages_2.html: "2m", "Yesterday").
 */
export function formatConversationTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' })

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Time-of-day label for a single message bubble — "10:30 AM".
 */
export function formatMessageTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/**
 * Day-divider label shown above the first message of each calendar
 * day in the thread — "Today", "Yesterday", or a full date.
 */
export function formatMessageDayLabel(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''

  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default { formatConversationTime, formatMessageTime, formatMessageDayLabel }