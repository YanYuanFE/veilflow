import { http, createConfig } from "wagmi"
import { sepolia } from "wagmi/chains"
import { injected } from "wagmi/connectors"
import { SEPOLIA_RPC_URL } from "@/lib/config"

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
})

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig
  }
}
