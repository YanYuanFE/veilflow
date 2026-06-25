import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Redaction } from "@/components/ui/redaction"
import { Kicker, Rule, Folio, Seal, Highlight } from "@/components/editorial"
import { cn } from "@/lib/utils"

const STACK = ["ERC-7984", "TokenOps SDK", "Zama FHE", "Sepolia"]

const INSTRUMENTS = [
  {
    no: "01",
    name: "Airdrop",
    desc: "Signature-authorized claims. Each recipient's amount is encrypted to them and released only on claim.",
    meta: "Claim · EIP-712",
  },
  {
    no: "02",
    name: "Vesting",
    desc: "Linear unlock with cliff and initial release, claimed over time. Any figure is disclosable to a named auditor.",
    meta: "Claim · over time",
  },
  {
    no: "03",
    name: "Disperse",
    desc: "One encrypted batch. Recipients receive directly into their confidential balance — no claim step.",
    meta: "Direct · one-shot",
  },
]

const LEAKS = [
  "Airdrops get farmed and front-run the moment the sizes are visible in the mempool.",
  "Investor positions and cap tables sit exposed on a public explorer, forever.",
  "Payroll, grants, and treasury moves are on display to anyone who cares to look.",
]

const CAPABILITIES = [
  {
    name: "Redaction reveal",
    desc: "Every encrypted figure renders as a classified-document censor bar that lifts only when the holder decrypts it — the FHE action, made legible.",
  },
  {
    name: "Selective disclosure",
    desc: "Grant a named auditor read-only access to a single vesting figure — total, vested, claimable, or settled. Append-only and irreversible; confirmed before it's granted.",
  },
  {
    name: "Standalone claim pages",
    desc: "Each /claim link is its own customer-facing page with a per-distribution theme — light or dark, brand accent, logo, tagline. No app chrome.",
  },
  {
    name: "Lifecycle & reconciliation",
    desc: "A resumable Configure → Deploy → Add recipients → Live flow, with on-chain balance reveal and per-batch totals so a claim never fails under-funded.",
  },
  {
    name: "Admin controls",
    desc: "Pause or resume an airdrop, extend the claim window, or withdraw what's left unclaimed — from the same console.",
  },
  {
    name: "My claims",
    desc: "Recipients reverse-look-up every allocation addressed to their wallet; issuers copy a link or QR code to share one.",
  },
]

const TIERS: { no: string; layer: string; holds: string; guarantee: ReactNode; seal?: boolean }[] = [
  {
    no: "01",
    layer: "On-chain",
    holds: "SDK contracts, encrypted balances, claim authorization.",
    guarantee: "Funds can't be moved without the contract; every claim is verified there.",
  },
  {
    no: "02",
    layer: "Backend",
    holds: "Metadata, slug, status, theme, ciphertext artifacts, addresses.",
    guarantee: (
      <>
        <Highlight>Never a plaintext amount</Highlight> — and it can't forge a claim.
      </>
    ),
    seal: true,
  },
  {
    no: "03",
    layer: "Client only",
    holds: "Plaintext amounts — encrypted on the spot — and your own decrypted view.",
    guarantee: "Plaintext never leaves the browser. The convenience layer can't read it.",
  },
]

const CONTRACTS = [
  { name: "Airdrop factory", addr: "0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c" },
  { name: "Disperse singleton", addr: "0x710dD9885Cc9986EfD234E7719483147a6d8DBb4" },
  { name: "Wrappers registry", addr: "0x2f0750Bbb0A246059d80e94c454586a7F27a128e" },
  { name: "cUSDT · confidential", addr: "0x4E7B06D78965594eB5EF5414c357ca21E1554491" },
]

export function Home() {
  return (
    <div className="space-y-28 pb-12 sm:space-y-36">
      {/* Cover */}
      <section className="relative pt-2 sm:pt-6">
        <div
          aria-hidden
          className="veil-glow pointer-events-none absolute -top-24 right-[-4rem] hidden h-[480px] w-[560px] opacity-70 lg:block"
        />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16">
          <div className="max-w-2xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                <Kicker className="tracking-[0.16em]">Confidential distribution · TokenOps × Zama</Kicker>
              </span>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="font-display mt-7 text-[clamp(3rem,7.6vw,5.5rem)] leading-[0.94] tracking-[-0.015em] text-foreground">
                Distribute tokens
                <br />
                in <Highlight animate delay={1000}>confidence</Highlight>.
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <p className="font-sans mt-7 max-w-[52ch] text-xl leading-relaxed text-muted-foreground">
                VeilFlow turns any ERC-20 into a confidential ERC-7984 token and distributes it — airdrops, vesting,
                direct payouts — with every amount encrypted end-to-end. The figures are sealed on-chain; the plaintext
                never leaves your browser.
              </p>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
                <Button size="lg" asChild>
                  <Link to="/create">Create a distribution</Link>
                </Button>
                <Button variant="link" asChild>
                  <Link to="/dashboard">Open the console →</Link>
                </Button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={340}>
            <Specimen />
          </Reveal>
        </div>

        <Reveal delay={440}>
          <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-border pt-6">
            <Kicker>Built on</Kicker>
            {STACK.map((s) => (
              <Kicker key={s} className="tracking-[0.18em] text-foreground/70">
                {s}
              </Kicker>
            ))}
          </div>
        </Reveal>
      </section>

      {/* What it is — the three parties, in prose */}
      <section className="grid gap-x-12 gap-y-7 lg:grid-cols-[0.3fr_0.7fr]">
        <Reveal>
          <Kicker>What it is</Kicker>
        </Reveal>
        <div className="max-w-[60ch] space-y-6">
          <Reveal>
            <p className="font-sans text-[clamp(1.375rem,2.4vw,1.75rem)] leading-snug text-foreground">
              A single console for any shape of confidential distribution. An issuer connects a wallet, picks an
              instrument, and points it at a confidential token — while the amounts stay sealed on-chain.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-base leading-relaxed text-muted-foreground">
              Recipients open a branded claim page and see only their own figure, decrypted with their own wallet. And
              an issuer can grant a named auditor read-only access to a single figure — for compliance — without
              exposing anything else.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Why confidential — what a public chain leaks */}
      <section className="grid gap-x-12 gap-y-10 lg:grid-cols-[0.3fr_0.7fr]">
        <Reveal>
          <Kicker>Why confidential</Kicker>
        </Reveal>
        <div className="space-y-8">
          <Reveal>
            <p className="font-sans max-w-[34ch] text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.12] text-foreground">
              Public chains leak amounts. <Highlight>Privacy is the default</Highlight> a treasury actually needs.
            </p>
          </Reveal>
          <ol>
            {LEAKS.map((leak, i) => (
              <li key={i}>
                {i > 0 && <Rule />}
                <Reveal delay={i * 80}>
                  <div className="flex items-baseline gap-5 py-4">
                    <Folio className="text-sm">0{i + 1}</Folio>
                    <p className="max-w-[54ch] text-base text-muted-foreground">{leak}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
          <Reveal>
            <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
              VeilFlow encrypts each amount in the browser with Zama's FHE and ERC-7984 confidential tokens. The backend
              only ever handles ciphertext artifacts, addresses, and signatures.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Instruments — a prospectus contents page, not a card grid */}
      <section>
        <Reveal>
          <Kicker>Three instruments, one console</Kicker>
        </Reveal>
        <ul className="mt-8">
          {INSTRUMENTS.map((it, i) => (
            <li key={it.no}>
              {i > 0 && <Rule />}
              <Reveal delay={i * 90}>
                <Link
                  to="/create"
                  className="group grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-1 py-7 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-10"
                >
                  <Folio className="text-base">№ {it.no}</Folio>
                  <div className="max-w-[58ch]">
                    <h3 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
                      {it.name}
                      <span className="ml-2.5 inline-block text-muted-foreground opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-1.5 group-hover:opacity-100">
                        →
                      </span>
                    </h3>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{it.desc}</p>
                  </div>
                  <span className="col-start-2 sm:col-start-3 sm:self-center">
                    <Kicker className="tracking-[0.16em]">{it.meta}</Kicker>
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* What's in the console — capabilities as a definition list */}
      <section>
        <Reveal>
          <Kicker>What's in the console</Kicker>
        </Reveal>
        <dl className="mt-8">
          {CAPABILITIES.map((c, i) => (
            <div key={c.name}>
              {i > 0 && <Rule />}
              <Reveal delay={i * 60}>
                <div className="grid gap-x-10 gap-y-1.5 py-5 sm:grid-cols-[14rem_1fr]">
                  <dt className="font-sans text-base font-medium text-foreground">{c.name}</dt>
                  <dd className="max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{c.desc}</dd>
                </div>
              </Reveal>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works — the trust boundary as a ruled ledger */}
      <section className="space-y-10">
        <Reveal>
          <div className="max-w-[58ch] space-y-4">
            <Kicker>How it works · the trust boundary</Kicker>
            <p className="font-sans text-[clamp(1.375rem,2.4vw,1.75rem)] leading-snug text-foreground">
              Three layers hold three different things. Only one ever touches a plaintext amount — and it's the one you
              control.
            </p>
          </div>
        </Reveal>
        <div>
          {TIERS.map((t, i) => (
            <div key={t.layer}>
              {i > 0 && <Rule />}
              <Reveal delay={i * 90}>
                <div className="grid gap-x-10 gap-y-4 py-7 sm:grid-cols-[11rem_1fr] lg:grid-cols-[11rem_1fr_1fr]">
                  <div className="flex items-center gap-3">
                    <Folio className="text-sm">№ {t.no}</Folio>
                    <h3 className="font-display text-xl text-foreground">{t.layer}</h3>
                  </div>
                  <div className="space-y-1.5">
                    <Kicker className="tracking-[0.12em]">Holds</Kicker>
                    <p className="max-w-[44ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{t.holds}</p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="flex items-center gap-2.5">
                      <Kicker className="tracking-[0.12em]">Guarantee</Kicker>
                      {t.seal && <Seal tone="live">Red line</Seal>}
                    </span>
                    <p className="max-w-[44ch] text-[0.9375rem] leading-relaxed text-foreground">{t.guarantee}</p>
                  </div>
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* The privacy red line, stated plainly */}
      <section className="space-y-7">
        <Reveal>
          <Kicker>The red line</Kicker>
        </Reveal>
        <Reveal delay={100}>
          <blockquote className="max-w-[56rem]">
            <p className="font-display text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.08] text-foreground">
              Encryption happens in your browser. The backend never sees a plaintext amount —{" "}
              <Highlight>only ciphertext</Highlight>, addresses, and signatures.
            </p>
            <footer className="mt-7">
              <Kicker>Worst case: brand defaced · never your figures · never your funds</Kicker>
            </footer>
          </blockquote>
        </Reveal>
      </section>

      {/* Colophon — stack, live contracts, the bounty it's built for */}
      <section className="space-y-9 border-t border-border pt-12">
        <Reveal>
          <Kicker>Colophon</Kicker>
        </Reveal>
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-3">
          <Reveal>
            <div className="space-y-4">
              <Kicker className="tracking-[0.12em]">Built with</Kicker>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>React 19 · Vite · Tailwind v4 · shadcn/ui</li>
                <li>wagmi · viem · RainbowKit · Zama react-sdk</li>
                <li>@tokenops/sdk — airdrop · vesting · disperse</li>
                <li>Vercel functions · Neon Postgres · Drizzle ORM</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="space-y-4">
              <Kicker className="tracking-[0.12em]">Live on Sepolia</Kicker>
              <dl className="space-y-3">
                {CONTRACTS.map((c) => (
                  <div key={c.name} className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground">{c.name}</dt>
                    <dd className="font-mono text-[0.6875rem] leading-snug text-foreground/80 break-all">{c.addr}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
          <Reveal delay={180}>
            <div className="space-y-4">
              <Kicker className="tracking-[0.12em]">Built for</Kicker>
              <p className="font-sans max-w-[30ch] text-lg leading-snug text-foreground">
                Zama Developer Program — Mainnet Season 3 · TokenOps Special Bounty
              </p>
              <p className="max-w-[40ch] text-sm leading-relaxed text-muted-foreground">
                Distribution contracts and FHE primitives are provided by the TokenOps SDK and Zama. VeilFlow is the
                unified experience layer on top.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Closing call */}
      <Reveal>
        <section className="relative overflow-hidden rounded-md border border-border bg-card px-8 py-16 text-center sm:py-20">
          <div
            aria-hidden
            className="veil-glow pointer-events-none absolute -bottom-32 left-1/2 h-[360px] w-[620px] -translate-x-1/2 opacity-70"
          />
          <div className="relative">
            <Kicker>Mainnet Season 3</Kicker>
            <h2 className="font-display mx-auto mt-4 max-w-[18ch] text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.04] text-foreground">
              Issue your first <Highlight>confidential</Highlight> distribution
            </h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <Button size="lg" asChild>
                <Link to="/create">Create a distribution</Link>
              </Button>
              <Button variant="link" asChild>
                <Link to="/wrap">Wrap a token first →</Link>
              </Button>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  )
}

/** Fades + lifts its children into view — immediately for above-the-fold,
 *  on-scroll for the rest. Honors prefers-reduced-motion via CSS. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={cn("reveal", shown && "is-in", className)} style={shown ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  )
}

/** Live specimen of a confidential statement — figures start sealed and lift on decrypt. */
function Specimen() {
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const decrypt = () => {
    clearTimeout(timer.current)
    setRevealed(false)
    setLoading(true)
    timer.current = setTimeout(() => {
      setLoading(false)
      setRevealed(true)
    }, 650)
  }
  const reseal = () => {
    clearTimeout(timer.current)
    setLoading(false)
    setRevealed(false)
  }

  // Auto-reveal once after the entrance settles, then hand control to the reader.
  useEffect(() => {
    const t1 = setTimeout(() => setLoading(true), 1450)
    const t2 = setTimeout(() => {
      setLoading(false)
      setRevealed(true)
    }, 2100)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(timer.current)
    }
  }, [])

  return (
    <figure className="relative rounded-md border border-border bg-card shadow-[0_1px_0_0_var(--border),0_24px_48px_-32px_color-mix(in_oklch,var(--foreground)_40%,transparent)]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <Kicker>Specimen · confidential statement</Kicker>
        <Seal tone="live">Live</Seal>
      </div>

      <dl className="divide-y divide-border px-5 text-sm">
        <Row label="Instrument">
          <span className="text-foreground">Series A — Vesting</span>
        </Row>
        <Row label="Token">
          <span className="text-foreground">cUSDT · ERC-7984</span>
        </Row>
        <Row label="Recipient">
          <span className="font-mono text-[0.8125rem] text-foreground">0x1f4c…a93b</span>
        </Row>
        <Row label="Allocation">
          <Redaction revealed={revealed} loading={loading} chars={11} align="end" className="font-mono text-foreground">
            12,500.00 cUSDT
          </Redaction>
        </Row>
        <Row label="Claimable now">
          <Redaction revealed={revealed} loading={loading} chars={11} align="end" className="font-mono text-foreground">
            3,125.00 cUSDT
          </Redaction>
        </Row>
      </dl>

      <figcaption className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
        <span className="text-xs text-muted-foreground">
          {revealed ? "Decrypted for this holder only" : "Sealed — only the holder can lift the veil"}
        </span>
        {revealed ? (
          <Button size="sm" variant="outline" onClick={reseal}>
            Re-seal
          </Button>
        ) : (
          <Button size="sm" onClick={decrypt} disabled={loading}>
            {loading ? "Decrypting…" : "Decrypt figures"}
          </Button>
        )}
      </figcaption>
    </figure>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt>
        <Kicker className="tracking-[0.12em]">{label}</Kicker>
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
