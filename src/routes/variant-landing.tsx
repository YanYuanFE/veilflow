import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Database, Eye, EyeOff, KeyRound, LockKeyhole, MonitorSmartphone, Send, ServerCog, Split, TrendingUp } from "lucide-react"
import { Logomark } from "@/components/logomark"
import { HeroGradient } from "@/components/hero-gradient"
import { HeroSeal } from "@/components/hero-seal"
import "./variant-landing.css"

const NAV_LINKS = [
  { to: "/dashboard", label: "Distributions" },
  { to: "/claims", label: "Claims" },
  { to: "/wrap", label: "Wrap / Unwrap" },
  { to: "/audit", label: "Auditor" },
]

const LEAKS = [
  "Airdrops get farmed and front-run when allocation sizes are public.",
  "Investor positions, grants, and payroll stay readable on explorers forever.",
  "Compliance often needs one figure, not a public table of every recipient.",
]

const TRUST_LAYERS = [
  {
    icon: Database,
    layer: "On-chain",
    holds: "SDK contracts, encrypted balances, claim authorization.",
    guarantee: "Funds stay controlled by contracts; claims are verified there.",
  },
  {
    icon: ServerCog,
    layer: "Backend",
    holds: "Metadata, slugs, theme, ciphertext artifacts, addresses.",
    guarantee: "Never a plaintext amount; it cannot forge a valid claim.",
  },
  {
    icon: MonitorSmartphone,
    layer: "Client only",
    holds: "Plaintext amounts before encryption, and the holder's decrypted view.",
    guarantee: "Plaintext never leaves the browser.",
  },
]

// The three distribution shapes the console supports — the actual product.
// Issuer flow + recipient flow mirrors how the app routes each instrument.
const INSTRUMENTS = [
  {
    id: "airdrop",
    index: "01",
    title: "Airdrop",
    blurb: "Signature-authorized claims. Each amount is encrypted to its recipient; they reveal and claim at a branded page.",
    issuer: "Sign claims",
    recipient: "Reveal + claim at /claim/:slug",
    icon: Send,
  },
  {
    id: "vesting",
    index: "02",
    title: "Vesting",
    blurb: "Linear unlock with cliff and initial release, batch-created in one transaction. Recipients claim the vested portion over time.",
    issuer: "Batch-create vestings",
    recipient: "Claim what's vested so far",
    icon: TrendingUp,
  },
  {
    id: "disperse",
    index: "03",
    title: "Disperse",
    blurb: "One encrypted batch, sent directly. Lands in the recipient's confidential balance instantly. No claim step.",
    issuer: "One-shot batch send",
    recipient: "Receives into confidential balance",
    icon: Split,
  },
]

const ROWS: ConsoleRowData[] = [
  { index: "#001", addr: "0x8f2e...91c3", amount: "2,015.31 cUSDT" },
  { index: "#002", addr: "0x12a4...ff08", amount: "7,527.37 cUSDT" },
  { index: "#003", addr: "0xbc92...44e1", amount: "4,300.00 cUSDT" },
  { index: "#004", addr: "0x7d01...aa52", amount: "8,829.89 cUSDT" },
]

// Masked stand-in for an encrypted amount, shown until the key-holder unseals it.
const SEALED_MASK = "* * * * *"

type ConsoleRowData = { index: string; addr: string; amount: string }

export function VariantLanding() {
  return (
    <div className="vl">
      <nav className="vl-nav">
        <Link to="/" className="vl-logo">
          <Logomark className="vl-logo-mark" />
          VEILFLOW
        </Link>
        <div className="vl-nav-links">
          {NAV_LINKS.map((n) => (
            <Link key={n.to} to={n.to}>
              {n.label}
            </Link>
          ))}
        </div>
        <Link to="/dashboard" className="vl-btn-wallet">
          Launch App
        </Link>
      </nav>

      <main className="vl-main">
        <section className="vl-hero">
          <HeroGradient />
          <div className="vl-hero-content">
            <div className="vl-metadata-tag">
              <span className="vl-dot-gold" /> LIVE ON SEPOLIA
            </div>
            <h1>
              Airdrops, vesting, disperse.
              <br />
              <span className="vl-hero-accent">Every amount encrypted.</span>
            </h1>
            <p className="vl-hero-sub">
              One console for any shape of confidential token distribution. Issuers connect a wallet, pick an instrument,
              and distribute ERC-7984 tokens while amounts stay sealed on-chain.
            </p>
            <div className="vl-trust">
              <span className="vl-trust-icon" aria-hidden>
                <LockKeyhole size={16} strokeWidth={2} />
              </span>
              <span className="vl-trust-text">
                <strong>Plaintext never leaves your browser.</strong> The backend only ever sees ciphertext artifacts.
              </span>
            </div>
            <div className="vl-cta-group">
              <Link to="/create" className="vl-btn-primary">
                Create a distribution
                <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
              </Link>
              <Link to="/docs" className="vl-btn-secondary">
                Read the docs
              </Link>
            </div>
          </div>
          <HeroSeal />
        </section>

        <section id="instruments" className="vl-section">
          <div className="vl-section-header">
            <h2>Three ways to distribute, all confidential.</h2>
            <p className="vl-section-lede">
              Same encrypted foundation, three distribution shapes. Pick the one that fits the moment.
            </p>
          </div>
          <div className="vl-instruments">
            {INSTRUMENTS.map((it) => (
              <article className="vl-instrument-card" key={it.id}>
                <div className="vl-instrument-top">
                  <span className="vl-instrument-index">{it.index}</span>
                  <it.icon className="vl-card-icon" aria-hidden />
                </div>
                <h3>{it.title}</h3>
                <p className="vl-instrument-blurb">{it.blurb}</p>
                <dl className="vl-instrument-meta">
                  <div>
                    <dt>Issuer</dt>
                    <dd>{it.issuer}</dd>
                  </div>
                  <div>
                    <dt>Recipient</dt>
                    <dd>{it.recipient}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section id="infrastructure" className="vl-section">
          <div className="vl-section-header">
            <h2>Public chains leak the number first.</h2>
            <p className="vl-section-lede">
              VeilFlow treats amount privacy as the default treasury posture, not an afterthought patched onto a public ledger.
            </p>
          </div>
          <div className="vl-leak-panel">
            <div className="vl-leak-statement">
              <EyeOff className="vl-card-icon" aria-hidden />
              <p>
                The red line is simple: encryption happens in the issuer's browser, and recipients decrypt only their own figure.
              </p>
            </div>
            <ol className="vl-leak-list">
              {LEAKS.map((leak, i) => (
                <li key={leak}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {leak}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="trust-boundary" className="vl-section">
          <div className="vl-section-header">
            <h2>Three layers, one privacy line.</h2>
            <p className="vl-section-lede">
              The app can coordinate distribution logistics without becoming a place where sensitive amounts live.
            </p>
          </div>
          <div className="vl-grid-features">
            {TRUST_LAYERS.map((f, i) => (
              <div className="vl-feature-card" key={f.layer}>
                <div className="vl-feature-top">
                  <span className="vl-instrument-index">{String(i + 1).padStart(2, "0")}</span>
                  <f.icon className="vl-card-icon" aria-hidden />
                </div>
                <h3>{f.layer}</h3>
                <dl className="vl-layer-meta">
                  <div>
                    <dt>Holds</dt>
                    <dd>{f.holds}</dd>
                  </div>
                  <div>
                    <dt>Guarantee</dt>
                    <dd>{f.guarantee}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section id="console-preview" className="vl-section">
          <div className="vl-section-header">
            <h2>The distribution console.</h2>
          </div>
          <div className="vl-console">
            <div className="vl-console-header">
              <LockKeyhole size={13} strokeWidth={2} aria-hidden />
              <span className="vl-console-file">Encrypted distribution · sample data</span>
            </div>
            <div className="vl-console-body">
              <div className="vl-row vl-row-head">
                <div>
                  <span className="vl-label">Index</span>
                </div>
                <div>
                  <span className="vl-label">Recipient Address</span>
                </div>
                <div>
                  <span className="vl-label">Amount (Sealed)</span>
                </div>
                <div>
                  <span className="vl-label">Status</span>
                </div>
              </div>
              {ROWS.map((r) => (
                <ConsoleRow key={r.index} {...r} />
              ))}
            </div>
          </div>
          <p className="vl-console-note">
            Click a row to unseal a sample — the way the key-holder decrypts their own figure, with a wallet signature.
          </p>
        </section>
      </main>

      <footer className="vl-footer">
        <div className="vl-footer-top">
          <div className="vl-footer-brand">
            <Link to="/" className="vl-footer-logo">
              <Logomark className="vl-footer-logo-mark" />
              VEILFLOW
            </Link>
            <p className="vl-footer-tagline">
              Confidential token distribution on FHEVM.
              <br />
              Airdrops, vesting, disperse — every amount encrypted.
            </p>
            <a className="vl-footer-social" href="https://github.com/YanYuanFE/veilflow" target="_blank" rel="noreferrer">
              <GithubMark className="vl-footer-social-mark" />
              GitHub
            </a>
          </div>

          <nav className="vl-footer-col">
            <span className="vl-footer-col-title">Protocol</span>
            <a href="#instruments">How it works</a>
            <a href="#infrastructure">Privacy model</a>
            <a href="#trust-boundary">Trust boundary</a>
            <a href="#console-preview">The console</a>
          </nav>

          <nav className="vl-footer-col">
            <span className="vl-footer-col-title">Resources</span>
            <Link to="/docs">Documentation</Link>
            <a href="https://github.com/YanYuanFE/veilflow" target="_blank" rel="noreferrer">GitHub</a>
            <a href="https://docs.zama.ai" target="_blank" rel="noreferrer">Zama Docs</a>
          </nav>
        </div>

        <div className="vl-footer-bottom">
          <span>© 2026 VeilFlow</span>
          <span>Built on Zama FHEVM</span>
        </div>
      </footer>
    </div>
  )
}

/** GitHub mark — inlined because lucide dropped its brand icons. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** A console row: an explicit click toggles the reveal — standing in for the
 *  key-holder decrypting their own figure. Hover only highlights (affordance);
 *  it does not unseal, so the demo doesn't imply "hovering decrypts." */
function ConsoleRow({ index, addr, amount }: ConsoleRowData) {
  const [revealed, setRevealed] = useState(false)
  return (
    <button
      type="button"
      className={revealed ? "vl-row is-revealed" : "vl-row"}
      onClick={() => setRevealed((v) => !v)}
      aria-pressed={revealed}
      title={revealed ? "Re-seal sample" : "Unseal this sample, as the key-holder would"}
      aria-label={`${revealed ? "Re-seal" : "Unseal"} the sample amount for ${addr}`}
    >
      <div>{index}</div>
      <div>{addr}</div>
      <div className="vl-encrypted-val">{revealed ? amount : SEALED_MASK}</div>
      <div className="vl-status-shielded">
        {revealed ? <Eye size={14} strokeWidth={2} aria-hidden /> : <KeyRound size={14} strokeWidth={2} aria-hidden />}
        {revealed ? "DECRYPTED" : "SEALED"}
      </div>
    </button>
  )
}
