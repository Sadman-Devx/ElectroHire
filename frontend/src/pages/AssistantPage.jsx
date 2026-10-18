import { useEffect, useRef, useState } from 'react'

import { AssistantEmptyState } from '@/components/assistant/AssistantEmptyState'
import { AssistantMessage, UserBubble } from '@/components/assistant/ChatMessages'
import { ChatComposer } from '@/components/assistant/ChatComposer'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { UserNavbar } from '@/components/dashboard/UserNavbar'
import { useAuth } from '@/context/useAuth'
import { useAssistantChat } from '@/hooks/useAssistantChat'

/**
 * Hackathon Phase 3: AI Assistant chat page (route /assistant,
 * protected — see App.jsx).
 *
 * The customer describes a problem (Bangla or English) and optionally
 * their area. The backend (POST /api/assistant/analyze/) replies with
 * category, urgency, safety tips, a rough BDT cost range and matching
 * providers; this page shows that as a chat: the question on the right,
 * the assistant's answer on the left, newest at the bottom.
 *
 * Role-aware navbar, same pattern as BookProviderPage / ChatsPage.
 * All AI text is rendered as plain text (never HTML) — see
 * AnalysisCard.jsx.
 */
function AssistantPage() {
  const { user } = useAuth()
  const { turns, isSending, send, retry } = useAssistantChat()
  const [text, setText] = useState('')
  const [area, setArea] = useState('')
  const endRef = useRef(null)

  const NavbarComponent = user?.role === 'provider' ? DashboardNavbar : UserNavbar

  // Keep the newest message in view as the conversation grows.
  const lastStatus = turns.length ? turns[turns.length - 1].status : null
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [turns.length, lastStatus])

  function handleSubmit({ problem, area: submittedArea }) {
    setText('')
    send({ problem, area: submittedArea })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <NavbarComponent />

      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 sm:px-6">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">AI Assistant</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Describe a problem at home and get safety tips, a cost estimate and the right
              provider.
            </p>
          </div>

          {turns.length === 0 ? (
            <AssistantEmptyState onPickExample={setText} />
          ) : (
            <div className="flex flex-1 flex-col gap-5 pb-6" aria-live="polite">
              {turns.map((turn) => (
                <div key={turn.id} className="flex flex-col gap-4">
                  <UserBubble problem={turn.problem} area={turn.area} />
                  <AssistantMessage turn={turn} onRetry={retry} />
                </div>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="sticky bottom-0 z-30 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
          <ChatComposer
            text={text}
            onTextChange={setText}
            area={area}
            onAreaChange={setArea}
            onSubmit={handleSubmit}
            isSending={isSending}
          />
        </div>
      </main>
    </div>
  )
}

export default AssistantPage
