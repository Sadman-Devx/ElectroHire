import { beforeEach, describe, expect, it, vi } from 'vitest'

import apiClient from '@/services/apiClient'
import { analyzeProblem } from '@/services/assistantService'

vi.mock('@/services/apiClient', () => ({
  default: { post: vi.fn() },
}))

beforeEach(() => {
  apiClient.post.mockReset()
})

describe('analyzeProblem', () => {
  it('POSTs the problem and trimmed area to /assistant/analyze/ and returns data', async () => {
    apiClient.post.mockResolvedValue({ data: { status: 'success', data: { urgency: 'low' } } })

    const result = await analyzeProblem({ problem: 'Ceiling fan ghure na', area: '  Gulshan  ' })

    expect(result).toEqual({ urgency: 'low' })
    const [url, body, config] = apiClient.post.mock.calls[0]
    expect(url).toBe('/assistant/analyze/')
    expect(body).toEqual({ problem: 'Ceiling fan ghure na', area: 'Gulshan' })
    expect(config.timeout).toBeGreaterThan(0) // never hangs forever
  })

  it('omits area when it is blank or missing', async () => {
    apiClient.post.mockResolvedValue({ data: { data: {} } })

    await analyzeProblem({ problem: 'Ceiling fan ghure na', area: '   ' })
    await analyzeProblem({ problem: 'Ceiling fan ghure na' })

    expect(apiClient.post.mock.calls[0][1]).toEqual({ problem: 'Ceiling fan ghure na' })
    expect(apiClient.post.mock.calls[1][1]).toEqual({ problem: 'Ceiling fan ghure na' })
  })

  it('turns an API error into an Error carrying the backend message and status', async () => {
    apiClient.post.mockRejectedValue({
      response: { status: 503, data: { status: 'error', message: 'The AI assistant is having trouble right now.' } },
    })

    await expect(analyzeProblem({ problem: 'Ceiling fan ghure na' })).rejects.toMatchObject({
      message: 'The AI assistant is having trouble right now.',
      status: 503,
    })
  })

  it('gives a friendly message when the request times out', async () => {
    apiClient.post.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 75000ms exceeded' })

    await expect(analyzeProblem({ problem: 'Ceiling fan ghure na' })).rejects.toThrow(
      /taking too long/i
    )
  })

  it('gives the network message when the server is unreachable', async () => {
    apiClient.post.mockRejectedValue({ message: 'Network Error' })

    await expect(analyzeProblem({ problem: 'Ceiling fan ghure na' })).rejects.toThrow(/network error/i)
  })
})

describe('draftBooking', () => {
  it('POSTs provider, message, summary and category to /assistant/booking-draft/', async () => {
    apiClient.post.mockResolvedValue({ data: { data: { ready: true } } })
    const { draftBooking } = await import('@/services/assistantService')

    const result = await draftBooking({
      providerId: 7,
      message: 'kal shokal 10 tar',
      problemSummary: 'Fan not spinning.',
      categoryId: 1,
    })

    expect(result).toEqual({ ready: true })
    const [url, body, config] = apiClient.post.mock.calls[0]
    expect(url).toBe('/assistant/booking-draft/')
    expect(body).toEqual({
      provider_id: 7,
      message: 'kal shokal 10 tar',
      problem_summary: 'Fan not spinning.',
      category_id: 1,
    })
    expect(config.timeout).toBeGreaterThan(0)
  })

  it('omits the optional fields when they are empty', async () => {
    apiClient.post.mockResolvedValue({ data: { data: {} } })
    const { draftBooking } = await import('@/services/assistantService')

    await draftBooking({ providerId: 7, message: 'kal 10 tar', problemSummary: '', categoryId: null })

    expect(apiClient.post.mock.calls[0][1]).toEqual({ provider_id: 7, message: 'kal 10 tar' })
  })

  it('surfaces the backend message (e.g. provider not bookable) and a friendly timeout', async () => {
    const { draftBooking } = await import('@/services/assistantService')
    apiClient.post.mockRejectedValueOnce({
      response: { status: 400, data: { status: 'error', message: 'This provider is not currently accepting bookings.' } },
    })
    await expect(draftBooking({ providerId: 7, message: 'kal 10 tar' })).rejects.toMatchObject({
      message: 'This provider is not currently accepting bookings.',
      status: 400,
    })

    apiClient.post.mockRejectedValueOnce({ code: 'ECONNABORTED' })
    await expect(draftBooking({ providerId: 7, message: 'kal 10 tar' })).rejects.toThrow(/taking too long/i)
  })
})
