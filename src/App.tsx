import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import { Toaster } from "sonner"
import { Layout } from "@/components/layout"
import { ErrorBoundary } from "@/components/error-boundary"
import { Kicker } from "@/components/editorial"
import { Home } from "@/routes/home"
import { Treasury } from "@/routes/treasury"
import { Create } from "@/routes/create"
import { Dashboard } from "@/routes/dashboard"
import { DistributionDetail } from "@/routes/distribution"
import { Claim } from "@/routes/claim"
import { Claims } from "@/routes/claims"
import { Audit } from "@/routes/audit"
import { Docs } from "@/routes/docs"
import { VariantLanding } from "@/routes/variant-landing"

function App() {
  return (
    <BrowserRouter>
      <Toaster richColors closeButton position="top-right" />
      <Routes>
        {/* Standalone landing homepage — its own nav/footer, no app chrome */}
        <Route index element={<VariantLanding />} />
        <Route element={<Layout />}>
          {/* Previous editorial landing, kept reachable (not deleted) */}
          <Route path="overview" element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="create" element={<Create />} />
          <Route path="d/:id" element={<DistributionDetail />} />
          <Route path="claims" element={<Claims />} />
          <Route path="audit" element={<Audit />} />
          <Route path="docs" element={<Docs />} />
          <Route path="wrap" element={<Treasury />} />
          <Route path="unwrap" element={<Treasury />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        {/* Standalone, branded, customer-facing — no app chrome */}
        <Route path="claim/:slug" element={<ErrorBoundary><Claim /></ErrorBoundary>} />
      </Routes>
    </BrowserRouter>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-4 text-center">
      <Kicker>404</Kicker>
      <h1 className="font-display text-3xl text-foreground">This page doesn't exist</h1>
      <Link to="/" className="text-sm text-muted-foreground underline hover:text-foreground">
        Back to home
      </Link>
    </div>
  )
}

export default App
