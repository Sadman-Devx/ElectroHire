import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { UserNavbar } from '@/components/dashboard/UserNavbar'
import { Footer } from '@/components/home/Footer'
import { Navbar } from '@/components/home/Navbar'
import { useAuth } from '@/context/useAuth'

/**
 * Day 10, Dev 1: real Terms & Conditions Page.
 *
 * Replaces TermsPlaceholder.jsx (the Day 9 forward-declared stub that
 * only said "coming soon" so the Account Page's Terms link and the
 * /terms route weren't dead ends in the meantime). App Build doc,
 * Phase 2's Final Updated MVP List names this feature #12 exactly as
 * built here: "Terms & Conditions page (disclaimer text)" — plain
 * static legal copy, no form, no API call.
 *
 * Route stays /terms (public — see App.jsx's existing comment: "no
 * reason to gate legal text behind login"). Linked from AccountPage
 * (existing) and now from the site Footer too (Day 10, Dev 1 — the
 * page existing but only reachable from one logged-in-only screen
 * would leave an anonymous visitor with no way to find it at all).
 *
 * Navbar picked by auth state, then by role — this first shipped
 * using the public Navbar unconditionally, which reintroduced a bug
 * Day 9 had already found and fixed on AccountPage/UserDashboardPage/
 * ChatsPage (see UserNavbar.jsx's docstring): the public Navbar's
 * "Categories" / "How it Works" links are '#anchor' hashes that only
 * resolve on HomePage's own sections, so they're dead links dressed
 * up as navigation on every other route — and the same Navbar's
 * AuthActions block *also* renders a full Dashboard/Messages/Account/
 * Log out cluster whenever someone is logged in, on top of those dead
 * marketing links, which is exactly the "extra nav" a logged-in
 * visitor would see here that they wouldn't on their own dashboard.
 * An anonymous visitor still gets the real public Navbar (with working
 * Login/Signup actions) — only a logged-in visitor gets bounced to the
 * role-appropriate one, same three-way logic AccountPage.jsx already
 * uses.
 *
 * Content reflects decisions actually made elsewhere in this project
 * rather than generic boilerplate, since a marketplace that connects
 * users directly with (Day 1, Dev 1) "electric engineer" and other
 * home-service providers — and deliberately stays out of the
 * transaction itself (App Build doc: "কথা বলবে, কাজ ঠিক করবে (App-এর
 * বাইরে বাস্তবে service হবে)") — carries real disclaimer obligations
 * around service quality, provider verification, and safety that a
 * template T&C wouldn't cover:
 *   - Provider Verification is explicitly "lightweight — admin
 *     manual" (App Build doc, feature #9) — not a licensing or
 *     background check, and this page says so plainly rather than
 *     implying more assurance than the actual admin-approve flow
 *     (providers/admin.py) provides.
 *   - The platform's own role per the App Build doc's user flow is
 *     discovery + first contact only; the actual service happens
 *     off-platform, so ElectroHire cannot warrant its outcome,
 *     pricing, or safety.
 *   - Ratings (ratings/models.py) are restricted to users with a real
 *     ContactLog — this page explains that restriction to set the
 *     right expectation about why review eligibility is gated.
 *   - Reporting (reports/models.py) is bidirectional per the App
 *     Build doc's edge-case decision ("Report Feature Bidirectional")
 *     — the Prohibited Conduct section reflects that both roles are
 *     equally accountable.
 */
function TermsPage() {
  const lastUpdated = 'August 2026'
  const { isAuthenticated, user } = useAuth()

  const NavbarComponent = !isAuthenticated
    ? Navbar
    : user?.role === 'provider'
      ? DashboardNavbar
      : UserNavbar

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <NavbarComponent />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
              Terms &amp; Conditions
            </h1>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Last updated: {lastUpdated}
            </p>
            <p className="mt-4 text-base leading-relaxed text-[var(--color-text-muted)]">
              Please read these terms carefully before using ElectroHire. By creating an
              account or using the platform in any way, you agree to be bound by them.
            </p>
          </header>

          <div className="flex flex-col gap-10">
            <Section number="1" title="What ElectroHire is">
              <p>
                ElectroHire is a directory and introduction service. We help people (
                <Term>Users</Term>) find independent home-service providers — electricians,
                plumbers, and similar trades (<Term>Providers</Term>) — and connect with them
                directly through search, chat, and phone number reveal.
              </p>
              <p>
                We are not a party to any agreement made between a User and a Provider. Once a
                conversation moves forward, the actual work — scheduling, pricing, materials,
                and the service itself — happens entirely off-platform, directly between the
                two of you. ElectroHire does not employ Providers, dispatch jobs, or process
                payment for services performed.
              </p>
            </Section>

            <Section number="2" title="Accounts and eligibility">
              <p>
                You must provide accurate name, contact, and (for Providers) profile
                information, and keep your login credentials confidential. You&rsquo;re
                responsible for all activity under your account.
              </p>
              <p>
                A single person may hold both a User account and a separate Provider account,
                but not use one account to act as both — sign up separately for each role.
              </p>
              <p>
                We reserve the right to suspend or remove any account that violates these
                terms, provides false information, or is used to harass, defraud, or spam other
                members.
              </p>
            </Section>

            <Section number="3" title="Provider verification is lightweight">
              <p>
                Before a Provider profile appears in search results, our admin team reviews it
                and marks it &ldquo;active.&rdquo; This review is a manual, good-faith check —
                it is <Emphasis>not</Emphasis> a background check, license verification, or
                certification of skill, insurance, or legal trade qualification.
              </p>
              <p>
                An &ldquo;active&rdquo; or &ldquo;verified&rdquo; badge means the profile was
                reviewed and approved by our team, and nothing more. You are responsible for
                independently confirming a Provider&rsquo;s licensing, qualifications, and
                insurance before hiring them, especially for electrical and other safety-critical
                work.
              </p>
            </Section>

            <Section number="4" title="No warranty on service outcomes">
              <p>
                Because the actual service is performed off-platform by an independent Provider,
                ElectroHire makes no warranty — express or implied — about the quality,
                safety, timeliness, legality, or outcome of any work performed, and is not
                responsible for any property damage, injury, financial loss, or dispute arising
                from a service arrangement made through the platform.
              </p>
              <p>
                Electrical and similar trade work carries real safety risk. Always confirm a
                Provider is licensed for the work you need where your local regulations require
                it, and use your own judgment before granting access to your home or agreeing to
                any job.
              </p>
            </Section>

            <Section number="5" title="Ratings and reviews">
              <p>
                Only Users who have actually contacted a Provider through the platform (a chat
                message or a phone number reveal) are eligible to leave a rating for that
                Provider. This restriction exists so that ratings reflect a real interaction, not
                anonymous or competitor-submitted reviews.
              </p>
              <p>
                Reviews should be honest and based on your own experience. We may remove a
                rating or review that is fraudulent, abusive, or unrelated to an actual service
                interaction.
              </p>
            </Section>

            <Section number="6" title="Reporting and prohibited conduct">
              <p>
                Both Users and Providers can report a profile that is fake, inappropriate,
                harassing, or provides materially wrong information. Reports are reviewed by our
                admin team, who may warn, suspend, or remove either party&rsquo;s account as a
                result.
              </p>
              <p>You agree not to use ElectroHire to:</p>
              <ul className="ml-5 list-disc space-y-1.5">
                <li>Impersonate another person or misrepresent your identity, role, or credentials</li>
                <li>Send spam, unsolicited advertising, or unrelated promotional messages</li>
                <li>Harass, threaten, or abuse another member</li>
                <li>Attempt to scrape, resell, or republish platform data without permission</li>
                <li>Circumvent account suspension by creating a new account</li>
              </ul>
            </Section>

            <Section number="7" title="Changes to these terms">
              <p>
                We may update these terms as the platform evolves. If we make a material change,
                we&rsquo;ll update the &ldquo;last updated&rdquo; date above. Continuing to use
                ElectroHire after a change means you accept the updated terms.
              </p>
            </Section>

            <Section number="8" title="Contact">
              <p>
                Questions about these terms, or want to report something urgent? Reach us at{' '}
                <a
                  href="mailto:support@electrohire.com"
                  className="font-semibold text-[var(--color-secondary)] hover:underline"
                >
                  support@electrohire.com
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function Section({ number, title, children }) {
  return (
    <section aria-labelledby={`terms-section-${number}`}>
      <h2
        id={`terms-section-${number}`}
        className="text-xl font-bold text-[var(--color-text)] sm:text-2xl"
      >
        <span className="mr-2 text-[var(--color-primary)]">{number}.</span>
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-base leading-relaxed text-[var(--color-text-muted)]">
        {children}
      </div>
    </section>
  )
}

function Term({ children }) {
  return <strong className="font-semibold text-[var(--color-text)]">{children}</strong>
}

function Emphasis({ children }) {
  return <span className="font-semibold text-[var(--color-text)]">{children}</span>
}

export default TermsPage