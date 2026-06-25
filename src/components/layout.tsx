import { NavLink, Outlet, useLocation } from "react-router-dom"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { cn } from "@/lib/utils"
import { Kicker } from "@/components/editorial"
import { Logomark } from "@/components/logomark"
import { ErrorBoundary } from "@/components/error-boundary"

const NAV: { to: string; label: string; aliases?: string[] }[] = [
  { to: "/dashboard", label: "Distributions" },
  { to: "/claims", label: "Claims" },
  { to: "/wrap", label: "Wrap / Unwrap", aliases: ["/unwrap"] },
  { to: "/audit", label: "Auditor" },
  { to: "/docs", label: "Docs" },
]

export function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="console-shell flex min-h-svh flex-col bg-background">
      {/* Letterhead + nav — pinned, lifts over content on scroll */}
      <div className="sticky top-0 z-40">
        <div className="h-[2px] w-full bg-primary" />
        <header className="border-b border-border bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <NavLink to="/" className="group flex items-center gap-2.5">
            {/* Wordmark: the VeilFlow mark — a sealed confidential document */}
            <Logomark className="size-[22px] shrink-0 text-foreground" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[1.35rem] leading-none tracking-tight text-foreground">
                Veilflow
              </span>
              <Kicker className="mt-1 text-[0.5625rem] tracking-[0.2em] group-hover:text-foreground/70">
                Confidential distribution
              </Kicker>
            </span>
          </NavLink>

          <div className="flex items-center gap-4 sm:gap-5">
            <nav className="-mx-1 flex items-center gap-4 overflow-x-auto px-1 sm:gap-5">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      "relative shrink-0 py-1 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                      (isActive || (n.aliases?.includes(pathname) ?? false)) &&
                        "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-primary after:content-['']",
                    )
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
          </div>
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <div key={pathname} className="page-enter">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-6 py-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Kicker>Veilflow — confidential distribution console</Kicker>
          <Kicker className="tracking-[0.16em]">TokenOps SDK · Zama FHE · Sepolia</Kicker>
        </div>
      </footer>
    </div>
  )
}
