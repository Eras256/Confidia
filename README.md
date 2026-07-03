<p align="center">
  <strong>C O N F I D I A</strong><br/>
  <em>Private USD Distribution Rails on Stellar</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stellar-Soroban-blue?logo=stellar" alt="Stellar Soroban" />
  <img src="https://img.shields.io/badge/ZK-Noir%20%2F%20UltraHonk-9b59b6" alt="ZK Proofs" />
  <img src="https://img.shields.io/badge/Wallet-SEP--43%20%2F%20Stellar%20Wallets%20Kit-orange" alt="SEP-43 Wallets" />
  <img src="https://img.shields.io/badge/Auth-SEP--10%20%2F%20OIDC-green" alt="SEP-10 Auth" />
  <img src="https://img.shields.io/badge/Tokens-SEP--41%20(USDC%20%2F%20EURC)-yellow" alt="SEP-41 Tokens" />
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="License" />
</p>

<p align="center">
  <strong>🔗 Live demo: <a href="https://confidia.vercel.app">confidia.vercel.app</a></strong><br/>
  <sub>Dashboard on Vercel · contracts live on Stellar Testnet · try the <em>Security → Run Live Check</em> button</sub>
</p>

---

## Overview

Confidia is an **institutional-grade, zero-knowledge private distribution registry and compliant claim gateway** for tokenized dollars (USDC / EURC) on the [Stellar](https://stellar.org) network.

> *Tokenization solved issuance. Distribution is the bottleneck.*

Confidia enables institutions to deploy ZK-shielded vesting vaults, verify Web2 OIDC identities privately in the browser, and settle compliant payouts on-chain via Soroban smart contracts — all without exposing recipient PII to the ledger.

> 📄 For the protocol design, threat model, cryptographic constructions, and the
> production ZK roadmap, see the **[Technical Paper](./TECHNICAL_PAPER.md)**.

> [!NOTE]
> **Attribution** — Built on top of [OpenZeppelin's Confidential Token contract suite](https://github.com/OpenZeppelin/openzeppelin-contracts) (`feat/confidential-verifier-ultrahonk`) and [Nethermind's UltraHonk verifier](https://github.com/NethermindEth). Confidia adds the missing **distribution, claims, identity, legal, and audit layer** on top of the base confidential-balance primitive.
>
> *Confidential balances powered by OpenZeppelin Confidential Tokens (dev preview) + Nethermind UltraHonk verifier.*

**📦 The LCP client and policy engine are published on npm:**
[`confidia-sdk`](https://www.npmjs.com/package/confidia-sdk) — `npm install confidia-sdk`.
Real, dependency-free logic only (genuine HTTPS LCP discovery + SHA-256 terms
verification, compliance rule evaluation, SEP-10 helpers); see the
[package README](./packages/confidia-sdk/README.md) for what's deliberately
excluded and why.

---

## Key Value Propositions

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Private Identity Verification** | Recipients prove OIDC JWT eligibility locally via in-browser ZK proofs. Email addresses and credentials never go on-chain. |
| 2 | **Soroban On-Chain Settlements** | Smart contracts verify ZK membership proofs, check double-claim nullifiers, and release tokenized dollars through SEP-41 token transfers. |
| 3 | **Legal Compliance (LCP)** | Bridges real-world legal agreements and smart-contract conditions dynamically via the Legal Context Protocol. |
| 4 | **Confidential Transfers** | Pedersen-committed balances with optional auditor view-keys for compliance officers. |
| 5 | **Multi-Wallet Support (SEP-43)** | Connects via Stellar Wallets Kit — supports Freighter, xBull, Lobstr, Rabet, Albedo, and hardware wallets. |
| 6 | **SEP-10 Web Authentication** | Challenge/response Stellar authentication — no passwords, no sessions to store. |
| 7 | **Private Distributions** | Merkle-tree shielded recipient lists with ZK-proven claim eligibility. |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Confidia Platform                           │
├────────────┬───────────────┬───────────────┬───────────────────────┤
│  apps/web  │   apps/api    │  apps/worker  │ contracts/ (Soroban)  │
│  Next.js   │   Hono REST   │  BG Daemon   │  Rust + soroban-sdk   │
│  Dashboard │   Gateway     │  Key Rotation │  Claim / Verify / Pay │
├────────────┴───────────────┴───────────────┴───────────────────────┤
│                       packages/ (SDK Layer)                        │
│  confidia-sdk · config · merkle · distributions-sdk · jwt-sdk     │
│  zk-browser · vesting · ui · test-utils                           │
└────────────────────────────────────────────────────────────────────┘
          ▼                    ▼                     ▼
   Stellar Testnet      OIDC Providers         Legal Context
   (Horizon + Soroban)  (Google, GitHub)       Protocol (LCP)
```

---

## Repository Structure

```
confidia/
├── apps/
│   ├── web/                 # Next.js 14 dashboard portal
│   │   ├── src/app/         #   Main page with 10-tab UI
│   │   └── src/lib/         #   Wallet-kit + SEP-10 auth helpers
│   ├── api/                 # Hono REST API (port 3001)
│   │   └── src/server.ts    #   All endpoints: domains, payments, claims, identity
│   └── worker/              # Background compliance daemon
│       └── src/worker.ts    #   LCP cache, OIDC key sync, confidential audits
│
├── contracts/                         # Cargo workspace — one crate per contract
│   ├── Cargo.toml                     #   Workspace members + release profile
│   ├── .cargo/config.toml             #   MVP wasm feature pin (see Build notes)
│   ├── deployments.testnet.json       #   Canonical deployed contract-ID registry
│   ├── jwk-registry/                  #   On-chain OIDC JWK public-key store
│   ├── ultrahonk-verifier/            #   UltraHonk ZK verifier + VK registry
│   ├── compliance/                    #   Freeze controls + accreditation registry
│   ├── vesting-claim/                 #   ZK vesting vault, SEP-41 settlement
│   └── gateway/                       #   LCP-aware agentic payment gateway
│
├── packages/
│   ├── confidia-sdk/                # Published SDK (ESM + CJS): LcpClient, PolicyEngine, SEP-10 helpers
│   │                                 #   → npm install confidia-sdk
│   ├── confidia-legacy-sim/         # Private, never published — simulated ZK/confidential-transfer
│   │                                 #   logic behind the legacy /agents/payments/execute demo endpoint
│   ├── confidia-config/             # Network config, asset registry
│   ├── confidia-merkle/             # Merkle tree builder & verifier
│   ├── confidia-distributions-sdk/  # Distribution package preparation & proof verification
│   ├── confidia-jwt-sdk/            # OIDC JWT parsing, JWKS discovery, nullifier generation
│   ├── confidia-zk-browser/         # Client-side Noir ZK prover
│   ├── confidia-vesting/            # Vesting schedule utilities
│   ├── confidia-ui/                 # Shared UI components
│   └── confidia-test-utils/         # Mock Supabase client with file-backed persistence
│
├── .env.example             # Environment variable template
├── .gitignore               # Comprehensive exclusion rules
├── Dockerfile.api            # The API's real production image (deployed to Fly.io)
├── fly.api.toml              # Real Fly.io config for confidia-api (used by every deploy)
├── package.json             # Root workspace config
├── pnpm-workspace.yaml      # pnpm workspace definition
└── tsconfig.json            # Root TypeScript configuration
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 9
- **Rust** + `cargo` (for Soroban contract compilation)
- **Stellar CLI** (optional, for contract deployment)

### Install & Run

```bash
# 1. Clone
git clone https://github.com/Eras256/Confidia.git
cd Confidia

# 2. Install dependencies
pnpm install

# 3. Copy environment template
cp .env.example .env

# 4. Build all packages and apps
pnpm build

# 5. Start all services (API + Web + Worker)
pnpm dev
```

The dashboard opens at **http://localhost:3000** and the API listens on **http://localhost:3001**.

### Run Smart Contract Tests

```bash
pnpm test:contracts
```

### Run Full Monorepo Tests

```bash
pnpm test
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Production | `confidia_secret_key_*` | Secret key for signing JWT session tokens |
| `SEP10_SERVER_SECRET` | Production | Random ephemeral | Stellar secret key for SEP-10 challenge signing |
| `AGENT_SIGNING_KEY` | Production | Mock key | Stellar secret for agentic payment signing |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Recommended | none (falls back to file-backed mock) | Real Postgres persistence for the API — see `scripts/db/schema.sql` |
| `STELLAR_WALLET_SECRET` | Optional | none | Enables `POST /confidia/treasury/ensure-trustline` (server-signed `changeTrust` only — bounded blast radius) |
| `NODE_ENV` | No | `development` | Set to `production` to disable test mode |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3001` | API base URL for the frontend |

See [`.env.example`](.env.example) for the full template.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/status` | Health check, identity, and real persistence mode (`supabase` vs. `mock-file`) |
| `GET` | `/confidia/contracts` | Deployed on-chain contract registry (IDs, network, RPC) |
| `POST` | `/domains/register` | Register a domain — performs a real HTTPS fetch of its LCP document and a real SHA-256 hash check against its terms |
| `GET` | `/domains` | List all registered (real, hash-verified) domains |
| `POST` | `/confidia/treasury/ensure-trustline` | Server-signed `changeTrust` only — establishes a missing trustline before a SEP-41 deposit |
| `POST` | `/agents/payments/execute` | Legacy agentic-payment demo — its LCP step is real, everything downstream is simulated (see [`confidia-legacy-sim`](./packages/confidia-legacy-sim/README.md)); the live dashboard no longer calls this |
| `POST` | `/confidia/distributions` | Create a private distribution with a real computed Merkle tree |
| `GET` | `/confidia/distributions` | List all real distributions (backs the Overview tab's KPI) |
| `POST` | `/confidia/distributions/:id/activate` | Mark a distribution active after its root is registered on-chain |
| `GET` | `/confidia/claims` | List all real recorded claims (backs the Overview tab's KPI) |
| `POST` | `/confidia/claims/record` | Record evidence of a claim that already settled for real on-chain (called by the Claim Portal after a successful signed transaction — no Merkle check, the tx hash itself is the proof) |
| `GET` | `/agreements` · `/transactions` | Real agreements and settled transactions (Agreements & Audit Trail tab) |
| `POST` | `/confidia/agreements/record` | Bind a settled on-chain tx to a verified LCP domain as a real agreement — rejected unless the domain passed real LCP verification |
| `POST` | `/confidia/identity/providers/:provider/sync` | Sync real OIDC provider JWK keys (Google JWKS) |
| `GET` | `/confidia/identity/keys` | List all cached JWK keys |
| `POST` | `/confidia/identity/keys/:kid/revoke` | Revoke a specific JWK key |
| `GET` | `/auth/challenge` | Request a SEP-10 authentication challenge |
| `POST` | `/auth/verify` | Verify a signed SEP-10 challenge and get JWT |

> The Claim Portal itself calls **no API endpoint for the claim**: it signs and
> submits `claim()` directly to the vesting-claim vault via Freighter and the
> Soroban RPC, then best-effort posts to `/confidia/claims/record` purely so the
> Overview tab's counter reflects it.

---

## Smart Contracts (Soroban)

The contracts live in a **Cargo workspace** (`contracts/`), one crate → one WASM
module → one deployment, so there are no duplicate-symbol collisions. All crates
are pinned to `soroban-sdk = "=20.0.0"`.

| Crate | Purpose |
|-------|---------|
| `gateway` | LCP-aware agentic payment gateway — `execute_payment` with SEP-41 transfers + compliance/verifier hooks |
| `vesting-claim` | ZK vesting vault — nullifier-protected `claim` with cross-contract JWK + verifier checks and SEP-41 settlement |
| `ultrahonk-verifier` | Fast-path **simulation** verifier (SDK 20) for protocol testing. The **real** UltraHonk verification runs in a separate deployed contract — Nethermind's `rs-soroban-ultrahonk` (SDK 26, BN254); see [`contracts/real-verifier/`](./contracts/real-verifier/) |
| `compliance` | On-chain compliance engine — freeze controls + accreditation registry (admin-gated) |
| `jwk-registry` | On-chain OIDC JWK public-key store (`add_key`/`revoke_key`/`is_key_trusted`) |

> `vesting-claim` calls the JWK registry and verifier **by address** via
> locally-declared `#[contractclient]` traits — never by importing the sibling
> crates (that leaks their entrypoints and collides symbols).

> **ZK verification — real, live on Testnet (not a simulation):**
> A genuine UltraHonk proof is verified **on-chain** by Nethermind's
> `rs-soroban-ultrahonk` (soroban-sdk 26, BN254 host functions — the exact backend of
> OpenZeppelin's `ConfidentialVerifier`), deployed at
> [`CAM2WWTB…IW6J`](https://stellar.expert/explorer/testnet/contract/CAM2WWTBWGNJBCB7J5LE76H2NUIXIO7VPJCKILY7SMORLPQ5HOGMIW6J).
> A real 14,592-byte proof `verify_proof(...) → Ok`; a proof with **one byte flipped**
> reverts with `VerificationFailed (#4)`. Artifacts + reproducer:
> [`contracts/real-verifier/`](./contracts/real-verifier/); details:
> [Technical Paper §9](./TECHNICAL_PAPER.md).
>
> **End-to-end proven — the same vault the live Claim Portal uses:**
> [`CCKUOWDY…RMPWYM`](https://stellar.expert/explorer/testnet/contract/CCKUOWDYYKLZLZ3MO4URUC5U5AJOTMVFS4TJO5V7AJZ3IKPFURMRPWYM),
> initialized with the real verifier, is funded and exercised on-chain by the
> dashboard's four Claim Portal scenarios: **Happy Path** settles real funds via
> SEP-41; **Untrusted Key**, **Tampered Proof**, and **Replay** are all rejected —
> not by the vault reverting after submission, but by Soroban's own pre-flight
> simulation refusing to submit a call that will certainly fail, before any
> signature is even requested. That's real evidence with no tx hash by design,
> and the UI says so instead of fabricating one.
>
> **Verify it yourself** (only the `stellar` CLI needed — no Noir/Barretenberg, no
> recompile): `bash contracts/real-verifier/scripts/e2e_testnet.sh`. It funds a fresh
> Friendbot key and asserts every case above. Demo storyboard: [`DEMO.md`](./DEMO.md).
>
> `contracts/ultrahonk-verifier` (soroban-sdk 20) remains as a labeled fast-path
> **simulation** for protocol testing.

### Deployed on Stellar Testnet

| Contract | Contract ID |
|----------|-------------|
| **Real UltraHonk Verifier** (Nethermind, SDK 26, BN254) | [`CAM2WWTB…IW6J`](https://stellar.expert/explorer/testnet/contract/CAM2WWTBWGNJBCB7J5LE76H2NUIXIO7VPJCKILY7SMORLPQ5HOGMIW6J) |
| Gateway | [`CANR7PCH…IAGJC`](https://stellar.expert/explorer/testnet/contract/CANR7PCHCLOP3YMGXPZVOBHIDNYLDVC3IPKRS52ZAPYUVCYQXHVIAGJC) |
| Vesting Claim Vault | [`CCKUOWDY…RMPWYM`](https://stellar.expert/explorer/testnet/contract/CCKUOWDYYKLZLZ3MO4URUC5U5AJOTMVFS4TJO5V7AJZ3IKPFURMRPWYM) |
| UltraHonk Verifier (SDK 20, simulation) | [`CBKTBGW2…DZPP`](https://stellar.expert/explorer/testnet/contract/CBKTBGW2PJRTRA2VDQVDUQFT2UVVMAWRCMQUJPUYVOPW6SQMFTNGDZPP) |
| Compliance Hook | [`CBI3U4KZ…3DLF`](https://stellar.expert/explorer/testnet/contract/CBI3U4KZGVISV7PDGICBAHBSNYL7FEMJ7HL2GLTNHZXRPCLVTQOP3DLF) |
| JWK Registry | [`CCE7XJSY…KABR`](https://stellar.expert/explorer/testnet/contract/CCE7XJSY5NQVI62YISRNZMCIVZGVCJ47WB3NDF5NLJIFMX3UUK62KABR) |

The API serves this registry at `GET /confidia/contracts`; the dashboard's
**Security** tab renders it live and can invoke `verify_proof` / `is_authorized`
on-chain via the Soroban RPC ("Run Live Check").

### Build & Deploy

```bash
pnpm build:contracts     # cargo build (wasm32, release, MVP feature set via -Z build-std)
pnpm test:contracts      # native cargo test
pnpm deploy:contracts    # build + deploy + initialize all 5 on Testnet
```

> **Build note:** Soroban's VM only accepts MVP WebAssembly, but Rust 1.82+ ships
> a precompiled `std` with `reference-types`/`multivalue` enabled. The build
> recompiles `std` MVP-clean with `-Z build-std` on nightly and disables those
> features via `RUSTFLAGS` (see `contracts/README.md`). `deploy:contracts`
> requires `STELLAR_WALLET_SECRET` in `.env`.

---

## Dashboard Features

The Next.js dashboard provides a **10-tab interface** with full English/Spanish i18n.
Every number and chart is derived from real Supabase-backed data or a live
on-chain read — nothing is a static placeholder:

1. **Overview** — Real KPIs (active distributions, settled volume, LCP
   compliance ratio, on-chain-verified claims) and two charts (a 7-day
   settled-transaction count, a volume-by-asset breakdown), all computed from
   live data, not hardcoded numbers.
2. **Distributions** — Prepare a Merkle-shielded recipient package, then
   register its root on the vesting-claim vault via a real Freighter-signed
   `initialize()` transaction.
3. **Claim Portal** — A real, Freighter-signed `claim()` call against the
   funded vesting-claim vault, verified by the real Nethermind UltraHonk
   verifier. Four scenarios exercise genuinely different on-chain code paths:
   *Happy Path* settles real funds; *Untrusted Key*, *Tampered Proof*, and
   *Replay* are all rejected by Soroban's own pre-flight simulation before any
   signature is requested — so there's no tx hash for those three by design,
   and the UI shows the real RPC diagnostic instead of fabricating one.
4. **Confidential Treasury** — A real SEP-41 deposit signed by the connected
   wallet, using whatever asset it actually holds (read live from Horizon).
   Missing trustlines are established automatically before the payment.
5. **Identity Ops** — Register and revoke OIDC signing keys on-chain in the
   JWK registry — both real, Freighter-signed transactions with a stellar.expert
   evidence link.
6. **Legal Context** — Register a counterparty domain: a real HTTPS fetch of
   its `.well-known/legal-context.json` plus a real SHA-256 hash check against
   its terms document. A domain with no real LCP document is correctly
   rejected — try `confidia.vercel.app` (passes) against any other domain
   (genuinely fails).
7. **Agreements & Audit Trail** — Real settled transactions and LCP
   agreements, populated only when a real on-chain action is bound to a
   verified domain.
8. **Security & Audits** — Live read-only (`simulateTransaction`) and signed
   verification checks against the deployed verifier and compliance contracts.
9. **Docs** — The live contract registry, REST API reference, and reproducer
   commands.
10. **Settings** — Operator preferences, persisted to local storage.

---

## Wallet Integration (SEP-43)

Confidia uses [`@creit-tech/stellar-wallets-kit`](https://github.com/nicholasgasior/stellar-wallets-kit) implementing the **SEP-43** standard for unified multi-wallet support:

- Freighter
- xBull
- Lobstr
- Rabet
- Albedo
- Hardware wallets (Ledger)

---

## Deployment

This is how the live deployment actually works — two separate services, not
one combined container:

### API → Fly.io

The API is a standalone Docker image (`Dockerfile.api`, Node 22 — needed for
`@supabase/supabase-js`'s realtime client) deployed to Fly.io:

```bash
fly deploy -c fly.api.toml -a confidia-api --remote-only
```

Live at [confidia-api.fly.dev](https://confidia-api.fly.dev).

### Dashboard → Vercel

The Next.js dashboard builds as a static export (`output: "export"`, see
`apps/web/next.config.mjs`) and deploys as plain static files — no Next.js
server runtime:

```bash
vercel deploy --prod
```

Live at [confidia.vercel.app](https://confidia.vercel.app).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| API | Hono (Node.js) |
| Smart Contracts | Rust, Soroban SDK 20.0.0 |
| ZK Proofs | Noir, UltraHonk |
| Blockchain | Stellar (Testnet / Mainnet) |
| Wallet | Stellar Wallets Kit (SEP-43) |
| Auth | SEP-10 Web Authentication |
| Tokens | SEP-41 Token Interface |
| Package Manager | pnpm 9 workspaces |
| Confidential Balances | OpenZeppelin Confidential Tokens + Nethermind UltraHonk |

---

## License

MIT © 2026 Confidia Contributors

---

<p align="center">
  <sub>Confidential balances powered by <a href="https://github.com/OpenZeppelin/openzeppelin-contracts">OpenZeppelin Confidential Tokens</a> (dev preview) + <a href="https://github.com/NethermindEth">Nethermind UltraHonk</a> verifier.</sub>
</p>
