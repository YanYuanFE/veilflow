<p align="center">
  <img src="public/logo.svg" width="240" alt="VeilFlow" />
</p>

<p align="center">
  <strong>The confidential token distribution console.</strong><br/>
  Airdrops · vesting · disperse — with every amount encrypted end-to-end.
</p>

<p align="center">
  Built on the <a href="https://docs.tokenops.xyz">TokenOps SDK</a> &amp; <a href="https://www.zama.ai">Zama FHE</a>
  · ERC-7984 · Sepolia
</p>

---

## What is VeilFlow?

VeilFlow is a single console for any shape of **confidential** token distribution. An issuer connects a
wallet, picks an instrument (**Airdrop**, **Vesting**, or **Disperse**), points it at a confidential
ERC-7984 token, and distributes it — while the **amounts stay encrypted on-chain**. Recipients open a
branded claim page and see only their own figure, which they decrypt with their wallet. Issuers can grant
an auditor read-only access to a single figure for compliance.

The amounts are never public, and — the red line — **the plaintext never leaves the issuer's browser.**

## Why confidential

Public chains leak amounts: airdrops get farmed and front-run, investor positions are exposed, payroll is
on display. VeilFlow encrypts the amount in the browser using [Zama's FHE](https://www.zama.ai) and
[ERC-7984](https://eips.ethereum.org/) confidential tokens. The backend only ever sees **ciphertext
artifacts, addresses, and signatures** — never a plaintext amount. Worst case if the convenience layer is
breached: brand defaced, never your figures, never your funds.

## Features

| Instrument | Issuer flow | Recipient |
| --- | --- | --- |
| **Airdrop** | Signature-authorized claims; each amount encrypted to the recipient | Reveal + claim at `/claim/:slug` |
| **Vesting** | Linear unlock (cliff, initial release); batch-created in one tx | Claim the vested portion over time |
| **Disperse** | One encrypted batch, sent directly | Lands in the confidential balance — no claim |

- **Redaction reveal** — every encrypted figure renders as a classified-document **censor bar** that lifts
  (clip-path wipe) only when the holder decrypts it. The FHE action, made visible.
- **Selective disclosure** — grant a named auditor read-only access to one vesting figure (total / vested /
  claimable / settled). Irreversible (ACL append-only) — confirmed before granting. Auditors reverse-look-up
  what was disclosed to them.
- **Branded, standalone claim pages** — `/claim/:slug` is its own customer-facing page with a per-distribution
  **theme** (light/dark, brand accent, logo, tagline). No app chrome.
- **Lifecycle stepper + reconciliation** — resumable Configure → Deploy → Add recipients → Live flow, with
  balance reveal and per-batch totals so claims never fail under-funded.
- **Admin controls** — pause / extend the claim window / withdraw remaining (airdrop).
- **My claims** — recipients reverse-look-up allocations addressed to their wallet; copy + QR share for issuers.

## How it works

```
┌──────────────────────────────────────────────────────────────┐
│ Frontend SPA (React + Vite + Tailwind + wagmi + zama react-sdk)│
│   ★ FHE encryption happens in the browser — plaintext stays ★  │
└───┬───────────────────────┬───────────────────────────────────┘
    │ @tokenops/sdk          │ fetch('/api/…') (same origin)
    ▼                        ▼
┌───────────────────────┐ ┌──────────────────────────────────────┐
│ TokenOps SDK contracts │ │ Vercel /api functions                 │
│ Airdrop · Vesting ·    │ │  metadata · slug · status · theme     │
│ Disperse (on fhEVM)    │ │  ciphertext artifacts · disclosures   │
└──────────┬────────────┘ │  ✗ never plaintext amounts            │
           ▼              └────────────────┬─────────────────────┘
   ┌────────────────────────┐              ▼
   │ Zama fhEVM (Sepolia)    │      ┌──────────────────┐
   │ ERC-7984 · FHE · ACL    │      │ Neon Postgres     │
   └────────────────────────┘      │ (Drizzle ORM)     │
                                    └──────────────────┘
```

| Layer | Holds | Guarantee |
| --- | --- | --- |
| **On-chain** | SDK contracts, encrypted balances, claim authorization | Funds can't be stolen; claims verified by the contract |
| **Backend** | metadata, slug, status, theme, ciphertext artifacts, addresses | **Never plaintext amounts**; can't forge a claim |
| **Client only** | plaintext amounts (encrypted on the spot), the holder's decrypted view | Plaintext never leaves the browser |

## Tech stack

- **Frontend** — React 19 · Vite · Tailwind v4 · shadcn/ui · wagmi · viem · RainbowKit ·
  `@zama-fhe/react-sdk` · `@tanstack/react-query`
- **Distribution** — `@tokenops/sdk` (fhe-airdrop / fhe-vesting / fhe-disperse) on Zama fhEVM, ERC-7984
- **Backend** — Vercel serverless `/api` functions + Neon Postgres + Drizzle ORM (front + back, one deploy)
- **Design** — editorial "Confidential Instrument" system: Libre Caslon · Schibsted Grotesk · Fragment Mono,
  warm paper / ink / a single gold seal, the redaction bar as the core primitive
- **Chain** — Sepolia

## Getting started

**Prerequisites:** Node 22+, pnpm, a [Neon](https://neon.tech) (or any Postgres) database.

```bash
pnpm install

# 1. Configure the database (front + back share one Vercel/Neon project)
echo 'DATABASE_URL="postgres://…"' > .env

# 2. Create the schema
pnpm db:push          # or: pnpm db:generate && pnpm db:migrate

# 3. Run — the /api functions run in-process on :5173 (no `vercel dev` needed)
pnpm dev

# Build
pnpm build
```

Then mint a test ERC-20, wrap it into a confidential token on **/wrap**, and create a distribution on
**/create**. The Sepolia RPC is hard-coded (Tenderly gateway) in `src/lib/config.ts`.

## Project structure

```
src/
  routes/        home · dashboard · create · distribution (d/:id) · claim/:slug · claims · audit · wrap · unwrap
  components/    ui/ (shadcn + redaction, datetime-picker, …) · editorial · stepper · share-claim · …
  lib/           api · tokens · theme · lifecycle · format · wagmi · config
api/             distributions/ · disclosures/ (Vercel functions) · _schema (Drizzle) · _db · _http
vite.config.ts   dev plugin: runs /api in-process for plain `pnpm dev`
```

## Contracts & tokens (Sepolia)

| | Address |
| --- | --- |
| Airdrop factory | `0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c` |
| Disperse singleton | `0x710dD9885Cc9986EfD234E7719483147a6d8DBb4` |
| WrappersRegistry | `0x2f0750Bbb0A246059d80e94c454586a7F27a128e` |
| cUSDT (confidential) ⭐ | `0x4E7B06D78965594eB5EF5414c357ca21E1554491` |

All confidential tokens use 6 decimals (Zama convention). The vesting factory is resolved by chain id via
the SDK.

## Acknowledgements

Built for the **Zama Developer Program — Mainnet Season 3 · TokenOps Special Bounty**. Distribution
contracts and FHE primitives are provided by the [TokenOps SDK](https://docs.tokenops.xyz) and
[Zama](https://www.zama.ai); VeilFlow is the unified experience layer on top.

## License

MIT
