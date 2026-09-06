/**
 * Formats the "YYYY-MM-DD" string GET /api/providers/{id}/ returns for
 * `member_since` (see providers/serializers.py ProviderDetailSerializer)
 * into a short "Mon YYYY" label for the contact card.
 *
 * Appends T00:00:00 before parsing so this reads as local midnight
 * instead of UTC midnight — otherwise users west of UTC would see the
 * day before the actual date on some inputs.
 */
export function formatMonthYear(isoDateString) {
  if (!isoDateString) return null

  const date = new Date(`${isoDateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/**
 * Day 11: formats the "YYYY-MM-DD" string bookings/serializers.py
 * returns for `scheduled_date` into a short "Mon D, YYYY" label —
 * used by BookProviderPage's confirmation screen and by
 * MyBookingsPage/ProviderBookingsPage's booking cards.
 *
 * Same local-midnight parsing as formatMonthYear above, for the same
 * reason (otherwise users west of UTC see the day before the actual
 * scheduled date on some inputs).
 */
export function formatDate(isoDateString) {
  if (!isoDateString) return null

  const date = new Date(`${isoDateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Day 11: formats the "HH:MM:SS" (or "HH:MM") string
 * bookings/serializers.py returns for `scheduled_time` into a short
 * 12-hour "2:30 PM" label. Parsed as plain hours/minutes rather than
 * through Date() — a bare time-of-day string has no timezone/date
 * component to it, so there's no UTC-vs-local ambiguity to guard
 * against the way formatDate/formatMonthYear do for full dates.
 */
export function formatTime(timeString) {
  if (!timeString) return null

  const [hoursStr, minutesStr] = timeString.split(':')
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  const period = hours >= 12 ? 'PM' : 'AM'
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12
  return `${twelveHour}:${String(minutes).padStart(2, '0')} ${period}`
}

export default { formatMonthYear, formatDate, formatTime }