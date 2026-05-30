import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    // Force a single instance of these so React context (WagmiProvider, etc.)
    // is shared — pnpm can install multiple peer-hashed copies otherwise.
    dedupe: ["wagmi", "viem", "@tanstack/react-query", "@rainbow-me/rainbowkit", "react", "react-dom"],
  },
})
