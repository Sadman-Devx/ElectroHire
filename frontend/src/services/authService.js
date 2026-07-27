/**
 * MOCK auth service — Day 2, Dev 3 scope is UI only ("Mock, API Connect
 * পরে" per the schedule). Day 3, Dev 1 wires these up for real against
 * the already-built backend:
 *
 *   register(payload) -> apiClient.post('/auth/register/', payload)
 *   login(payload)     -> apiClient.post('/auth/login/', payload)
 *
 * Both mocks return/throw shapes that already match the real API
 * Contract ({status, message} / {status, message, data}), so
 * SignupPage/LoginPage's error handling won't need to change when the
 * real calls are swapped in — only the body of these two functions does.
 */

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function register(payload) {
  await delay(800)

  const email = (payload.email || '').trim().toLowerCase()

  // Mocks the one real validation rule that can't be caught client-side
  // (checking the backend for a pre-existing verified account), so the
  // page's error-handling path is exercised even before Day 3 wires up
  // the real call.
  if (email === 'taken@example.com') {
    const error = new Error('Email already exists')
    error.status = 400
    throw error
  }

  return {
    status: 'success',
    message: 'OTP sent to your email',
  }
}

export async function login(payload) {
  await delay(800)

  if ((payload.password || '').length < 8) {
    const error = new Error('Invalid email or password')
    error.status = 400
    throw error
  }

  return {
    status: 'success',
    data: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      role: 'user',
    },
  }
}