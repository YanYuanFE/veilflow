import path from "path"
import type { IncomingMessage } from "http"
import { defineConfig, loadEnv, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Dev-only: run the Vercel `/api` functions in-process so plain `vite` (5173)
// serves them too — no `vercel dev` needed. Production is unaffected: the
// api/*.ts files stay real Vercel serverless functions, and vercel.json drives
// prod routing. Add a route here when you add a new /api file.
function devApi(): Plugin {
  const match = (pathname: string): { file: string; params: Record<string, string> } | null => {
    const parts = pathname.replace(/^\/api\//, "").replace(/\/$/, "").split("/")
    if (parts[0] !== "distributions") return null
    if (parts.length === 1) return { file: "/api/distributions/index.ts", params: {} }
    if (parts.length === 2) return { file: "/api/distributions/[id].ts", params: { id: parts[1] } }
    if (parts.length === 3 && parts[2] === "recipients")
      return { file: "/api/distributions/[id]/recipients.ts", params: { id: parts[1] } }
    return null
  }

  const readBody = (req: IncomingMessage) =>
    new Promise<unknown>((resolve) => {
      const chunks: Buffer[] = []
      req.on("data", (c: Buffer) => chunks.push(c))
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8")
        try {
          resolve(raw ? JSON.parse(raw) : undefined)
        } catch {
          resolve(undefined)
        }
      })
      req.on("error", () => resolve(undefined))
    })

  return {
    name: "veilflow-dev-api",
    configureServer(server) {
      // Expose .env (incl. DATABASE_URL) to the in-process handlers.
      const env = loadEnv("development", process.cwd(), "")
      for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next()
        try {
          const url = new URL(req.url, "http://localhost")
          const route = match(url.pathname)
          if (!route) {
            res.statusCode = 404
            res.setHeader("Content-Type", "application/json")
            return res.end(JSON.stringify({ error: "Not found" }))
          }
          const mod = await server.ssrLoadModule(route.file)
          // Adapt the Node req/res into the Vercel-style shape the handlers expect.
          ;(req as unknown as { query: Record<string, unknown> }).query = {
            ...Object.fromEntries(url.searchParams),
            ...route.params,
          }
          ;(req as unknown as { body: unknown }).body = await readBody(req)
          ;(res as unknown as { status: (c: number) => unknown }).status = (c: number) => {
            res.statusCode = c
            return res
          }
          ;(res as unknown as { json: (b: unknown) => unknown }).json = (b: unknown) => {
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify(b))
            return res
          }
          await (mod.default as (q: unknown, s: unknown) => unknown)(req, res)
        } catch (e) {
          res.statusCode = 500
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    // Force a single instance of these so React context (WagmiProvider, etc.)
    // is shared — pnpm can install multiple peer-hashed copies otherwise.
    dedupe: ["wagmi", "viem", "@tanstack/react-query", "@rainbow-me/rainbowkit", "react", "react-dom"],
  },
})
