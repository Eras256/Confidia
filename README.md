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
│   ├── confidia-sdk/                # Core SDK (ESM + CJS dual build)
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
├── Dockerfile               # Production container image
├── fly.toml                 # Fly.io deployment config
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
| `NODE_ENV` | No | `development` | Set to `production` to disable test mode |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3001` | API base URL for the frontend |

See [`.env.example`](.env.example) for the full template.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/status` | Health check & identity |
| `GET` | `/confidia/contracts` | Deployed on-chain contract registry (IDs, network, RPC) |
| `POST` | `/domains/register` | Register a domain and discover its LCP |
| `GET` | `/domains` | List all registered domains |
| `POST` | `/agents/payments/execute` | Execute an agentic LCP-compliant payment |
| `POST` | `/confidia/distributions` | Create a private distribution with Merkle tree |
| `POST` | `/confidia/distributions/:id/activate` | Activate/deploy a distribution |
| `POST` | `/confidia/claims/submit` | Submit a payout claim with Merkle proof |
| `POST` | `/confidia/identity/providers/:provider/sync` | Sync OIDC provider JWK keys |
| `GET` | `/confidia/identity/keys` | List all cached JWK keys |
| `POST` | `/confidia/identity/keys/:kid/revoke` | Revoke a specific JWK key |
| `GET` | `/auth/challenge` | Request a SEP-10 authentication challenge |
| `POST` | `/auth/verify` | Verify a signed SEP-10 challenge and get JWT |

---

## Smart Contracts (Soroban)

The contracts live in a **Cargo workspace** (`contracts/`), one crate → one WASM
module → one deployment, so there are no duplicate-symbol collisions. All crates
are pinned to `soroban-sdk = "=20.0.0"`.

| Crate | Purpose |
|-------|---------|
| `gateway` | LCP-aware agentic payment gateway — `execute_payment` with SEP-41 transfers + compliance/verifier hooks |
| `vesting-claim` | ZK vesting vault — nullifier-protected `claim` with cross-contract JWK + verifier checks and SEP-41 settlement |
| `ultrahonk-verifier` | UltraHonk ZK verifier — admin-gated VK registry (`initialize`/`set_vk`/`get_vk`) + `verify_proof` (mirrors OpenZeppelin `ConfidentialVerifier`) |
| `compliance` | On-chain compliance engine — freeze controls + accreditation registry (admin-gated) |
| `jwk-registry` | On-chain OIDC JWK public-key store (`add_key`/`revoke_key`/`is_key_trusted`) |

> `vesting-claim` calls the JWK registry and verifier **by address** via
> locally-declared `#[contractclient]` traits — never by importing the sibling
> crates (that leaks their entrypoints and collides symbols).

> ⚠️ The verifier's `verify_proof` is a **deterministic testnet simulation**, not
> real BN254/Grumpkin pairing. See the [Technical Paper](./TECHNICAL_PAPER.md) for
> the production ZK path.

### Deployed on Stellar Testnet

| Contract | Contract ID |
|----------|-------------|
| Gateway | [`CANR7PCH…IAGJC`](https://stellar.expert/explorer/testnet/contract/CANR7PCHCLOP3YMGXPZVOBHIDNYLDVC3IPKRS52ZAPYUVCYQXHVIAGJC) |
| Vesting Claim Vault | [`CB26YAB5…MKIX`](https://stellar.expert/explorer/testnet/contract/CB26YAB57YURXLH5NF43AD4O2NSPSFUDXYDAUTKVLAERODRPSEZWMKIX) |
| UltraHonk Verifier | [`CBKTBGW2…DZPP`](https://stellar.expert/explorer/testnet/contract/CBKTBGW2PJRTRA2VDQVDUQFT2UVVMAWRCMQUJPUYVOPW6SQMFTNGDZPP) |
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

The Next.js dashboard provides a **10-tab interface** with full English/Spanish i18n:

1. **Overview** — Platform metrics and system status
2. **LCP Registry** — Register domains, discover Legal Context Protocols
3. **Agent Payments** — Execute ZK-compliant agentic payments with real-time console
4. **Confidential Tokens** — Pedersen-committed balance operations (deposit/merge/transfer/withdraw)
5. **Distributions** — Create Merkle-shielded distribution packages
6. **Claim Portal** — 7-step stepper wizard for recipients to claim payouts
7. **Identity Ops** — OIDC key synchronization and JWK management
8. **Transactions** — Full audit trail of all operations
9. **Security** — SEP-10 authentication and wallet connection
10. **Settings** — Network and configuration management

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

### Docker

```bash
docker build -t confidia .
docker run -p 3001:3001 -e NODE_ENV=production confidia
```

### Fly.io

```bash
fly deploy
```

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
