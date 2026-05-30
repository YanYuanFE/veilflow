import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { listDistributions } from "@/lib/api"
import { shortAddr } from "@/lib/format"

export function Dashboard() {
  const { address, isConnected } = useAccount()

  const q = useQuery({
    queryKey: ["distributions", address],
    queryFn: () => listDistributions(address!),
    enabled: isConnected && !!address,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My distributions</h1>
          <p className="text-muted-foreground">Everything you've created from this wallet.</p>
        </div>
        <Button asChild>
          <Link to="/create">New distribution</Link>
        </Button>
      </div>

      {!isConnected && <p className="text-sm text-muted-foreground">Connect your wallet to see your distributions.</p>}
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="text-sm text-destructive">{q.error.message}</p>}
      {q.data?.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No distributions yet.{" "}
            <Link to="/create" className="underline">
              Create your first one
            </Link>
            .
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((d) => (
          <Link key={d.id} to={`/d/${d.id}`}>
            <Card className="transition-colors hover:bg-muted/40">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{d.name}</CardTitle>
                  <StatusBadge status={d.status} />
                </div>
                <CardDescription className="capitalize">
                  {d.type} · /{d.slug}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Token {shortAddr(d.token)}
                {d.contractAddress && <> · Pool {shortAddr(d.contractAddress)}</>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
