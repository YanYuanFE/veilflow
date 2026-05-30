import { erc20Abi, type Address } from "viem"
import { useReadContract } from "wagmi"

// ERC-7984 wrappers expose underlying() → the wrapped ERC-20. Confidential
// (shield) amounts are in the confidential token's decimals (6 by Zama
// convention), but the public shield deposit is in the UNDERLYING's decimals.
const underlyingAbi = [
  { type: "function", name: "underlying", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const

export function useTokenDecimals(address?: Address): number | undefined {
  const { data } = useReadContract({
    address,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!address },
  })
  return data
}

// name + symbol + decimals for a token (confidential or underlying).
export function useTokenMeta(address?: Address): {
  name?: string
  symbol?: string
  decimals?: number
} {
  const enabled = { query: { enabled: !!address } }
  const name = useReadContract({ address, abi: erc20Abi, functionName: "name", ...enabled })
  const symbol = useReadContract({ address, abi: erc20Abi, functionName: "symbol", ...enabled })
  const decimals = useReadContract({ address, abi: erc20Abi, functionName: "decimals", ...enabled })
  return { name: name.data, symbol: symbol.data, decimals: decimals.data }
}

export function useUnderlyingToken(confidentialToken?: Address): Address | undefined {
  const { data } = useReadContract({
    address: confidentialToken,
    abi: underlyingAbi,
    functionName: "underlying",
    query: { enabled: !!confidentialToken },
  })
  return data
}
