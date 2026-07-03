# Confidia — Private USD Distribution Rails on Stellar

**A Technical Paper**

*Version 1.0 — July 2026*

---

## Abstract

Tokenization has largely solved the *issuance* of digital dollars: USDC and
a growing set of regulated stablecoins settle instantly on public ledgers.
*Distribution*, however, remains the bottleneck. Paying contributors, running
confidential payroll, or releasing investor allocations on a transparent ledger
leaks recipient identity, amounts, and timing to anyone with a block explorer.

Confidia is an institutional-grade layer for **private, compliant distribution of
tokenized USD on Stellar**. It combines (1) browser-side zero-knowledge proofs of
Web2 (OIDC) identity, (2) Merkle-shielded recipient sets, (3) a family of Soroban
smart contracts that gate SEP-41 token settlement on proof validity and
double-claim protection, and (4) a Legal Context Protocol (LCP) that binds
on-chain actions to off-chain legal agreements. The result: recipients prove they
are entitled to a payout without ever revealing their email, wallet linkage, or
allocation to the public ledger, while issuers retain auditor view-keys and
regulatory controls.

Zero-knowledge verification here is **real, not simulated**: a genuine UltraHonk
proof is verified **on-chain on Stellar Testnet** by Nethermind's
`rs-soroban-ultrahonk` (BN254 pairing over `soroban-sdk 26` host functions — the
exact backend of OpenZeppelin's `ConfidentialVerifier`), and a proof with a single
byte flipped is rejected with `VerificationFailed` (§9).

This paper describes the protocol architecture, the on-chain contract suite, the
cryptographic constructions, the identity and compliance flows, the build/deploy
methodology, the threat model, and — explicitly — which parts are real versus
simulated, with the roadmap to full production zero-knowledge claims.

---

## 1. Motivation

Public-ledger transparency is a feature for settlement finality and a liability for
distribution. Consider three canonical flows:

- **Contributor grants / payroll.** A DAO or company paying 500 contributors in
  USDC exposes each recipient's address, amount, and cadence. Competitors infer
  headcount and compensation; recipients are doxxed.
- **Investor allocations / vesting.** Cliff and linear-release schedules on-chain
  reveal cap-table structure and unlock timing, inviting front-running.
- **Agentic payments.** Autonomous agents transacting on behalf of a principal
  need per-payment authorization bound to a legal agreement, not a blanket key.

The industry's answer to *balance* privacy — confidential tokens with Pedersen
commitments and ZK transfers (e.g., OpenZeppelin's Confidential Token suite with a
Nethermind UltraHonk verifier) — is necessary but not sufficient. It hides
*amounts*, not the *eligibility and identity* logic that distribution requires.
Confidia adds the missing **distribution, claims, identity, legal, and audit
layer** on top of the confidential-balance primitive.

---

## 2. System Overview

```
        Recipient browser                     Issuer / Operator
   ┌───────────────────────┐            ┌──────────────────────────┐
   │  OIDC login (Google)  │            │  Create distribution     │
   │  In-browser ZK prover │            │  Merkle-shield recipients│
   │  (Noir / UltraHonk)   │            │  Fund vesting vault      │
   └──────────┬────────────┘            └───────────┬──────────────┘
              │ proof + nullifier + kid              │ root, allocations
              ▼                                      ▼
   ┌───────────────────────────────────────────────────────────────┐
   │                    apps/api  (Hono REST)                       │
   │  SEP-10 auth · LCP resolution · Merkle verification · registry │
   └──────────┬───────────────────────────────────────┬────────────┘
              │ invoke (Freighter-signed / RPC)        │ serve registry
              ▼                                        ▼
   ┌───────────────────────────────────────────────────────────────┐
   │                 contracts/  (Soroban, Rust)                    │
   │  gateway · vesting-claim · ultrahonk-verifier · compliance ·   │
   │  jwk-registry                    → SEP-41 USDC settlement      │
   └───────────────────────────────────────────────────────────────┘
```

The platform is a pnpm monorepo:

- **`apps/web`** — Next.js 14 dashboard (wallet connection via SEP-43 Stellar
  Wallets Kit, SEP-10 authentication, a real on-chain Claim Portal, live
  on-chain verification).
- **`apps/api`** — Hono REST gateway (LCP resolution, Merkle proof verification,
  OIDC JWK sync, contract registry).
- **`apps/worker`** — background daemon (OIDC key rotation, LCP cache, compliance
  audits).
- **`contracts/`** — five independent Soroban contracts (§3).
- **`packages/`** — SDKs for config, Merkle trees, distributions, JWT/OIDC,
  in-browser ZK proving, vesting math, and shared UI. `confidia-sdk` — the LCP
  client and compliance policy engine — is published on npm:
  [`npmjs.com/package/confidia-sdk`](https://www.npmjs.com/package/confidia-sdk).

---

## 3. On-Chain Contract Suite

Each contract is an independent Cargo workspace member compiling to its own WASM
module. This is deliberate: Soroban exports every `#[contractimpl]` function as a
WASM entrypoint, so co-compiling multiple contracts into one module collides
symbols (e.g., two `initialize` functions). One crate → one module → one
deployment eliminates the collision class entirely.

### 3.1 `jwk-registry`

On-chain store of OIDC provider public keys, indexed by JWK Key ID (`kid`).

```rust
add_key(kid, n, e, alg)      // register a provider signing key
revoke_key(kid)              // mark a key revoked (rotation / compromise)
is_key_trusted(kid) -> bool  // consulted by the vault at claim time
```

Binding the accepted `kid` set on-chain means a claim proof is only honored if it
was signed under a key the issuer currently trusts — closing the window on stale
or rotated Google/GitHub keys.

### 3.2 `ultrahonk-verifier`

The zero-knowledge verifier, modeled on OpenZeppelin's `ConfidentialVerifier`
registry. It holds an admin-gated verification key (VK) and exposes proof
verification:

```rust
initialize(admin)            // register the VK-rotation authority
set_vk(admin, vk)            // install / rotate the UltraHonk VK  (admin only)
get_vk() -> Option<Bytes>
verify_proof(proof, public_inputs) -> bool
```

An earlier design carried two verifier crates (a stateless one and a VK-registry
one). They were **merged** into this single contract to remove the duplication
while preserving the OZ-style registry surface.

This SDK-20 contract is a **labeled fast-path simulation** used to exercise the
surrounding protocol. The **real** cryptographic verification runs in a separate
contract — Nethermind's `rs-soroban-ultrahonk` (soroban-sdk 26), which performs
genuine UltraHonk verification over BN254 host functions and is **live on Testnet**
(§9). `vesting-claim` calls that real verifier by address.

### 3.3 `vesting-claim`

The vault that custodies distribution funds and settles claims. It is the only
contract that performs cross-contract calls.

```rust
initialize(root, token, verifier, jwk_registry)
claim(proof, public_inputs, recipient, nullifier, kid, amount) -> bool
```

`claim` enforces, in order: (1) the `nullifier` has not been spent (persistent
storage guard against double-claims); (2) `jwk_registry.is_key_trusted(kid)`;
(3) `verifier.verify_proof(proof, public_inputs)`; then transfers `amount` of the
funding asset to `recipient` via the SEP-41 token interface and records the
nullifier.

Critically, the external contracts are referenced **by address** through locally
declared `#[contractclient]` traits (`JwkRegistryClient`, `UltrahonkVerifierClient`),
*not* by depending on the sibling crates. Depending on a sibling contract crate
would re-export its entrypoints into the vault's WASM and re-introduce the symbol
collision (§3, and observed empirically during development as a shadowed
`initialize`).

### 3.4 `compliance`

An admin-gated allow/deny and accreditation engine.

```rust
initialize(admin)
is_authorized(account) -> bool          // false iff frozen
set_frozen(admin, account, freeze)      // admin only
set_registry_rule(admin, entity, accredited_required)
check_accreditation(account) -> bool
```

This is the on-chain enforcement point for freezes and jurisdiction/accreditation
rules that the LCP layer (§5) resolves off-chain.

### 3.5 `gateway`

An LCP-aware agentic payment gateway. `execute_payment` requires the sender's
authorization, optionally validates a confidential-mode ZK proof, performs the
SEP-41 transfer, and emits an LCP agreement-acceptance event binding the payment
to an Agreement Terms Reference (ATR) hash.

---

## 4. Cryptographic Constructions

### 4.1 Merkle-shielded recipient sets

A distribution's recipient list is committed as a Merkle tree; only the root is
published. Each recipient receives an inclusion proof for their leaf
(`H(email ∥ wallet ∥ amount ∥ salt)`). The API verifies inclusion against the
stored root before a claim proceeds, so the full recipient set never appears on
the ledger. (`packages/confidia-merkle`, `packages/confidia-distributions-sdk`.)

### 4.2 Nullifiers (double-claim protection)

Each claim carries a `nullifier` derived deterministically from the recipient's
identity and the distribution context. The vault stores spent nullifiers in
persistent storage and rejects any repeat — guaranteeing at-most-once settlement
without linking the nullifier back to an identity.

### 4.3 OIDC → ZK identity binding

The recipient authenticates with a Web2 provider (e.g., Google) and obtains a
signed JWT. In the browser, a Noir/UltraHonk circuit proves knowledge of a JWT:
(a) signed under a `kid` present in the on-chain `jwk-registry`, (b) whose `sub`
maps to an authorized leaf, without revealing the email or token. The public
inputs bind the proof to the nullifier and distribution root; the private inputs
(JWT, signature, claims) never leave the client.
(`packages/confidia-jwt-sdk`, `packages/confidia-zk-browser`.)

### 4.4 Confidential balances (inherited primitive)

For amount privacy, Confidia builds on the confidential-token model: balances as
unchunked Pedersen commitments on the Grumpkin curve, state transitions proven
with UltraHonk, and per-transfer ephemeral ECDH so recipients and designated
auditors can recover plaintext. This provides *confidentiality, not anonymity* —
addresses remain visible, amounts are hidden — and preserves auditor view-keys for
compliance.

---

## 5. Legal Context Protocol (LCP)

Distribution is a legal act, not just a transfer. LCP resolves a domain's legal
terms (discovered via DNS/well-known metadata) into an **Agreement Terms
Reference (ATR)** hash. The `gateway` emits this hash on payment, producing an
on-chain, tamper-evident record that a specific settlement occurred *under* a
specific version of a legal agreement. Policies (max amounts, required proofs,
allowed jurisdictions) are enforced by the `compliance` contract and the API's
policy engine.

---

## 6. Build Correctness: MVP WebAssembly

Soroban's VM validates contract modules against the **MVP** WebAssembly feature
set. Since Rust 1.82, the `wasm32-unknown-unknown` target ships a *precompiled*
`std` with `reference-types` and `multivalue` enabled by default. A plain
`cargo build --release` therefore links post-MVP opcodes that the VM rejects at
deploy time:

```
HostError: Error(WasmVm, InvalidAction)
  Validate(... "reference-types not enabled: zero byte expected" ...)
```

Disabling the features on the *contract* crates is insufficient because the
offending opcodes originate in precompiled `std`. Neither `-Ctarget-cpu=mvp` nor
crate-level `target-feature=-reference-types` removes them. Confidia's build
recompiles `std` itself, MVP-clean:

```bash
RUSTFLAGS="-C target-feature=-reference-types,-multivalue" \
  cargo +nightly-<pinned> build --target wasm32-unknown-unknown --release \
  -Z build-std=std,panic_abort
```

This is wired into `pnpm build:contracts` and `pnpm deploy:contracts`, with the
wasm-target RUSTFLAGS also pinned in `contracts/.cargo/config.toml`.

---

## 7. Deployment

The five contracts are deployed and initialized on **Stellar Testnet** by
`packages/confidia-sdk/scripts/deploy.js`, which builds (via build-std), deploys
each module, initializes them in dependency order, and writes the resulting IDs to
`contracts/deployments.testnet.json`, `.env` (`*_CONTRACT_ID`), and the frontend
`apps/web/.env.local` (`NEXT_PUBLIC_*_CONTRACT_ID`).

| Contract | Testnet Contract ID |
|----------|---------------------|
| **Real UltraHonk Verifier** (Nethermind, SDK 26, BN254) | `CAM2WWTBWGNJBCB7J5LE76H2NUIXIO7VPJCKILY7SMORLPQ5HOGMIW6J` |
| Gateway | `CANR7PCHCLOP3YMGXPZVOBHIDNYLDVC3IPKRS52ZAPYUVCYQXHVIAGJC` |
| Vesting Claim Vault | `CCKUOWDYYKLZLZ3MO4URUC5U5AJOTMVFS4TJO5V7AJZ3IKPFURMRPWYM` |
| UltraHonk Verifier (SDK 20, simulation) | `CBKTBGW2PJRTRA2VDQVDUQFT2UVVMAWRCMQUJPUYVOPW6SQMFTNGDZPP` |
| Compliance Hook | `CBI3U4KZGVISV7PDGICBAHBSNYL7FEMJ7HL2GLTNHZXRPCLVTQOP3DLF` |
| JWK Registry | `CCE7XJSY5NQVI62YISRNZMCIVZGVCJ47WB3NDF5NLJIFMX3UUK62KABR` |

The API serves this registry at `GET /confidia/contracts`. The dashboard consumes
it two ways: live via the API, and via build-time `NEXT_PUBLIC_*` fallback so
addresses render even when the API is offline. The **Security** tab's "Run Live
Check" invokes `verify_proof` and `is_authorized` against these deployments
through the Soroban RPC (read-only `simulateTransaction` — no fees or signature),
returning the real on-chain results.

---

## 8. Threat Model & Security

| Threat | Mitigation |
|--------|-----------|
| Double claim | Persistent nullifier set in `vesting-claim`; second use reverts |
| Stale / rotated OIDC key | `jwk-registry.is_key_trusted(kid)` checked at claim time; `revoke_key` on rotation |
| Recipient-set disclosure | Only the Merkle root is on-chain; leaves stay off-ledger |
| Identity / amount leakage | Browser-side ZK proof; email & JWT never leave the client; confidential-balance commitments |
| Unauthorized admin action | `require_auth` + registered-admin equality checks on `set_vk`, `set_frozen`, `set_registry_rule` |
| Sanctioned / frozen account | `compliance.is_authorized` gate |
| Secret exposure in repo | `.env`, `.env.local`, `db.json` git-ignored; signing keys only in env vars; deployer secret imported into Freighter, never shipped client-side |
| Legal non-repudiation | LCP ATR-hash event emitted on settlement |

Signing keys (`JWT_SECRET`, `SEP10_SERVER_SECRET`, `AGENT_SIGNING_KEY`,
`STELLAR_WALLET_SECRET`) are provided exclusively via environment variables with
local-dev fallbacks; production disables mock mode via `NODE_ENV=production`.

---

## 9. ZK Verification: Real vs. Simulated (explicit status)

Confidia ships **two** verifier paths, and we are explicit about which is which
because honesty about work-in-progress matters more than a polished mystery.

**(a) Simulated verifier — `contracts/ultrahonk-verifier` (soroban-sdk 20).**
Its `verify_proof` is a deterministic stand-in: it accepts well-formed proofs
(length-bounded, no injected `"invalid"` marker) rather than performing real
pairing verification. It exists so the *surrounding protocol* — registry lookup,
verification gate, nullifier recording, SEP-41 settlement — is exact and testable
end-to-end today. It is **not** cryptographic verification and is labeled as such
in code, README, and the live dashboard.

**(b) Real verifier — Nethermind `rs-soroban-ultrahonk` (soroban-sdk 26).**
This is genuine UltraHonk (Honk) verification: transcript, sumcheck, Shplemini,
and BN254 pairing implemented over Soroban's `crypto::bn254` host functions
(available at protocol 27, which testnet now runs). It is the exact backend
OpenZeppelin's `ConfidentialVerifier` uses. Status as of this writing:

- ✅ Compiles for `wasm32v1-none` with our toolchain (rustc 1.95, soroban-sdk 26.0.1),
  producing a 42,964-byte module. Wasm hash
  `8c3db32f71eec194248975060d2e2e1531e9b7f3761b1148e332b63cd9d7b13b` uploaded to Testnet.
- ✅ **Instantiated with a real, packed UltraHonk verification key** (validated by the
  constructor by parsing) — live at
  `CAM2WWTBWGNJBCB7J5LE76H2NUIXIO7VPJCKILY7SMORLPQ5HOGMIW6J`. The VK was produced from
  a Noir circuit with **Noir 1.0.0-beta.9 + Barretenberg 0.87.0**
  (`bb write_vk --scheme ultra_honk --oracle_hash keccak`).
- ✅ **A real UltraHonk proof was verified on-chain.** `verify_proof(public_inputs, proof)`
  over a real 14,592-byte proof returned `Ok` on Testnet. **Soundness confirmed:** flipping
  a single byte of the proof makes the same call revert with
  `Error(Contract, #4) = VerificationFailed`. Valid proof accepted, forged proof rejected —
  by BN254 pairing, not a marker check. Artifacts and a reproducer are committed under
  `contracts/real-verifier/`.
- ✅ **The full vault flow is proven on-chain, end-to-end, from the live dashboard —
  not just a CLI reproducer.** The Claim Portal tab at
  [confidia.vercel.app](https://confidia.vercel.app) signs and submits `claim()`
  directly via Freighter and the Soroban RPC against
  [`CCKUOWDY…RMPWYM`](https://stellar.expert/explorer/testnet/contract/CCKUOWDYYKLZLZ3MO4URUC5U5AJOTMVFS4TJO5V7AJZ3IKPFURMRPWYM)
  (`verifier =` the real verifier, funded with real testnet XLM), through four
  scenarios that exercise genuinely different on-chain code paths — confirmed by
  direct `stellar contract invoke` testing before wiring the UI:
  - **Happy Path.** A real proof, an on-chain-trusted `kid`, and a fresh nullifier:
    `claim(real proof, …)` returns `true`; the vault calls `jwk.is_key_trusted` then
    the **real** `verify_proof` (cross-contract to the SDK-26 verifier), which
    passes, and the SEP-41 transfer executes — the vault's native balance dropped
    `500000000 → 400000000` on the first end-to-end run (10 XLM settled), and
    drops by 1 XLM on every subsequent real run from the UI.
  - **Untrusted Key.** A `kid` never registered in the on-chain JWK registry —
    `is_key_trusted` genuinely returns `false`.
  - **Tampered Proof.** One byte of the real proof flipped — the real verifier's
    `verify_proof` sub-call returns `Error(Contract, #4) VerificationFailed`,
    which propagates and reverts the claim. The vault balance is **unchanged**; a
    forged proof releases no funds.
  - **Replay.** Reusing a nullifier already spent by a prior Happy Path run
    reverts with `Double claim detected`.

  **A subtlety worth stating explicitly:** all three rejection scenarios are
  deterministic given already-committed ledger state (the JWK trust map, the
  registered verification key, the spent-nullifier set), so Soroban's RPC
  rejects them during `simulateTransaction` — **before the wallet is ever asked
  to sign**. No fee is charged and no transaction is ever submitted for those
  three. This means there is genuinely no tx hash for a rejection, by
  construction, not by omission — the Claim Portal UI states this plainly and
  shows the real simulation diagnostic instead of fabricating a hash.

  This closes the loop: settlement is gated on a real UltraHonk proof verifying in
  the real verifier, over a real SEP-41 transfer, reachable by anyone from the
  live dashboard — not just a terminal reproducer. The SDK-20 vault and SDK-26
  verifier interoperate purely by contract address.

**This is no longer an architectural promise: a real UltraHonk proof verifies on Stellar
Testnet today, from a real dashboard, and a forged one is rejected.** The remaining
production work is swapping the demonstration circuit (`assert(x != y)`) for Confidia's
OIDC-identity + Merkle-inclusion circuit and generating claim proofs in the browser — the
same verifier and the same pipeline, a different circuit and VK.

Other roadmap items: (1) production USDC SAC as the vault funding asset
(demo uses native XLM); (2) mainnet deployment; (3) formal verification of the
nullifier/authorization invariants; (4) LCP registry standardization.

---

## 10. Attribution & References

Confidia builds on, and adds a distribution/claims/identity/legal/audit layer to:

- **OpenZeppelin Confidential Token suite** — `feat/confidential-verifier-ultrahonk`
  (confidential balances, `ConfidentialVerifier`/`ConfidentialAuditor` model).
- **Nethermind UltraHonk verifier** — on-chain SNARK verification primitive.
- **Stellar / Soroman** — `soroban-sdk =20.0.0`, SEP-10 (auth), SEP-41 (tokens),
  SEP-43 (wallets).
- **Noir / UltraHonk** — zero-knowledge circuit toolchain for browser-side proving.

---

<p align="center"><sub>Confidia v1.0 — Private USD Distribution Rails on Stellar · July 2026</sub></p>
