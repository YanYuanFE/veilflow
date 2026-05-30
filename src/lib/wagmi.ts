import { http } from "wagmi"
import { sepolia } from "wagmi/chains"
import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { SEPOLIA_RPC_URL } from "@/lib/config"

export const wagmiConfig = getDefaultConfig({
  appName: "VeilFlow",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "VEILFLOW_DEV_PLACEHOLDER",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
  ssr: false,
})

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig
  }
}
