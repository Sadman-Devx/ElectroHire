import { useCallback, useState } from 'react'

import { hasErrors, validateBookingForm } from '@/lib/validators'
import { createBooking } from '@/services/bookingService'
import { draftBooking } from '@/services/assistantService'

const MIN_MESSAGE_LENGTH = 3
const EMPTY_VALUES = { scheduledDate: '', scheduledTime: '', address: '', description: '' }

// Server field names -> the form's field names.
const SERVER_FIELD_MAP = {
  scheduled_date: 'scheduledDate',
  scheduled_time: 'scheduledTime',
  address: 'address',
  description: 'description',
}

function mapServerProblems(problems = {}) {
  const mapped = {}
  for (const [field, messages] of Object.entries(problems)) {
    const key = SERVER_FIELD_MAP[field]
    if (key && messages?.length) mapped[key] = messages[0]
  }
  return mapped
}

/**
 * AI booking draft flow (Phase 4A) for ONE provider.
 *
 *   stage: 'input'      customer types "kal shokal 10 tar, House 12 ..."
 *          'drafting'   waiting for the AI
 *          'review'     editable draft shown — NOTHING is booked yet
 *          'confirming' customer pressed Confirm; POST /api/bookings/
 *          'confirmed'  booking exists
 *
 * SAFETY: createBooking() is called from exactly one place —
 * confirm() — which the UI only runs when the customer presses the
 * Confirm button. createDraft() never books anything.
 *
 *   const flow = useBookingDraft({ providerId, categoryId, summary })
 *   await flow.createDraft('kal shokal 10 tar, House 12 Road 5')
 *   await flow.confirm()   // only on the customer's click
 */
export function useBookingDraft({ providerId, categoryId = null, summary = '' }) {
  const [stage, setStage] = useState('input')
  const [draft, setDraft] = useState(null)
  const [values, setValues] = useState(EMPTY_VALUES)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [booking, setBooking] = useState(null)

  const createDraft = useCallback(
    async (message) => {
      const trimmed = (message || '').trim()
      if (trimmed.length < MIN_MESSAGE_LENGTH) {
        setError('Please tell me when and where you want the booking.')
        return false
      }
      setError(null)
      setStage('drafting')
      try {
        const result = await draftBooking({
          providerId,
          message: trimmed,
          problemSummary: summary,
          categoryId,
        })
        setDraft(result)
        setValues({
          scheduledDate: result.draft.scheduled_date || '',
          scheduledTime: result.draft.scheduled_time || '',
          address: result.draft.address || '',
          description: result.draft.description || '',
        })
        setFieldErrors(mapServerProblems(result.problems))
        setStage('review')
        return true
      } catch (err) {
        setError(err?.message || 'Could not prepare the draft. Please try again.')
        setStage('input')
        return false
      }
    },
    [providerId, categoryId, summary]
  )

  const setField = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
    // Editing a field clears its (now stale) error.
    setFieldErrors((current) => (current[name] ? { ...current, [name]: undefined } : current))
    setError(null)
  }, [])

  const confirm = useCallback(async () => {
    const errors = validateBookingForm(values)
    if (hasErrors(errors)) {
      setFieldErrors(errors)
      return false
    }
    setFieldErrors({})
    setError(null)
    setStage('confirming')
    try {
      const created = await createBooking({
        providerId,
        categoryId,
        scheduledDate: values.scheduledDate,
        scheduledTime: values.scheduledTime,
        address: values.address.trim(),
        description: values.description.trim(),
      })
      setBooking(created)
      setStage('confirmed')
      return true
    } catch (err) {
      setError(err?.message || 'Could not send your booking request. Please try again.')
      setStage('review')
      return false
    }
  }, [values, providerId, categoryId])

  const startOver = useCallback(() => {
    setStage('input')
    setDraft(null)
    setValues(EMPTY_VALUES)
    setFieldErrors({})
    setError(null)
  }, [])

  return { stage, draft, values, fieldErrors, error, booking, createDraft, setField, confirm, startOver }
}

export default useBookingDraft
