import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Layout } from "@/components/layout"
import { Home } from "@/routes/home"
import { Wrap } from "@/routes/wrap"
import { Unwrap } from "@/routes/unwrap"
import { Airdrop } from "@/routes/airdrop"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="wrap" element={<Wrap />} />
          <Route path="unwrap" element={<Unwrap />} />
          <Route path="airdrop" element={<Airdrop />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
