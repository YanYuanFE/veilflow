import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Logomark } from "@/components/logomark"
import "./variant-landing.css"

const NAV_LINKS = [
  { to: "/dashboard", label: "Distributions" },
  { to: "/create", label: "Create" },
  { to: "/claims", label: "Claims" },
  { to: "/wrap", label: "Wrap" },
  { to: "/unwrap", label: "Unwrap" },
  { to: "/audit", label: "Audit" },
]

const BADGES = [
  {
    img: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80",
    name: "Airdrop Participant",
    data: "ENCRYPTED: ****.84",
  },
  {
    img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80",
    name: "Vesting Lead",
    data: "LOCKED: 0x4f...21",
  },
  {
    img: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=64&q=80",
    name: "Compliance Node",
    data: "VERIFIED: ERC-7984",
  },
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

const ROWS = [
  { index: "#001", addr: "0x8f2e...91c3", amount: "2015.31 cUSDT" },
  { index: "#002", addr: "0x12a4...ff08", amount: "7527.37 cUSDT" },
  { index: "#003", addr: "0xbc92...44e1", amount: "**********" },
  { index: "#004", addr: "0x7d01...aa52", amount: "8829.89 cUSDT" },
]

export function VariantLanding() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Floating cube field — the design's three.js background, lazy-loaded.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let raf = 0
    let disposed = false
    let cleanup = () => {}

    import("three").then((THREE) => {
      if (disposed) return

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(window.devicePixelRatio)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
      camera.position.z = 5

      const group = new THREE.Group()
      const geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15)
      const cubeCount = 120
      const cubes: InstanceType<typeof THREE.Mesh>[] = []
      const materials: InstanceType<typeof THREE.MeshPhongMaterial>[] = []

      for (let i = 0; i < cubeCount; i++) {
        const material = new THREE.MeshPhongMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.2,
          specular: 0xffd208,
          shininess: 100,
        })
        materials.push(material)
        const cube = new THREE.Mesh(geometry, material)
        cube.position.x = (Math.random() - 0.5) * 15
        cube.position.y = (Math.random() - 0.5) * 8
        cube.position.z = (Math.random() - 0.5) * 5
        cube.rotation.x = Math.random() * Math.PI
        cube.rotation.y = Math.random() * Math.PI
        cubes.push(cube)
        group.add(cube)
      }
      scene.add(group)

      scene.add(new THREE.AmbientLight(0x404040, 2))
      const pointLight = new THREE.PointLight(0xffd208, 1, 20)
      pointLight.position.set(2, 2, 2)
      scene.add(pointLight)
      const fillLight = new THREE.PointLight(0xffd208, 0.5, 10)
      fillLight.position.set(-5, -2, 3)
      scene.add(fillLight)

      let mouseX = 0
      let mouseY = 0
      const onMove = (e: MouseEvent) => {
        mouseX = e.clientX / window.innerWidth - 0.5
        mouseY = e.clientY / window.innerHeight - 0.5
      }
      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("resize", onResize)

      const animate = () => {
        raf = requestAnimationFrame(animate)
        group.rotation.y += 0.001
        group.position.x += (mouseX * 0.5 - group.position.x) * 0.05
        group.position.y += (-mouseY * 0.5 - group.position.y) * 0.05
        const t = performance.now() * 0.001
        cubes.forEach((cube, i) => {
          cube.rotation.x += 0.005
          cube.rotation.y += 0.005
          cube.scale.setScalar(1 + Math.sin(t + i) * 0.1)
        })
        renderer.render(scene, camera)
      }
      animate()

      cleanup = () => {
        cancelAnimationFrame(raf)
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("resize", onResize)
        geometry.dispose()
        materials.forEach((m) => m.dispose())
        renderer.dispose()
      }
    })

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  return (
    <div className="vl">
      <canvas ref={canvasRef} className="vl-bg-canvas" />

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
            <span className="vl-dot-gold" /> [NETWORK_SEPOLIA] 0x7984_V1.0
          </div>
          <h1>The confidential layer for on-chain distributions.</h1>
          <p className="vl-hero-sub">
            VeilFlow wraps assets in end-to-end encryption, ensuring token distribution amounts stay sealed from launch
            to claim.
          </p>
          <div className="vl-cta-group">
            <Link to="/dashboard" className="vl-btn-primary">
              Launch Console
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
              <div className="vl-play-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              </div>
              How it works
            </Link>
          </div>

          <div className="vl-floating-badges">
            {BADGES.map((b) => (
              <div className="vl-badge" key={b.name}>
                <img src={b.img} alt={b.name} />
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

        <section id="infrastructure" className="vl-section">
          <div className="vl-section-header">
            <div className="vl-metadata-tag">01 / ARCHITECTURE</div>
            <h2>Native Privacy Infrastructure.</h2>
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
            <div className="vl-metadata-tag">02 / INTERFACE</div>
            <h2>The Distribution Console.</h2>
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
          <a href="#">GitHub</a>
          <Link to="/docs">Documentation</Link>
          <a href="#">Audit Report</a>
        </div>
        <div>STABLE_REL_0.9.4</div>
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
