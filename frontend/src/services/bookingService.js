import { toServiceError } from '@/lib/apiError'

import apiClient from './apiClient'

/**
 * Day 11, Dev 2: Provider Booking System — service layer. New
 * feature, not in the API Contract PDF or App Build doc (see
 * backend/bookings/models.py's own docstring for the same note).
 *
 * A Booking is the step after Contact/Chat: a customer asking a
 * specific *active* provider to do a job on a given date/time, with
 * status pending -> confirmed -> completed (or -> rejected /
 * -> cancelled — see Booking.STATUS_CHOICES on the backend for the
 * full one-way lifecycle BookingStatusUpdateView enforces).
 */

/**
 * POST /api/bookings/ — Auth required.
 * Backend: bookings/views.py BookingCreateView.
 *
 * Body: { provider_id, category_id?, scheduled_date: "YYYY-MM-DD",
 *   scheduled_time: "HH:MM", address, description? }
 * Response `data`: { id, provider_name, scheduled_date, scheduled_time, status }
 *
 *   const booking = await createBooking({
 *     providerId: 3, categoryId: 1, scheduledDate: '2026-09-10',
 *     scheduledTime: '14:30', address: 'House 12, Road 5, Dhanmondi',
 *     description: 'AC not cooling',
 *   })
 */
export async function createBooking({
  providerId,
  categoryId,
  scheduledDate,
  scheduledTime,
  address,
  description,
}) {
  try {
    const { data } = await apiClient.post('/bookings/', {
      provider_id: providerId,
      category_id: categoryId || null,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      address,
      description: description || '',
    })
    return data?.data ?? null
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * GET /api/bookings/mine/ — Auth required. "My bookings" — every
 * booking the signed-in visitor has made *as a customer* (works
 * whether the caller's role is "user" or "provider" — see
 * BookingCreateView's own docstring on why role isn't restricted).
 * Backend: bookings/views.py BookingListView.
 *
 * Response `data`: [{ id, provider_id, provider_name, provider_photo,
 *   category_name, scheduled_date, scheduled_time, address,
 *   description, status, quoted_price (the final total — no extra
 *   fees), created_at }, ...]
 *
 *   const bookings = await getMyBookings()
 */
export async function getMyBookings() {
  try {
    const { data } = await apiClient.get('/bookings/mine/')
    return data?.data ?? []
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * GET /api/bookings/provider/ — Auth required. The signed-in
 * provider's own incoming booking requests. 404s (not an empty array)
 * for a caller with no provider profile at all — same "you're not a
 * provider" signal ProviderMeView already uses (see
 * ProviderBookingListView's own docstring) — surfaced here as a
 * thrown ServiceError the same way every other service function
 * surfaces a non-2xx response, so callers use the same try/catch
 * shape regardless of which error it is.
 * Backend: bookings/views.py ProviderBookingListView.
 *
 * Response `data`: [{ id, customer_id, customer_name, customer_phone,
 *   category_name, scheduled_date, scheduled_time, address,
 *   description, status, quoted_price, commission_rate,
 *   commission_amount, provider_net_amount, commission_status,
 *   payment_method, completed_at, created_at }, ...]
 *
 *   const requests = await getProviderBookings()
 */
export async function getProviderBookings() {
  try {
    const { data } = await apiClient.get('/bookings/provider/')
    return data?.data ?? []
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * PATCH /api/bookings/{id}/status/ — Auth required.
 * Backend: bookings/views.py BookingStatusUpdateView.
 *
 * Which transitions are actually allowed depends on whether the
 * caller is the booking's provider or its customer, and the
 * booking's *current* status — this function just sends the
 * request; a disallowed transition comes back as a normal thrown
 * ServiceError with the backend's specific message.
 *
 * Provider-only commission: when the PROVIDER confirms a booking they
 * must send `quotedPrice` — the total the customer will pay. The
 * commission is taken from the provider's side, never added on top.
 * `quotedPrice` is ignored for every other transition.
 *
 * Body: {"status": "confirmed" | "rejected" | "completed" | "cancelled",
 *        "quoted_price"?: "1500.00"}
 * Response `data`:
 *   customer caller: { id, status }
 *   provider caller: { id, status, quoted_price, commission_rate,
 *     commission_amount, provider_net_amount, commission_status,
 *     payment_method, completed_at }
 *
 *   await updateBookingStatus({ bookingId: 7, status: 'confirmed', quotedPrice: '1500' })
 */
export async function updateBookingStatus({ bookingId, status: nextStatus, quotedPrice }) {
  try {
    const body = { status: nextStatus }
    if (quotedPrice !== undefined && quotedPrice !== null && quotedPrice !== '') {
      body.quoted_price = String(quotedPrice).trim()
    }
    const { data } = await apiClient.patch(`/bookings/${bookingId}/status/`, body)
    return data?.data ?? null
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * GET /api/bookings/provider/commission/ — Auth required (providers).
 * Backend: bookings/views.py ProviderCommissionSummaryView.
 *
 * Response `data`: { rate_percent, outstanding, block_threshold,
 *   is_blocked, total_paid, due_bookings: [...same shape as
 *   getProviderBookings() items...] }   (money values are strings)
 *
 *   const summary = await getProviderCommission()
 */
export async function getProviderCommission() {
  try {
    const { data } = await apiClient.get('/bookings/provider/commission/')
    return data?.data ?? null
  } catch (error) {
    throw toServiceError(error)
  }
}

export default {
  createBooking,
  getMyBookings,
  getProviderBookings,
  getProviderCommission,
  updateBookingStatus,
}