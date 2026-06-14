import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { StatusBadge } from "@/components/status-badge"
import { Kicker, Notice } from "@/components/editorial"
import { listClaimsFor } from "@/lib/api"
import { shortAddr } from "@/lib/format"

export function Claims() {
  const { address, isConnected } = useAccount()
  const q = useQuery({
    queryKey: ["claims", address],
    queryFn: () => listClaimsFor(address!),
    enabled: isConnected && !!address,
  })
  const rows = q.data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-2">
        <Kicker>Recipient</Kicker>
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] leading-tight text-foreground">Your claims</h1>
        <p className="font-serif text-muted-foreground">
          Confidential allocations addressed to this wallet — only you can read the amounts.
        </p>
      </header>

      {!isConnected ? (
        <div className="rounded-md border border-border bg-card px-6 py-16 text-center">
          <Kicker>Wallet required</Kicker>
          <p className="font-display mt-3 text-2xl text-foreground">Connect to see your claims</p>
          <div className="mt-6 flex justify-center">
            <ConnectButton />
          </div>
        </div>
      ) : q.isLoading ? (
        <Kicker>Looking up your allocations…</Kicker>
      ) : q.error ? (
        <Notice tone="void">{q.error.message}</Notice>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border bg-card px-6 py-16 text-center">
          <Kicker>Nothing addressed to you</Kicker>
          <p className="font-display mt-3 text-2xl text-foreground">No claims found</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Airdrops you've been allocated appear here. Vesting and direct payouts arrive via the issuer's link.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((d) => (
            <li key={d.id}>
              <Link
                to={`/claim/${d.slug}`}
                className="group grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-2 py-5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <h3 className="font-display truncate text-xl tracking-tight text-foreground">
                    {d.name}
                    <span className="ml-2 inline-block text-muted-foreground opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                      →
                    </span>
                  </h3>
                  <Kicker className="mt-1">
                    {d.type} · /{d.slug}
                  </Kicker>
                </div>
                <div className="hidden font-mono text-xs leading-relaxed text-muted-foreground sm:block">
                  <div>Token {shortAddr(d.token)}</div>
                </div>
                <div className="col-start-2 row-start-1 justify-self-end sm:col-start-3 sm:self-center">
                  <StatusBadge status={d.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
