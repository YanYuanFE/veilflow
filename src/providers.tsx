import type { ReactNode } from "react"
import { WagmiProvider } from "wagmi"
import { sepolia } from "wagmi/chains"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ZamaProvider, RelayerWeb, SepoliaConfig, indexedDBStorage } from "@zama-fhe/react-sdk"
import { WagmiSigner } from "@zama-fhe/react-sdk/wagmi"
import { wagmiConfig } from "@/lib/wagmi"
import { SEPOLIA_RPC_URL } from "@/lib/config"

const queryClient = new QueryClient()
const signer = new WagmiSigner({ config: wagmiConfig })
const relayer = new RelayerWeb({
  getChainId: () => signer.getChainId(),
  transports: {
    [sepolia.id]: { ...SepoliaConfig, network: SEPOLIA_RPC_URL },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ZamaProvider relayer={relayer} signer={signer} storage={indexedDBStorage}>
          {children}
        </ZamaProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
