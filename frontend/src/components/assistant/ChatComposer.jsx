import { useState } from 'react'
import { MapPin, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  MAX_AREA_LENGTH,
  MAX_PROBLEM_LENGTH,
  MIN_PROBLEM_LENGTH,
} from '@/lib/assistantText'

/**
 * Message box at the bottom of the chat. Enter sends, Shift+Enter adds
 * a new line. The text/area are owned by the page (so the empty-state
 * example chips can fill the box); this component only validates and
 * reports a submit.
 */
function ChatComposer({ text, onTextChange, area, onAreaChange, onSubmit, isSending }) {
  const [validationError, setValidationError] = useState('')

  function submit() {
    if (isSending) return
    const trimmed = text.trim()
    if (trimmed.length < MIN_PROBLEM_LENGTH) {
      setValidationError(
        `Please describe your problem in at least ${MIN_PROBLEM_LENGTH} characters.`
      )
      return
    }
    setValidationError('')
    onSubmit({ problem: trimmed, area: area.trim() })
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  function handleChange(event) {
    if (validationError) setValidationError('')
    onTextChange(event.target.value)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <MapPin
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]"
            aria-hidden="true"
          />
          <Input
            aria-label="Your area (optional)"
            placeholder="Your area (optional), e.g. Gulshan"
            value={area}
            maxLength={MAX_AREA_LENGTH}
            onChange={(event) => onAreaChange(event.target.value)}
            className="h-10 pl-9 text-sm"
          />
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Describe your problem"
            aria-describedby={validationError ? 'assistant-composer-error' : undefined}
            invalid={Boolean(validationError)}
            rows={2}
            placeholder="Describe your problem, e.g. Ceiling fan ghure na"
            value={text}
            maxLength={MAX_PROBLEM_LENGTH}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />
          <Button
            type="button"
            size="lg"
            className="h-[4.25rem] flex-shrink-0"
            onClick={submit}
            disabled={isSending}
            aria-label="Send"
          >
            {isSending ? <Spinner /> : <Send className="h-5 w-5" aria-hidden="true" />}
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <p
            id="assistant-composer-error"
            role={validationError ? 'alert' : undefined}
            className="text-xs font-medium text-[var(--color-danger)]"
          >
            {validationError}
          </p>
          <p className="flex-shrink-0 text-xs text-[var(--color-text-subtle)]">
            {text.length}/{MAX_PROBLEM_LENGTH}
          </p>
        </div>
        <p className="text-center text-[11px] text-[var(--color-text-subtle)]">
          AI suggestions are general guidance, not professional advice.
        </p>
      </div>
    </div>
  )
}

export { ChatComposer }
