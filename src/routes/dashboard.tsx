import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { Kicker, Notice } from "@/components/editorial"
import { listDistributions } from "@/lib/api"
import { lifecycle } from "@/lib/lifecycle"
import { shortAddr } from "@/lib/format"

export function Dashboard() {
  const { address, isConnected } = useAccount()

  const q = useQuery({
    queryKey: ["distributions", address],
    queryFn: () => listDistributions(address!),
    enabled: isConnected && !!address,
  })
  const rows = q.data ?? []

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Kicker>The console</Kicker>
          <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] leading-tight text-foreground">
            Your distributions
          </h1>
          <p className="font-serif text-muted-foreground">Everything you've issued from this wallet — amounts stay sealed.</p>
        </div>
        {isConnected && (
          <Button asChild>
            <Link to="/create">New distribution</Link>
          </Button>
        )}
      </header>

      {!isConnected ? (
        <div className="rounded-md border border-border bg-card px-6 py-16 text-center">
          <Kicker>Wallet required</Kicker>
          <p className="font-display mt-3 text-2xl text-foreground">Connect to see your distributions</p>
          <div className="mt-6 flex justify-center">
            <ConnectButton />
          </div>
        </div>
      ) : q.isLoading ? (
        <Kicker>Loading the register…</Kicker>
      ) : q.error ? (
        <Notice tone="void">{q.error.message}</Notice>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border bg-card px-6 py-16 text-center">
          <Kicker>Nothing issued yet</Kicker>
          <p className="font-display mt-3 text-2xl text-foreground">Your first distribution starts here</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Wrap a token, pick airdrop · vesting · disperse, and the amounts stay sealed end-to-end.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/create">Create a distribution</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((d) => {
            const next = lifecycle(d).nextLabel
            return (
            <li key={d.id}>
              <Link
                to={`/d/${d.id}`}
                className="group -mx-4 grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 rounded-md px-4 py-5 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]"
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
                <div className="hidden font-mono text-xs leading-relaxed text-muted-foreground sm:block sm:text-right">
                  <div>Token {shortAddr(d.token)}</div>
                  {d.contractAddress && <div>Pool {shortAddr(d.contractAddress)}</div>}
                </div>
                <div className="col-start-2 row-start-1 flex flex-col items-end gap-1.5 sm:col-start-3">
                  <StatusBadge status={d.status} />
                  {next && <Kicker className="text-foreground/70">Next · {next}</Kicker>}
                </div>
              </Link>
            </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
