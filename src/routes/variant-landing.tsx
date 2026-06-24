import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Database, Eye, EyeOff, LockKeyhole, MonitorSmartphone, Send, ServerCog, Split, TrendingUp } from "lucide-react"
import { Logomark } from "@/components/logomark"
import "./variant-landing.css"

const NAV_LINKS = [
  { to: "/dashboard", label: "Distributions" },
  { to: "/claims", label: "Claims" },
  { to: "/wrap", label: "Wrap / Unwrap" },
  { to: "/audit", label: "Auditor" },
]

const BADGES = [
  { name: "Airdrop Participant", data: "ENCRYPTED: ****.84" },
  { name: "Vesting Lead", data: "LOCKED: 0x4f...21" },
  { name: "Compliance Node", data: "VERIFIED: ERC-7984" },
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
    blurb: "One encrypted batch, sent directly. Lands in the recipient's confidential balance instantly — no claim step.",
    issuer: "One-shot batch send",
    recipient: "Receives into confidential balance",
    icon: Split,
  },
]

const ROWS: ConsoleRowData[] = [
  { index: "#001", addr: "0x8f2e...91c3", sealed: "SEALED: 0x9f...24", amount: "2,015.31 cUSDT" },
  { index: "#002", addr: "0x12a4...ff08", sealed: "SEALED: 0x74...b8", amount: "7,527.37 cUSDT" },
  { index: "#003", addr: "0xbc92...44e1", sealed: "SEALED: 0x31...0c", amount: "4,300.00 cUSDT" },
  { index: "#004", addr: "0x7d01...aa52", sealed: "SEALED: 0xaa...52", amount: "8,829.89 cUSDT" },
]

type ConsoleRowData = { index: string; addr: string; sealed: string; amount: string }

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
          <div className="vl-metadata-tag">
            <span className="vl-dot-gold" /> LIVE ON SEPOLIA
          </div>
          <h1>
            Airdrops, vesting, disperse —
            <br />
            <span className="vl-hero-accent">with every amount encrypted.</span>
          </h1>
          <p className="vl-hero-sub">
            One console for any shape of confidential token distribution. Issuers connect a wallet, pick an instrument,
            and distribute ERC-7984 tokens — while amounts stay sealed on-chain.
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

          <div className="vl-floating-badges">
            {BADGES.map((b) => (
              <div className="vl-badge" key={b.name}>
                <span className="vl-badge-avatar" aria-hidden>
                  {b.name.charAt(0)}
                </span>
                <div className="vl-badge-info">
                  <span className="vl-badge-name">{b.name}</span>
                  <span className="vl-badge-data">{b.data}</span>
                </div>
                <div className="vl-badge-status" />
              </div>
            ))}
          </div>

          <div className="vl-scroll-indicator">
            SCROLL
            <div className="vl-scroll-line" />
          </div>
        </section>

        <section id="instruments" className="vl-section">
          <div className="vl-section-header">
            <div className="vl-metadata-tag">01 / INSTRUMENTS</div>
            <h2>Three ways to distribute, all confidential.</h2>
            <p className="vl-section-lede">
              Same encrypted foundation, three distribution shapes — pick the one that fits the moment of the tokens.
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
            <div className="vl-metadata-tag">02 / WHY CONFIDENTIAL</div>
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
            <div className="vl-metadata-tag">03 / TRUST BOUNDARY</div>
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
            <div className="vl-metadata-tag">04 / INTERFACE</div>
            <h2>The distribution console.</h2>
          </div>
          <div className="vl-console">
            <div className="vl-console-header">
              <div className="vl-dot" style={{ background: "#ff5f56" }} />
              <div className="vl-dot" style={{ background: "#ffbd2e" }} />
              <div className="vl-dot" style={{ background: "#27c93f" }} />
              <span className="vl-console-file">distribution_manifest_v2.json</span>
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
          <p className="vl-console-note">Select a row to reveal a fixed key-holder sample.</p>
        </section>
      </main>

      <footer className="vl-footer">
        <div>© 2026 VeilFlow Infrastructure</div>
        <div className="vl-footer-links">
          <a href="https://github.com/YanYuanFE/veilflow" target="_blank" rel="noreferrer">GitHub</a>
          <Link to="/docs">Documentation</Link>
        </div>
      </footer>
    </div>
  )
}

/** A console row with an explicit, keyboard-accessible key-holder reveal. */
function ConsoleRow({ index, addr, sealed, amount }: ConsoleRowData) {
  const [revealed, setRevealed] = useState(false)
  return (
    <button
      type="button"
      className="vl-row"
      onClick={() => setRevealed((v) => !v)}
      aria-pressed={revealed}
      aria-label={`${revealed ? "Hide" : "Reveal"} sample encrypted amount for ${addr}`}
    >
      <div>{index}</div>
      <div>{addr}</div>
      <div className="vl-encrypted-val">{revealed ? amount : sealed}</div>
      <div className="vl-status-shielded">
        {revealed ? <Eye size={14} strokeWidth={2} aria-hidden /> : <LockKeyhole size={14} strokeWidth={2} aria-hidden />}
        {revealed ? "KEY VIEW" : "SHIELDED"}
      </div>
    </button>
  )
}
