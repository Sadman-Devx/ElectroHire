import axios from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient, SESSION_EXPIRED_EVENT } from '@/services/apiClient'
import { clearSession, getAccessToken, saveSession } from '@/services/tokenStorage'

// A fake axios adapter that captures the outgoing request config
// instead of making a real HTTP call, so we can inspect exactly what
// the request interceptor did to the headers.
function captureAdapterConfig() {
  let captured
  const adapter = (config) => {
    captured = config
    return Promise.resolve({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
  }
  return { adapter, get captured() { return captured } }
}

afterEach(() => {
  clearSession()
})

describe('apiClient Authorization interceptor', () => {
  it('attaches "Bearer <token>" when a session is stored', async () => {
    saveSession({ accessToken: 'tok-abc', refreshToken: 'r', role: 'user', name: 'X' })
    const state = captureAdapterConfig()

    await apiClient.get('/providers/', { adapter: state.adapter })

    expect(state.captured.headers.Authorization).toBe('Bearer tok-abc')
  })

  it('does not attach an Authorization header when logged out', async () => {
    clearSession()
    const state = captureAdapterConfig()

    await apiClient.get('/categories/', { adapter: state.adapter })

    expect(state.captured.headers.Authorization).toBeUndefined()
  })
})

// Day 9, Dev 1: 401 -> POST /api/auth/refresh/ -> retry-once interceptor.
describe('apiClient 401 refresh interceptor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearSession()
  })

  // Adapter that fails with 401 until it sees the *refreshed* token on
  // the Authorization header, then succeeds — lets one adapter stand
  // in for both "the original expired-token request" and "the retried
  // request with the new token" without tracking call counts.
  function expiredThenFreshAdapter(freshToken) {
    return (config) => {
      if (config.headers.Authorization === `Bearer ${freshToken}`) {
        return Promise.resolve({
          data: { status: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        })
      }
      const error = new Error('Unauthorized')
      error.config = config
      error.response = { status: 401, data: { status: 'error', message: 'Unauthorized' } }
      return Promise.reject(error)
    }
  }

  it('refreshes the access token and retries the original request once', async () => {
    saveSession({ accessToken: 'expired-tok', refreshToken: 'refresh-tok', role: 'user', name: 'X' })
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { status: 'success', data: { access_token: 'fresh-tok' } },
    })

    const response = await apiClient.get('/ratings/mine/', {
      adapter: expiredThenFreshAdapter('fresh-tok'),
    })

    expect(response.status).toBe(200)
    expect(axios.post).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBe('fresh-tok')
  })

  it('clears the session and dispatches session-expired when the refresh token itself is invalid', async () => {
    saveSession({ accessToken: 'expired-tok', refreshToken: 'dead-refresh-tok', role: 'user', name: 'X' })
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh token expired'))
    const onSessionExpired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)

    await expect(
      apiClient.get('/ratings/mine/', { adapter: expiredThenFreshAdapter('fresh-tok') })
    ).rejects.toBeTruthy()

    expect(getAccessToken()).toBeNull()
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
    window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
  })

  it('does not attempt a refresh for the login endpoint itself', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: {} })
    const unauthorizedAdapter = (config) => {
      const error = new Error('Unauthorized')
      error.config = config
      error.response = { status: 401, data: {} }
      return Promise.reject(error)
    }

    await expect(
      apiClient.post('/auth/login/', {}, { adapter: unauthorizedAdapter })
    ).rejects.toBeTruthy()

    expect(axios.post).not.toHaveBeenCalled()
  })

  it('does not retry a request that has already been retried once', async () => {
    saveSession({ accessToken: 'expired-tok', refreshToken: 'refresh-tok', role: 'user', name: 'X' })
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { status: 'success', data: { access_token: 'fresh-tok' } },
    })
    // Adapter always 401s, regardless of token — simulates a request
    // that's broken for a reason other than an expired access token.
    const alwaysUnauthorizedAdapter = (config) => {
      const error = new Error('Unauthorized')
      error.config = config
      error.response = { status: 401, data: {} }
      return Promise.reject(error)
    }

    await expect(
      apiClient.get('/ratings/mine/', { adapter: alwaysUnauthorizedAdapter })
    ).rejects.toBeTruthy()

    // One refresh attempt (from the first 401), not a second one once
    // the retried request 401s again.
    expect(axios.post).toHaveBeenCalledTimes(1)
  })
})