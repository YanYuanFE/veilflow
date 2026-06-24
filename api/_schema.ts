import { pgTable, pgEnum, uuid, text, integer, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core"

// One row per distribution project. The chain is the source of truth for money;
// this table is the convenience/CMS layer. Privacy red line: NO plaintext amounts
// are ever stored here — only public params, addresses, and ciphertext artifacts.
export const distributionType = pgEnum("distribution_type", ["airdrop", "disperse", "vesting"])
export const distributionStatus = pgEnum("distribution_status", [
  "draft", // created, no contract yet
  "deploying", // deploy tx sent (txHash known), address not yet written back
  "deployed", // contract address written back
  "funded", // pool funded
  "live", // open to recipients
  "completed",
  "revoked",
])

export const distributions = pgTable("distributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: distributionType("type").notNull(),
  creator: text("creator").notNull(), // lowercased issuer address (ownership)
  chainId: integer("chain_id").notNull().default(11_155_111), // Sepolia
  token: text("token").notNull(), // confidential ERC-7984 token
  status: distributionStatus("status").notNull().default("draft"),
  contractAddress: text("contract_address"), // airdrop pool / vesting manager (null until deployed)
  deployTxHash: text("deploy_tx_hash"), // persisted before receipt → idempotent reconciliation anchor
  // Public, non-sensitive params only (timestamps, canExtend, decimals). Never amounts.
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  theme: jsonb("theme").$type<Record<string, unknown> | null>(), // branding (later)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("distributions_creator_idx").on(t.creator), // dashboard: list by issuer
])

// Ciphertext artifacts handed to recipients. The backend's job is to deliver
// {handle, inputProof, signature} to the right address — it cannot forge a claim
// and never sees the plaintext amount (encryption happens in the admin's browser).
export const recipients = pgTable("recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  distributionId: uuid("distribution_id")
    .notNull()
    .references(() => distributions.id, { onDelete: "cascade" }),
  recipient: text("recipient").notNull(), // lowercased address
  handle: text("handle").notNull(), // encrypted amount handle
  inputProof: text("input_proof").notNull(), // KMS input proof
  signature: text("signature"), // EIP-712 claim authorization (airdrop)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("recipients_distribution_recipient_uniq").on(t.distributionId, t.recipient), // one artifact per (distribution, recipient)
  index("recipients_recipient_idx").on(t.recipient), // /distributions?recipient= reverse-lookup
])

// Selective-disclosure grants, recorded so an auditor can reverse-look-up what was
// disclosed TO them (the SDK/chain has no "disclosed-to-party" read). Public refs only.
export const disclosures = pgTable("disclosures", {
  id: uuid("id").primaryKey().defaultRandom(),
  distributionId: uuid("distribution_id").references(() => distributions.id, { onDelete: "cascade" }),
  manager: text("manager").notNull(), // vesting manager address
  vestingId: text("vesting_id").notNull(), // bytes32 hex
  handle: text("handle"), // euint128 ciphertext granted to the party — lets the auditor decrypt directly (null for legacy rows)
  party: text("party").notNull(), // lowercased auditor address (reverse-lookup key)
  disclosureType: integer("disclosure_type").notNull(), // DisclosureType enum value
  recipient: text("recipient"), // lowercased recipient address (display only)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("disclosures_party_idx").on(t.party), // auditor reverse-lookup by party
])

export type Distribution = typeof distributions.$inferSelect
export type NewDistribution = typeof distributions.$inferInsert
export type Recipient = typeof recipients.$inferSelect
export type NewRecipient = typeof recipients.$inferInsert
