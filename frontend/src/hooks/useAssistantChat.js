import { useCallback, useRef, useState } from 'react'

import { analyzeProblem } from '@/services/assistantService'

const DEFAULT_ERROR = 'The AI assistant could not answer right now. Please try again.'

// Conversation memory (Phase 4C): only the last few finished exchanges
// go along with a new question — small on purpose (cost and speed).
export const MAX_HISTORY_TURNS = 3

/**
 * The earlier finished turns (oldest first, at most MAX_HISTORY_TURNS)
 * as { problem, summary } pairs. Turns that errored or are still
 * loading carry no answer, so they are left out. With `beforeId`, only
 * turns that came before that turn are considered (used by retry).
 */
export function buildHistory(turns, beforeId = null) {
  const index = beforeId == null ? turns.length : turns.findIndex((t) => t.id === beforeId)
  return turns
    .slice(0, index < 0 ? turns.length : index)
    .filter((t) => t.status === 'done' && t.result)
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ problem: t.problem, summary: t.result.summary || '' }))
}

/**
 * State for the AI Assistant chat. Each "turn" is one question and
 * its answer; turns are independent analyses (no server-side chat
 * memory yet), shown top-to-bottom like a conversation.
 *
 *   turn = { id, problem, area, status: 'loading' | 'done' | 'error',
 *            result, error }
 *
 *   const { turns, isSending, send, retry, reset } = useAssistantChat()
 *   const ok = await send({ problem: 'Ceiling fan ghure na', area: 'Gulshan' })
 *
 * Follow-ups: every send() also passes the last few finished turns as
 * `history`, so "ar kom khoroch e kora jay?" is understood in context.
 * reset() ("New chat") clears the thread and with it the memory.
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
    async (id, problem, area, history) => {
      try {
        const result = await analyzeProblem(
          history.length > 0 ? { problem, area, history } : { problem, area }
        )
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
      const history = buildHistory(turnsRef.current)
      const id = nextId.current++
      commit((current) => [
        ...current,
        { id, problem, area: area || null, status: 'loading', result: null, error: null },
      ])
      return run(id, problem, area, history)
    },
    [commit, run]
  )

  const retry = useCallback(
    async (id) => {
      const turn = turnsRef.current.find((t) => t.id === id)
      if (!turn || turnsRef.current.some((t) => t.status === 'loading')) return false
      // Only what came BEFORE this question counts as its context.
      const history = buildHistory(turnsRef.current, id)
      patch(id, { status: 'loading', error: null })
      return run(id, turn.problem, turn.area, history)
    },
    [patch, run]
  )

  const reset = useCallback(() => {
    if (turnsRef.current.some((t) => t.status === 'loading')) return
    commit(() => [])
  }, [commit])

  return { turns, isSending, send, retry, reset }
}

export default useAssistantChat
