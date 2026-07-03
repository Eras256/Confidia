# Confidia — 3-Minute Demo Script (v2, real Claim Portal)

**Total ≈ 2:55. Narration ≈ 430 words. The Freighter signatures and the real
claim rejections are the money shots — don't rush them.**

| Time | NARRATION (say this) | ON-SCREEN (show this) |
|------|----------------------|------------------------|
| **0:00–0:16** | "Tokenization solved issuance. Distribution is the bottleneck. Paying five hundred contributors in USDC on a public ledger exposes every recipient's address, amount and timing. Confidia is private, compliant distribution rails for tokenized dollars on Stellar." | Title card → live dashboard at **confidia.vercel.app**. Slowly scroll Overview. |
| **0:16–0:34** | "Five contracts on Stellar Testnet, a Next.js dashboard, full English and Spanish. Everything you're about to see is real — connected wallet, signed transactions, on-chain verification. Nothing here is scripted." | **Security** tab → "Deployed On-Chain Contracts" → click one address → stellar.expert. Toggle EN/ES once. |
| **0:34–0:58** | "I connect Freighter, then register an OIDC signing key on-chain in Identity Ops. Real transaction, real hash. I can revoke it too — same thing, a real signed transaction, and the evidence link sits right next to the button I clicked." | **Connect Wallet** → Freighter. **Identity Ops** → Register on-chain → sign → tx hash link. Then **Revoke** on a key → sign → new evidence link appears under the table. |
| **0:58–1:22** | "Confidential Treasury reads my wallet's real balances from Horizon — no hardcoded issuer. If I don't have a trustline yet for an asset, the backend can establish one for me before the deposit, so the SEP-41 payment doesn't fail on a missing trustline. Then it settles on-chain — real hash, real link." | **Confidential Treasury** → asset dropdown (real balances) → amount → **Deposit** → (trustline prep message if needed) → sign → hash link → explorer. |
| **1:22–2:15** | "Now the Claim Portal — this used to be a scripted demo. Not anymore. This is a real Freighter-signed `claim()` call against a funded vesting vault, verified by the real Nethermind UltraHonk verifier. Happy path: real proof, on-chain trusted key, fresh nullifier — it succeeds, funds move, here's the hash. Now watch the other three: an untrusted key, a tampered proof, a replayed nullifier. Soroban simulates every call before my wallet is even asked to sign — a call that will certainly fail is rejected right here, for free, no signature, no fee, no transaction ever submitted. That rejection, straight from the public RPC, is the real evidence." | **Claim Portal** → scenario buttons. Run **Happy Path** → sign in Freighter → green box + tx hash link. Run **Untrusted Key** → red/blue rejection box, no hash, show the raw diagnostic toggle. Run **Tampered Proof** and **Replay** the same way. |
| **2:15–2:40** | "Same real verifier, exercised from the terminal too, for anyone who wants to reproduce it without a UI: valid proof accepted, forged proof rejected, by cryptography, not by client-side code." | Cut to terminal running `bash contracts/real-verifier/scripts/e2e_testnet.sh`; let the pass/fail lines land. |
| **2:40–2:55** | "We're explicit about what's real, secrets rotate in production, and the whole thing reproduces from one command. Confidia — private USD distribution, with ZK that actually verifies on-chain." | README real-vs-simulated note + end card with **confidia.vercel.app** and the GitHub URL. |

## Every step above is real and works today
- Connect (Freighter via Stellar Wallets Kit, SEP-10 auth) · Identity Ops
  **Register on-chain** and **Revoke** (`jwk_registry.add_key` / `revoke_key`, both
  signed, both show their own evidence link) · Confidential Treasury **Deposit** —
  reads the connected wallet's real balances off-chain via Horizon (no hardcoded
  asset address), can auto-establish a missing trustline server-side before the
  payment, then signs a real on-chain SEP-41 payment, with honest decoded failure
  reasons (e.g. `paymentNoTrust`) instead of a generic "failed" message ·
  Security **Verify on-chain (sign)** + **Run Live Check** (read-only simulate) ·
  **Claim Portal** — a real `claim()` call against a funded vesting-claim vault
  wired to the real Nethermind UltraHonk verifier, with 4 scenarios that exercise
  genuinely different real contract code paths (confirmed via direct CLI testing):
  Happy Path settles funds for real; Untrusted Key, Tampered Proof, and Replay are
  all rejected by Soroban's mandatory pre-flight simulation before any signature
  is requested, so there is no tx hash for those three — the UI says so, and shows
  the real RPC diagnostic instead of fabricating one · the terminal reproducer
  (real UltraHonk proof verified + settled on-chain). Every signed action that
  succeeds returns a real, persisted tx hash as a clickable link to stellar.expert.
- The in-app **Docs** tab (menu) lists every contract address, the REST API, and the
  reproducer command — a clean place to point judges.
- On real USDC/EURC on testnet: the deposit form shows whatever your connected
  wallet actually holds (queried live, no assumed issuer). Native XLM via
  Friendbot works today with zero extra setup and is what the Claim Portal's
  happy-path scenario uses (1 XLM per real claim, kept small so the shared demo
  vault survives many runs).

## Recording tips
- **Record mobile B-roll** (10–15s): open `confidia.vercel.app` on a phone, tap the hamburger, show the responsive layout (sidebar drawer, stacked cards).
- Pre-fund your Freighter testnet wallet via Friendbot so signatures don't fail on camera.
- Run **Happy Path** once before recording so the **Replay** scenario has a spent nullifier ready to reuse — otherwise it'll prompt you to run Happy Path first, live.
- If the terminal run is slow, speed up the quiet deploy waits 1.5–2× in editing — never cut the assertion lines.
- Keep a stellar.expert tab open as B-roll for the "inspect it yourself" beat.

## What the judge can verify independently
- Live dashboard: <https://confidia.vercel.app> · API: <https://confidia-api.fly.dev>
- One-command proof: `bash contracts/real-verifier/scripts/e2e_testnet.sh` (only the `stellar` CLI needed).
- Every address/tx on <https://stellar.expert/explorer/testnet>.
- The vesting-claim vault used by the Claim Portal, its real UltraHonk verifier, and
  the on-chain JWK registry are all independently queryable — `is_key_trusted`
  genuinely returns `false` for the untrusted-key scenario's kid, and the nullifier
  used by Replay is genuinely already recorded on-chain after Happy Path runs once.
