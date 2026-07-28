import { afterEach, describe, expect, it } from 'vitest'

import { apiClient } from '@/services/apiClient'
import { clearSession, saveSession } from '@/services/tokenStorage'

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