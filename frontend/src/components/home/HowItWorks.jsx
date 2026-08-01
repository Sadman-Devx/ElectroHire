import { CalendarCheck, MessageCircle, Search } from 'lucide-react'

const STEPS = [
  {
    icon: Search,
    title: 'Search',
    description: 'Pick a category and enter your area to see providers who serve you.',
  },
  {
    icon: MessageCircle,
    title: 'Connect',
    description: 'View a provider\u2019s profile and reach out directly to discuss the job.',
  },
  {
    icon: CalendarCheck,
    title: 'Get it Done',
    description: 'Agree on a time, get the work done, and leave a rating for others.',
  },
]

/**
 * How it Works — 3 static steps, per Day 4 spec. No API dependency.
 */
function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[var(--color-bg)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
            How it Works
          </h2>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Three simple steps from search to service.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="relative rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center"
            >
              <span className="absolute right-4 top-4 text-3xl font-extrabold text-[var(--color-bg)]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
                <step.icon className="h-7 w-7" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-[var(--color-text)]">{step.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export { HowItWorks }