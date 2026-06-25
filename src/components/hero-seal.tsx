import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { LockKeyhole, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

/* Hero specimen: a recipient's amount that auto-seals (plaintext -> sealed) on a
 * calm loop — the "every amount encrypted" promise, demonstrated rather than
 * decorated. Hover holds it revealed. Reduced-motion shows a static sealed card. */

const SAMPLES = [
  { addr: "0x8f2e…91c3", amount: "2,015.31", unit: "cUSDT" },
  { addr: "0x12a4…ff08", amount: "7,527.37", unit: "cUSDT" },
  { addr: "0xbc92…44e1", amount: "4,300.00", unit: "cEURC" },
  { addr: "0x7d01…aa52", amount: "8,829.89", unit: "cUSDT" },
]

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

export function HeroSeal() {
  const reduce = usePrefersReducedMotion()
  const [tick, setTick] = useState(0)
  const [hover, setHover] = useState(false)
  const hoverRef = useRef(false)

  // One tick = one reveal/seal phase change; the sample advances every full cycle.
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => {
      if (!hoverRef.current) setTick((t) => t + 1)
    }, 1900)
    return () => clearInterval(id)
  }, [reduce])

  const sample = SAMPLES[Math.floor(tick / 2) % SAMPLES.length]
  const sealed = hover ? false : reduce ? true : tick % 2 === 1

  const setHovered = (v: boolean) => {
    hoverRef.current = v
    setHover(v)
  }

  return (
    <div className="vl-seal" aria-hidden>
      <div className="vl-seal-stack">
        <article
          className={cn("vl-seal-card", sealed && "is-sealed")}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <header className="vl-seal-top">
            <span className="vl-seal-status">
              <span className="vl-seal-statusdot" />
              {sealed ? <LockKeyhole strokeWidth={2} /> : <Eye strokeWidth={2} />}
              {sealed ? "Shielded" : "Key view"}
            </span>
            <SealStamp />
          </header>

          <div className="vl-seal-field">
            <span className="vl-seal-k">Recipient</span>
            <span className="vl-seal-addr">{sample.addr}</span>
          </div>

          <div className="vl-seal-field">
            <span className="vl-seal-k">Amount</span>
            <div className="vl-seal-amount">
              <span className="vl-seal-plain">{sample.amount}</span>
              <span className="vl-seal-ciphered">
                <span className="vl-seal-dots">••••••</span>
                <LockKeyhole strokeWidth={2} />
              </span>
              <span className="vl-seal-sweep" />
            </div>
            <span className="vl-seal-unit">{sample.unit}</span>
          </div>

          <footer className="vl-seal-foot">
            encrypted in-browser <span className="vl-seal-dot">·</span> sealed on-chain
          </footer>
        </article>
      </div>
    </div>
  )
}

function SealStamp() {
  return (
    <svg className="vl-seal-stamp" viewBox="0 0 64 64" role="img" aria-label="Encrypted seal">
      <circle className="vl-stamp-ring-out" cx="32" cy="32" r="29" />
      <circle className="vl-stamp-ticks" cx="32" cy="32" r="24" />
      <circle className="vl-stamp-ring-in" cx="32" cy="32" r="19" />
      <g className="vl-stamp-lock" transform="translate(32 33)">
        <path d="M -5 -1 V -5.5 A 5 5 0 0 1 5 -5.5 V -1" />
        <rect x="-7" y="-1" width="14" height="11" rx="2.2" />
      </g>
    </svg>
  )
}
