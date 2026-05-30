// Sepolia RPC endpoint, hardcoded (not env). Must allow eth_call — the keyless ZAN
// endpoint blocks it for unregistered accounts. Used by wagmi + the Zama relayer.
export const SEPOLIA_RPC_URL = 'https://sepolia.gateway.tenderly.co'
