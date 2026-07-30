import { afterEach, describe, expect, it } from 'vitest'

import { clearSession, getAccessToken, getSession, saveSession } from '@/services/tokenStorage'

afterEach(() => {
  localStorage.clear()
})

describe('tokenStorage', () => {
  it('returns null when nothing has been stored yet', () => {
    expect(getSession()).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('saveSession persists the full session and getSession reads it back', () => {
    const saved = saveSession({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      role: 'user',
      name: 'Mahmudul Hasan',
    })

    expect(saved).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      role: 'user',
      name: 'Mahmudul Hasan',
    })
    expect(getSession()).toEqual(saved)
    expect(getAccessToken()).toBe('access-1')
  })

  it('defaults name to null when not provided', () => {
    saveSession({ accessToken: 'access-2', refreshToken: 'refresh-2', role: 'provider' })
    expect(getSession().name).toBeNull()
  })

  it('clearSession removes the stored session', () => {
    saveSession({ accessToken: 'access-3', refreshToken: 'refresh-3', role: 'user', name: 'X' })
    expect(getSession()).not.toBeNull()

    clearSession()

    expect(getSession()).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('treats corrupted JSON in storage as "no session" rather than throwing', () => {
    localStorage.setItem('electrohire_auth_session', '{not valid json')
    expect(getSession()).toBeNull()
  })

  it('treats a stored session without an accessToken as "no session"', () => {
    localStorage.setItem('electrohire_auth_session', JSON.stringify({ role: 'user' }))
    expect(getSession()).toBeNull()
  })
})