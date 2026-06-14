import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import { Layout } from "@/components/layout"
import { Home } from "@/routes/home"
import { Wrap } from "@/routes/wrap"
import { Unwrap } from "@/routes/unwrap"
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
          <Route path="wrap" element={<Wrap />} />
          <Route path="unwrap" element={<Unwrap />} />
        </Route>
        {/* Standalone, branded, customer-facing — no app chrome */}
        <Route path="claim/:slug" element={<Claim />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
