import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./_schema"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

// neon-http: each query is a stateless fetch — ideal for serverless functions.
export const db = drizzle(neon(url), { schema })
