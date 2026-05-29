// Sepolia RPC endpoint. Override with VITE_SEPOLIA_RPC_URL; falls back to a public node.
export const SEPOLIA_RPC_URL =
  import.meta.env.VITE_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"
