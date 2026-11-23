import { Send, Trash2 } from 'lucide-react'

import { formatDuration, MAX_VOICE_SECONDS } from '@/lib/chatAttachments'

/**
 * Replaces the message box while a voice note is being recorded:
 * a pulsing red dot, the running time, a trash button (throw away) and
 * a send button (finish and send). The recording also stops and sends
 * by itself at MAX_VOICE_SECONDS.
 */
function VoiceRecorderBar({ elapsedSeconds, onCancel, onFinish }) {
  return (
    <div className="flex items-center gap-3 p-3" role="status" aria-live="polite">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel recording"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-tint)]"
      >
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-[var(--color-bg)] px-4 py-2.5">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-danger)] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-danger)]" />
        </span>
        <span className="text-sm font-semibold tabular-nums text-[var(--color-text)]">
          {formatDuration(elapsedSeconds)}
        </span>
        <span className="truncate text-xs text-[var(--color-text-subtle)]">
          Recording… (max {formatDuration(MAX_VOICE_SECONDS)})
        </span>
      </div>

      <button
        type="button"
        onClick={onFinish}
        aria-label="Finish recording and send"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-md shadow-orange-500/20 transition-colors hover:bg-[var(--color-primary-hover)]"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export { VoiceRecorderBar }