import { useCallback, useRef, useState } from 'react'

import { analyzeProblem } from '@/services/assistantService'

const DEFAULT_ERROR = 'The AI assistant could not answer right now. Please try again.'

/**
 * State for the AI Assistant chat. Each "turn" is one question and
 * its answer; turns are independent analyses (no server-side chat
 * memory yet), shown top-to-bottom like a conversation.
 *
 *   turn = { id, problem, area, status: 'loading' | 'done' | 'error',
 *            result, error }
 *
 *   const { turns, isSending, send, retry } = useAssistantChat()
 *   const ok = await send({ problem: 'Ceiling fan ghure na', area: 'Gulshan' })
 *
 * Only one request runs at a time (isSending) so a double-click can't
 * fire two billed AI calls.
 */
export function useAssistantChat() {
  const [turns, setTurns] = useState([])
  const turnsRef = useRef([])
  const nextId = useRef(1)

  const commit = useCallback((updater) => {
    const next = updater(turnsRef.current)
    turnsRef.current = next
    setTurns(next)
  }, [])

  const patch = useCallback(
    (id, changes) =>
      commit((current) => current.map((t) => (t.id === id ? { ...t, ...changes } : t))),
    [commit]
  )

  const run = useCallback(
    async (id, problem, area) => {
      try {
        const result = await analyzeProblem({ problem, area })
        patch(id, { status: 'done', result, error: null })
        return true
      } catch (err) {
        patch(id, { status: 'error', result: null, error: err?.message || DEFAULT_ERROR })
        return false
      }
    },
    [patch]
  )

  const isSending = turns.some((t) => t.status === 'loading')

  const send = useCallback(
    async ({ problem, area }) => {
      if (turnsRef.current.some((t) => t.status === 'loading')) return false
      const id = nextId.current++
      commit((current) => [
        ...current,
        { id, problem, area: area || null, status: 'loading', result: null, error: null },
      ])
      return run(id, problem, area)
    },
    [commit, run]
  )

  const retry = useCallback(
    async (id) => {
      const turn = turnsRef.current.find((t) => t.id === id)
      if (!turn || turnsRef.current.some((t) => t.status === 'loading')) return false
      patch(id, { status: 'loading', error: null })
      return run(id, turn.problem, turn.area)
    },
    [patch, run]
  )

  return { turns, isSending, send, retry }
}

export default useAssistantChat
