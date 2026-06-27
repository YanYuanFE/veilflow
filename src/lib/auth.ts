// SIWE auth endpoints. Cookies (httpOnly nonce + session) are set by the server;
// same-origin fetch carries them automatically.
async function request<T>(action: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/auth/${action}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body && typeof body.error === "string" ? body.error : `Auth request failed (${res.status})`)
  }
  return body as T
}

export const fetchNonce = () => request<{ nonce: string }>("nonce").then((b) => b.nonce)

export const verifySiwe = (message: string, signature: string) =>
  request<{ address: string }>("verify", { method: "POST", body: JSON.stringify({ message, signature }) }).then(
    (b) => b.address,
  )

export const fetchSession = () => request<{ address: string | null }>("me").then((b) => b.address)

export const logout = () => request<{ ok: true }>("logout", { method: "POST" })
