import type { ReactNode } from "react"
import { useMemo } from "react"
import { WagmiProvider, usePublicClient, useWalletClient, useAccount } from "wagmi"
import { sepolia } from "wagmi/chains"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { ZamaProvider, RelayerWeb, SepoliaConfig, indexedDBStorage } from "@zama-fhe/react-sdk"
import { ViemSigner } from "@zama-fhe/sdk/viem"
import { wagmiConfig } from "@/lib/wagmi"
import { SEPOLIA_RPC_URL } from "@/lib/config"
import "@rainbow-me/rainbowkit/styles.css"

const queryClient = new QueryClient()

// Browser relayer (encryptor) — single-chain Sepolia. Network config from SepoliaConfig.
const relayer = new RelayerWeb({
  getChainId: () => Promise.resolve(sepolia.id),
  transports: {
    [sepolia.id]: { ...SepoliaConfig, network: SEPOLIA_RPC_URL },
  },
})

// ViemSigner (wagmi-version-agnostic) rebuilt from wagmi clients. We use this instead of
// WagmiSigner because RainbowKit pins wagmi v2 while WagmiSigner needs a v3-only action.
function ZamaBoundary({ children }: { children: ReactNode }) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()

  const signer = useMemo(() => {
    if (!publicClient) return undefined
    return new ViemSigner({ publicClient, walletClient: walletClient ?? undefined })
  }, [publicClient, walletClient])

  if (!signer) return <>{children}</>

  return (
    <ZamaProvider key={address ?? "readonly"} relayer={relayer} signer={signer} storage={indexedDBStorage}>
      {children}
    </ZamaProvider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ZamaBoundary>{children}</ZamaBoundary>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
