import { toServiceError } from '@/lib/apiError'

import apiClient from './apiClient'

/**
 * Provider wallet / commission ledger — service layer.
 * Backend: backend/wallet (see wallet/models.py for the model).
 *
 * One signed balance per provider:
 *   balance > 0  the platform owes the provider  (available balance)
 *   balance < 0  the provider owes the platform  (due)
 * Every money value is a decimal STRING ("1500.00" / "-150.00").
 */

/**
 * GET /api/wallet/ — Auth required (providers only; 404 otherwise).
 *
 * Response `data`: { balance, available_balance, due_amount,
 *   rate_percent, block_threshold, is_blocked, remaining_before_block,
 *   total_cash_commission, total_online_earnings, total_auto_settled,
 *   total_paid_manually, total_waived, total_paid_out,
 *   recent_transactions: [...] }
 *
 *   const wallet = await getWalletSummary()
 */
export async function getWalletSummary() {
  try {
    const { data } = await apiClient.get('/wallet/')
    return data?.data ?? null
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * GET /api/wallet/transactions/ — the ledger statement, newest first.
 *
 * Response: { data: [{ id, entry_type, entry_label, direction, amount,
 *   balance_after, due_cleared, booking_id, reference, note,
 *   created_at }, ...], count, has_more }
 *
 *   const page = await getWalletTransactions({ limit: 20, offset: 0 })
 *   page.items, page.count, page.hasMore
 */
export async function getWalletTransactions({ limit = 20, offset = 0, type } = {}) {
  try {
    const params = { limit, offset }
    if (type) params.type = type
    const { data } = await apiClient.get('/wallet/transactions/', { params })
    return {
      items: data?.data ?? [],
      count: data?.count ?? 0,
      hasMore: Boolean(data?.has_more),
    }
  } catch (error) {
    throw toServiceError(error)
  }
}

export default { getWalletSummary, getWalletTransactions }