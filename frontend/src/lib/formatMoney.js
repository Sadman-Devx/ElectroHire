/**
 * Provider-only commission: money helpers.
 *
 * The API returns every money amount as a decimal STRING ("1500.00") so
 * no precision is lost in transit; these helpers turn those into
 * display text and safe numbers for the (preview-only) commission math.
 * The server is always the authority on the real amounts.
 */

const CURRENCY_SYMBOL = '৳'

/** Parses an API money value ("1500.00" | 1500 | null) into a number, or null. */
export function toMoneyNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** "৳1,500" / "৳1,500.50" — or null when there is no amount. */
export function formatMoney(value) {
  const amount = toMoneyNumber(value)
  if (amount === null) return null
  return `${CURRENCY_SYMBOL}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Preview of what a quote splits into, for the provider's quote form.
 * Mirrors backend calculate_commission (round-half-up to 2 decimals);
 * the real numbers come back from the server after confirming.
 */
export function previewCommission(price, ratePercent) {
  const amount = toMoneyNumber(price)
  const rate = toMoneyNumber(ratePercent)
  if (amount === null || rate === null) return null
  const commission = Math.round(amount * rate) / 100
  return { commission, net: Math.round((amount - commission) * 100) / 100 }
}

/** True for a valid quote string: 1–1,000,000 with at most 2 decimals. */
export function isValidQuote(text) {
  const trimmed = String(text ?? '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return false
  const amount = Number(trimmed)
  return amount >= 1 && amount <= 1000000
}

export default { toMoneyNumber, formatMoney, previewCommission, isValidQuote }