import { NavLink, Outlet } from "react-router-dom"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/create", label: "Create" },
  { to: "/wrap", label: "Wrap" },
  { to: "/unwrap", label: "Unwrap" },
  { to: "/audit", label: "Audit" },
]

export function Layout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="text-lg font-semibold tracking-tight">
              VeilFlow
            </NavLink>
            <nav className="flex items-center gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                      isActive && "bg-muted text-foreground",
                    )
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <ConnectButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
