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

export default { formatMonthYear }