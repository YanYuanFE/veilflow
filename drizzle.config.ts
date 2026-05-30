import { defineConfig } from "drizzle-kit"

// `generate` only diffs the schema (no DB needed). `migrate`/`push` use DATABASE_URL.
export default defineConfig({
  schema: "./api/_schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
})
