import type { Address, Hex } from "viem"

// Mirrors api/_schema.ts (kept in sync by hand to avoid bundling the DB client into the browser).
export type DistributionType = "airdrop" | "disperse" | "vesting"
export type DistributionStatus =
  | "draft"
  | "deploying"
  | "deployed"
  | "funded"
  | "live"
  | "completed"
  | "revoked"

export interface Distribution {
  id: string
  slug: string
  name: string
  type: DistributionType
  creator: string
  chainId: number
  token: string
  status: DistributionStatus
  contractAddress: string | null
  deployTxHash: string | null
  config: Record<string, unknown>
  theme: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface RecipientArtifact {
  id: string
  distributionId: string
  recipient: string
  handle: string
  inputProof: string
  signature: string | null
  createdAt: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = body && typeof body.error === "string" ? body.error : `Request failed (${res.status})`
    throw new Error(message)
  }
  return body as T
}

export function listDistributions(creator: Address) {
  return request<Distribution[]>(`/distributions?creator=${creator}`)
}

export function getDistribution(id: string) {
  return request<Distribution>(`/distributions/${id}`)
}

export function getDistributionBySlug(slug: string) {
  return request<Distribution>(`/distributions?slug=${encodeURIComponent(slug)}`)
}

export function createDistribution(input: {
  name: string
  slug: string
  type: DistributionType
  creator: Address
  token: Address
  config?: Record<string, unknown>
}) {
  return request<Distribution>("/distributions", { method: "POST", body: JSON.stringify(input) })
}

export function patchDistribution(
  id: string,
  patch: {
    status?: DistributionStatus
    contractAddress?: Address
    deployTxHash?: Hex
    config?: Record<string, unknown>
  },
) {
  return request<Distribution>(`/distributions/${id}`, { method: "PATCH", body: JSON.stringify(patch) })
}

export function listRecipients(id: string) {
  return request<RecipientArtifact[]>(`/distributions/${id}/recipients`)
}

export function addRecipient(
  id: string,
  input: { recipient: Address; handle: Hex; inputProof: Hex; signature?: Hex },
) {
  return request<RecipientArtifact>(`/distributions/${id}/recipients`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}
