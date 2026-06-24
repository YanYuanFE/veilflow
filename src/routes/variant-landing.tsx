import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Logomark } from "@/components/logomark"
import "./variant-landing.css"

const NAV_LINKS = [
  { to: "/dashboard", label: "Distributions" },
  { to: "/claims", label: "Claims" },
  { to: "/wrap", label: "Wrap / Unwrap" },
  { to: "/audit", label: "Audit" },
]

const BADGES = [
  { name: "Airdrop Participant", data: "ENCRYPTED: ****.84" },
  { name: "Vesting Lead", data: "LOCKED: 0x4f...21" },
  { name: "Compliance Node", data: "VERIFIED: ERC-7984" },
]

const FEATURES = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "Shielded Wrapping",
    body: "Convert any standard ERC-20 token into a confidential ERC-7984 unit. Balances are mathematically hidden while remaining verifiable.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "End-to-End Auth",
    body: "Only the specific recipient's private key can decrypt the distribution amount. Issuers sign, recipients reveal.",
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "Selective Disclosure",
    body: "Grant a named auditor read-only access to a single figure. Prove compliance for one allocation without exposing anyone else's.",
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
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" />
        <path d="M7 10l5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    ),
  },
  {
    id: "vesting",
    index: "02",
    title: "Vesting",
    blurb: "Linear unlock with cliff and initial release, batch-created in one transaction. Recipients claim the vested portion over time.",
    issuer: "Batch-create vestings",
    recipient: "Claim what's vested so far",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M16 8h4v4" />
      </svg>
    ),
  },
  {
    id: "disperse",
    index: "03",
    title: "Disperse",
    blurb: "One encrypted batch, sent directly. Lands in the recipient's confidential balance instantly — no claim step.",
    issuer: "One-shot batch send",
    recipient: "Receives into confidential balance",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13" />
        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    ),
  },
]

const ROWS = [
  { index: "#001", addr: "0x8f2e...91c3", amount: "2015.31 cUSDT" },
  { index: "#002", addr: "0x12a4...ff08", amount: "7527.37 cUSDT" },
  { index: "#003", addr: "0xbc92...44e1", amount: "**********" },
  { index: "#004", addr: "0x7d01...aa52", amount: "8829.89 cUSDT" },
]

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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <span className="vl-trust-text">
              <strong>Plaintext never leaves your browser.</strong> The backend only ever sees ciphertext artifacts.
            </span>
          </div>
          <div className="vl-cta-group">
            <Link to="/create" className="vl-btn-primary">
              Create a distribution
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
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
                  {it.icon}
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
            <div className="vl-metadata-tag">02 / ARCHITECTURE</div>
            <h2>Native privacy infrastructure.</h2>
          </div>
          <div className="vl-grid-features">
            {FEATURES.map((f) => (
              <div className="vl-feature-card" key={f.title}>
                <div className="vl-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="console-preview" className="vl-section">
          <div className="vl-section-header">
            <div className="vl-metadata-tag">03 / INTERFACE</div>
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
                <ConsoleRow key={r.index} index={r.index} addr={r.addr} amount={r.amount} />
              ))}
            </div>
          </div>
          <p className="vl-console-note">Hover over sealed values to simulate key-holder decryption.</p>
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

const SCRAMBLE_CHARS = (len: number) =>
  Array.from({ length: len }, () => String.fromCharCode(33 + Math.floor(Math.random() * 94))).join("")

/** A console row whose sealed amount scrambles into a "decrypted" figure on hover. */
function ConsoleRow({ index, addr, amount }: { index: string; addr: string; amount: string }) {
  const [display, setDisplay] = useState(amount)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const enter = () => {
    clearInterval(timer.current)
    const decrypted = `${(1000 + Math.random() * 9000).toFixed(2)} cUSDT`
    let iterations = 0
    timer.current = setInterval(() => {
      const revealed = decrypted.slice(0, Math.floor(iterations))
      setDisplay(revealed + SCRAMBLE_CHARS(decrypted.length - revealed.length))
      iterations += 1 / 3
      if (iterations >= decrypted.length) {
        clearInterval(timer.current)
        setDisplay(decrypted)
      }
    }, 30)
  }

  const leave = () => {
    clearInterval(timer.current)
    setDisplay(amount)
  }

  useEffect(() => () => clearInterval(timer.current), [])

  return (
    <div className="vl-row" onMouseEnter={enter} onMouseLeave={leave}>
      <div>{index}</div>
      <div>{addr}</div>
      <div className="vl-encrypted-val">{display}</div>
      <div className="vl-status-shielded">SHIELDED</div>
    </div>
  )
}
