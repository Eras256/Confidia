# Confidia — Soroban Smart Contracts

A Cargo **workspace** of five independent Soroban contracts that back Confidia's
private USD distribution rails. Each contract compiles to its own WASM module and
is deployed separately, so there are no duplicate-symbol collisions in a shared
namespace.

> Built against `soroban-sdk =20.0.0` (pinned — see root `CLAUDE.md`).

---

## 📁 Workspace layout

| Crate | WASM | Role |
|-------|------|------|
| [`jwk-registry`](./jwk-registry) | `jwk_registry.wasm` | On-chain OIDC JWK public-key store (`add_key` / `revoke_key` / `is_key_trusted`). |
| [`ultrahonk-verifier`](./ultrahonk-verifier) | `ultrahonk_verifier.wasm` | UltraHonk ZK verifier. Admin-gated VK registry (`initialize` / `set_vk` / `get_vk`) + `verify_proof`. Mirrors OpenZeppelin's `ConfidentialVerifier`. |
| [`compliance`](./compliance) | `compliance.wasm` | Freeze controls + accreditation registry (`is_authorized` / `set_frozen` / `check_accreditation`). |
| [`vesting-claim`](./vesting-claim) | `vesting_claim.wasm` | Vault holding distribution funds; processes nullifier-protected `claim`s after cross-contract JWK + verifier checks. |
| [`gateway`](./gateway) | `gateway.wasm` | LCP-aware agentic payment gateway (`execute_payment`) with SEP-41 transfers + compliance/verifier hooks. |

### Cross-contract calls (important)

`vesting-claim` calls the JWK registry and the verifier **by address** using
locally-declared `#[contractclient]` traits (`JwkRegistryClient`,
`UltrahonkVerifierClient`). It does **not** depend on those sibling crates,
because linking a sibling contract crate re-exports its `#[contractimpl]`
entrypoints into this vault's WASM and collides with the vault's own functions
(e.g. a duplicate `initialize`). Keep external interfaces as `#[contractclient]`
trait declarations — never `use` another contract crate for its client.

> On the verifier / VK model: the original code had **two** verifier crates
> (`verifier` + `ultrahonk-verifier`). They were merged into `ultrahonk-verifier`,
> which now carries both the admin/VK-registry surface and `verify_proof`.

⚠️ The verifier's `verify_proof` is a **deterministic testnet simulation** (checks
proof length and scans for an `"invalid"` marker), not real BN254/Grumpkin pairing
verification. Swap its body for `env.crypto()` pairing against the stored VK for
production.

---

## 🛠️ Build

Soroban's VM only accepts **MVP WebAssembly**. Rust 1.82+ ships a precompiled
`std` with `reference-types`/`multivalue` enabled, so a plain
`cargo build --target wasm32-unknown-unknown` links opcodes the VM rejects
(`reference-types not enabled: zero byte expected`). We recompile `std` MVP-clean
with `-Z build-std` on a nightly toolchain and disable the features via
`RUSTFLAGS`:

```bash
# From the repo root:
pnpm build:contracts
# equivalent to:
RUSTFLAGS="-C target-feature=-reference-types,-multivalue" \
  cargo +nightly-2025-02-04 build \
  --manifest-path contracts/Cargo.toml \
  --target wasm32-unknown-unknown --release \
  -Z build-std=std,panic_abort
```

`contracts/.cargo/config.toml` also pins the wasm target's `RUSTFLAGS` for plain
`cargo build`. Override the nightly with `CONFIDIA_WASM_TOOLCHAIN`.

## 🧪 Test

```bash
pnpm test:contracts     # cargo test --manifest-path contracts/Cargo.toml (native host build)
```

## 🚀 Deploy (Stellar Testnet)

```bash
pnpm deploy:contracts             # build (build-std) + deploy + initialize all 5
node packages/confidia-sdk/scripts/deploy.js --skip-build   # deploy already-built wasm
```

The script requires `STELLAR_WALLET_SECRET` (deployer secret) in `.env`. It writes
the resulting contract IDs to:

- `contracts/deployments.testnet.json` — canonical registry
- `.env` — `*_CONTRACT_ID` variables
- `db.json` — `contract_registry` table (served to the API/frontend)

The API exposes the registry at `GET /confidia/contracts`, and the dashboard's
**Security** tab renders the live addresses with explorer links.
