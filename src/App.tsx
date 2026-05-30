import { ConnectButton } from "@rainbow-me/rainbowkit"

function App() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">VeilFlow</h1>
        <p className="max-w-md text-muted-foreground">
          Confidential token distribution — airdrops, disperse, and vesting with
          encrypted amounts. Powered by Zama FHE &amp; the TokenOps SDK.
        </p>
      </div>
      <ConnectButton />
    </main>
  )
}

export default App
