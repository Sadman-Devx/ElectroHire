import { Sparkles } from 'lucide-react'

const EXAMPLES = [
  'Ceiling fan ghure na',
  'Switchboard theke spark hocche',
  'Bathroom er tap theke pani porche',
  'সিলিং ফ্যান ঘুরছে না',
]

/** First-visit screen: what the assistant does + tap-to-fill examples. */
function AssistantEmptyState({ onPickExample }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
        <Sparkles className="h-7 w-7" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-lg font-bold text-[var(--color-text)]">Tell me what&apos;s wrong</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-text-muted)]">
          Describe your problem in Bangla or English. I&apos;ll tell you how urgent it is, give safety
          tips and a rough cost, and find providers near you.
        </p>
      </div>
      <div className="flex max-w-lg flex-wrap justify-center gap-2" aria-label="Examples">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onPickExample(example)}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-tint)]"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  )
}

export { AssistantEmptyState }
