import { type ReactNode } from "react"
import { Kicker, Rule } from "@/components/editorial"

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "confidentiality", label: "How confidentiality works" },
  { id: "instruments", label: "The three instruments" },
  { id: "issue", label: "Issuing a distribution" },
  { id: "claim", label: "Claiming" },
  { id: "vesting-actions", label: "Managing a vesting" },
  { id: "disclosure", label: "Selective disclosure" },
  { id: "admin", label: "Admin controls" },
  { id: "branding", label: "Branded claim pages" },
  { id: "wrap", label: "Wrapping tokens" },
  { id: "architecture", label: "Architecture" },
  { id: "contracts", label: "Network & contracts" },
]

const CONTRACTS = [
  { name: "Airdrop factory", addr: "0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c" },
  { name: "Disperse singleton", addr: "0x710dD9885Cc9986EfD234E7719483147a6d8DBb4" },
  { name: "Wrappers registry", addr: "0x2f0750Bbb0A246059d80e94c454586a7F27a128e" },
  { name: "cUSDT · confidential", addr: "0x4E7B06D78965594eB5EF5414c357ca21E1554491" },
]

export function Docs() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="max-w-[60ch] space-y-4">
        <Kicker>Documentation</Kicker>
        <h1 className="font-display text-[clamp(2.5rem,5vw,3.5rem)] leading-tight text-foreground">
          How VeilFlow works
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          VeilFlow distributes confidential ERC-7984 tokens — airdrops, vesting, and direct transfers — with every
          amount encrypted end-to-end. This is a working guide to the model and the flows, written against the actual
          implementation.
        </p>
      </header>

      <Rule className="my-10" />

      <div className="grid gap-12 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="lg:sticky lg:top-8 lg:self-start">
          <Kicker className="block">On this page</Kicker>
          <ul className="mt-4 space-y-2 border-l border-border">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="-ml-px block border-l border-transparent py-0.5 pl-3 text-sm text-muted-foreground transition-colors hover:border-seal hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-16">
          <Section id="overview" title="Overview">
            <P>
              An issuer connects a wallet, picks an instrument, points it at a confidential token, and distributes it.
              Recipients open a branded claim page and see only their own figure, which they decrypt with their own
              wallet. An issuer can additionally grant a named auditor read-only access to a single figure for
              compliance — without exposing anyone else's.
            </P>
            <P>
              The amounts are never public, and the plaintext never leaves the issuer's browser. The backend only ever
              stores ciphertext artifacts, addresses, and signatures.
            </P>
          </Section>

          <Section id="confidentiality" title="How confidentiality works">
            <P>
              Amounts are encrypted in the browser using Zama's FHE relayer before they ever touch the network, and
              held on-chain as encrypted handles on{" "}
              <Code>ERC-7984</Code> confidential tokens. Reading a figure requires a wallet signature: the holder asks
              the relayer to re-encrypt the handle to their key (<Code>userDecrypt</Code>), and only then is the
              plaintext visible — in their browser alone.
            </P>
            <P>Three layers hold three different things:</P>
            <Tier
              layer="On-chain"
              holds="Distribution contracts, encrypted balances, claim authorization."
              guarantee="Funds can't move without the contract; every claim is verified there."
            />
            <Tier
              layer="Backend"
              holds="Metadata, slug, status, theme, ciphertext artifacts, addresses, disclosure records."
              guarantee="Never a plaintext amount; it cannot forge a claim."
              seal
            />
            <Tier
              layer="Client only"
              holds="Plaintext amounts (encrypted on the spot) and the holder's decrypted view."
              guarantee="Plaintext never leaves the browser."
            />
          </Section>

          <Section id="instruments" title="The three instruments">
            <Term name="Airdrop">
              Signature-authorized claims. Each recipient's amount is encrypted to them and released only when they
              claim with an issuer-signed authorization (EIP-712). A claim consumes its signature on-chain, so it is
              single-use.
            </Term>
            <Term name="Vesting">
              A per-token vesting manager with linear unlock — cliff, initial unlock, and a release interval. Recipients
              are added in batches; each grant pulls its amount from the issuer's confidential balance. Recipients claim
              the vested portion over time and return as more unlocks.
            </Term>
            <Term name="Disperse">
              One encrypted batch sent directly into each recipient's confidential balance. There is no claim step — the
              tokens simply arrive, and recipients read them on the token page.
            </Term>
          </Section>

          <Section id="issue" title="Issuing a distribution">
            <P>
              Creating a distribution is a resumable, multi-step flow tracked by a lifecycle stepper, so you can leave
              and return to a draft without losing place:
            </P>
            <Steps
              steps={[
                ["Configure", "Name it, choose the instrument, pick the confidential token and the schedule (claim window, or vesting cliff / interval / initial unlock)."],
                ["Deploy & fund", "Deploy the contract on-chain. Airdrops approve the factory as operator, then deploy and fund the pool in one flow; vesting deploys a manager that pulls from your balance per grant."],
                ["Add recipients", "Paste or upload address + amount rows. Amounts are encrypted client-side; a preview reconciles the batch total against the funded balance so a claim never fails under-funded. Vesting recipients are created in batches sized to the manager's limit."],
                ["Go live", "Flip the distribution live and share the claim link."],
              ]}
            />
          </Section>

          <Section id="claim" title="Claiming">
            <P>
              Each distribution has a standalone, customer-facing claim page at <Code>/claim/:slug</Code>. A recipient
              connects the wallet that was allocated tokens. Their figure renders as a redaction bar — a classified
              censor strip that lifts only when they decrypt it. The reveal is the FHE <Code>userDecrypt</Code> made
              visible.
            </P>
            <P>
              <strong className="font-medium text-foreground">Airdrop</strong> claims are single-use; the page reads the
              claimed state straight from the contract (the consumed signature), so a reload reflects reality.{" "}
              <strong className="font-medium text-foreground">Vesting</strong> claims are continuous — amounts are
              confidential, so there is no plaintext "claimed" flag; the honest signal is the claimable amount itself,
              which decrypts to zero once the vested-so-far portion is claimed.
            </P>
          </Section>

          <Section id="vesting-actions" title="Managing a vesting">
            <P>
              Beyond claiming, a vesting holder gets a set of advanced actions from the <em>Manage</em> dialog on their
              claim page. Every amount stays encrypted — these operate on the on-chain handles, never plaintext.
            </P>
            <Term name="Partial claim">
              Claim a specific amount of what's currently vested rather than the whole vested-so-far portion — useful
              when you only want to draw down part of it.
            </Term>
            <Term name="Split off a portion">
              Move a fraction (e.g. 1/3) of a vesting to another address as a new, independent vesting with the same
              schedule. The manager must have splitting enabled when it was deployed.
            </Term>
            <Term name="Transfer ownership">
              Hand the entire vesting to another address — two-step (initiate, then the new recipient accepts within a
              window) or direct and immediate. The receiver accepts a pending transfer by pasting the vesting id the
              sender shares with them.
            </Term>
            <Term name="Disclose a figure">
              Grant a named party — auditor, lender, accountant — read-only access to one of your figures (total,
              vested, claimable, or settled) via an encrypted view key. The grant is append-only on the ACL, so it is
              irreversible.
            </Term>
          </Section>

          <Section id="disclosure" title="Selective disclosure">
            <P>
              For compliance, an issuer can grant a named auditor read-only access to a single vesting figure — total,
              vested, claimable, or settled. The grant is append-only on the ACL and therefore irreversible, so it is
              confirmed before it is made. Auditors reverse-look-up what was disclosed to them on the Audit page and
              decrypt only those specific figures.
            </P>
          </Section>

          <Section id="admin" title="Admin controls">
            <P>From the distribution console, an airdrop issuer can:</P>
            <List
              items={[
                "Pause or resume claims.",
                "Extend the claim window (when the distribution was created as extendable).",
                "Withdraw whatever remains unclaimed after the window.",
              ]}
            />
          </Section>

          <Section id="branding" title="Branded claim pages">
            <P>
              The claim page is skinnable per distribution. From the Overview, open <em>Customize</em> to set a theme:
              light or dark mode, a brand accent color, a logo, and a tagline. The page applies it live — including the
              wallet-connect button, which picks up the configured accent. No app chrome; it is the recipient's whole
              view.
            </P>
          </Section>

          <Section id="wrap" title="Wrapping tokens">
            <P>
              Confidential distributions move ERC-7984 tokens. To get them, wrap a standard ERC-20 into its confidential
              counterpart on the Wrap page; unwrap reverses it. Balances of the confidential token are themselves
              encrypted and revealed with the same decrypt step used everywhere else.
            </P>
          </Section>

          <Section id="architecture" title="Architecture">
            <P>
              The frontend is a React + Vite single-page app using wagmi/viem, RainbowKit, and the Zama FHE react SDK;
              distribution logic comes from the TokenOps SDK. The backend is a set of serverless <Code>/api</Code>{" "}
              functions backed by Neon Postgres via Drizzle ORM — front and back ship as one deploy.
            </P>
            <P>
              The encryption boundary is the point: every amount is encrypted in the browser, so the backend only ever
              receives ciphertext handles, input proofs, signatures, and addresses. Worst case if the convenience layer
              is breached: a defaced brand — never your figures, never your funds.
            </P>
          </Section>

          <Section id="contracts" title="Network & contracts">
            <P>
              VeilFlow runs on <strong className="font-medium text-foreground">Sepolia</strong>. Confidential tokens use
              6 decimals (the Zama convention); the vesting factory is resolved by chain id through the SDK.
            </P>
            <dl className="mt-2 divide-y divide-border">
              {CONTRACTS.map((c) => (
                <div key={c.addr} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <dt className="text-sm text-foreground">{c.name}</dt>
                  <dd className="font-mono text-xs break-all text-muted-foreground">{c.addr}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 space-y-4">
      <h2 className="font-display text-2xl tracking-tight text-foreground sm:text-[1.75rem]">{title}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="max-w-[68ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{children}</p>
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
  )
}

function Term({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6">
      <div className="font-display text-lg leading-snug text-foreground">{name}</div>
      <p className="max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  )
}

function Tier({ layer, holds, guarantee, seal }: { layer: string; holds: string; guarantee: string; seal?: boolean }) {
  return (
    <div className="grid gap-1 border-t border-border py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6">
      <div className="flex items-center gap-2">
        {seal && <span className="size-1.5 rounded-full bg-seal" aria-hidden />}
        <span className="font-display text-lg text-foreground">{layer}</span>
      </div>
      <div className="max-w-[60ch] space-y-1 text-[0.9375rem] leading-relaxed">
        <p className="text-muted-foreground">{holds}</p>
        <p className="text-foreground">{guarantee}</p>
      </div>
    </div>
  )
}

function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <ol className="space-y-0">
      {steps.map(([title, body], i) => (
        <li key={title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 border-t border-border py-4">
          <span className="font-mono text-sm tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
          <div className="max-w-[62ch] space-y-1">
            <div className="font-medium text-foreground">{title}</div>
            <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="max-w-[64ch] space-y-1.5">
      {items.map((it) => (
        <li key={it} className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}
