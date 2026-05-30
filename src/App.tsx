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
import { Audit } from "@/routes/audit"

function App() {
  return (
    <BrowserRouter>
      <Toaster richColors closeButton position="top-right" />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="create" element={<Create />} />
          <Route path="d/:id" element={<DistributionDetail />} />
          <Route path="claim/:slug" element={<Claim />} />
          <Route path="audit" element={<Audit />} />
          <Route path="wrap" element={<Wrap />} />
          <Route path="unwrap" element={<Unwrap />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
