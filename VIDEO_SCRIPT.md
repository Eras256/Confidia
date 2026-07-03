# Confidia — 3.5-Minute Demo Script (Final, English)

**Total ≈ 3:20. Narration ≈ 480 words. The Freighter signatures and the real
claim rejections are the money shots — don't rush them.**

| Time | NARRATION (say this) | ON-SCREEN (show this) |
|------|----------------------|------------------------|
| **0:00–0:16** | "Tokenization solved issuance. Distribution is the bottleneck. Paying five hundred contributors in USDC on a public ledger exposes every recipient's address, amount and timing. Confidia is private, compliant distribution rails for tokenized dollars on Stellar." | Title card → live dashboard at **confidia.vercel.app**. |
| **0:16–0:34** | "This Overview tab isn't decoration — every number here comes from a real database and real on-chain state, and it moves as I use the app. Watch that claims counter — it's zero right now." | **Overview** tab → point at the four KPI cards and the two charts. |
| **0:34–0:50** | "Five contracts on Stellar Testnet, full English and Spanish. Everything you're about to see is real — connected wallet, signed transactions, on-chain verification. Nothing here is scripted." | **Security** tab → "Deployed On-Chain Contracts" → click one address → stellar.expert. Toggle EN/ES once. |
| **0:50–1:12** | "I connect Freighter, then register an OIDC signing key on-chain in Identity Ops. Real transaction, real hash. I can revoke it too — same thing, a real signed transaction, with its own evidence link right next to the button I clicked." | **Connect Wallet** → Freighter. **Identity Ops** → Register on-chain → sign → tx hash link. Then **Revoke** on a key → sign → new evidence link appears under the table. |
| **1:12–1:34** | "Legal Context does a genuine compliance check — a real HTTPS fetch and a real SHA-256 hash comparison. If I type a random domain, it correctly fails — there's no fake document there. My own domain passes, because it really publishes one." | **Legal Context** → type any unrelated domain → real rejection with the actual reason. Then type **confidia.vercel.app** → real **VERIFIED**. |
| **1:34–1:56** | "Confidential Treasury reads my wallet's real balances from Horizon — no hardcoded issuer. If I'm missing a trustline, the backend can establish one before the deposit, so the payment doesn't fail on that. Then it settles on-chain — real hash, real link." | **Confidential Treasury** → asset dropdown (real balances) → amount → **Deposit** → sign → hash link → explorer. |
| **1:56–2:52** | "Now the Claim Portal — this used to be a scripted demo. Not anymore. This is a real Freighter-signed `claim()` call against a funded vesting vault, verified by the real Nethermind UltraHonk verifier. Happy path: real proof, on-chain trusted key, fresh nullifier — it succeeds, funds move, here's the hash — and watch, the Overview counter I showed you earlier just went up by one. Now the other three: an untrusted key, a tampered proof, a replayed nullifier. Soroban simulates every call before my wallet is even asked to sign — a call that will certainly fail is rejected right here, for free, no signature, no fee, no transaction ever submitted. That rejection, straight from the public RPC, is the real evidence." | **Claim Portal** → **Happy Path** → sign in Freighter → green box + tx hash link. Cut back to **Overview**, show the claims KPI incremented. Back to Claim Portal → **Untrusted Key** → rejection box, no hash, show the raw diagnostic toggle. Run **Tampered Proof** and **Replay** the same way. |
| **2:52–3:10** | "Same real verifier, exercised from the terminal too, for anyone who wants to reproduce it without a UI: valid proof accepted, forged proof rejected, by cryptography, not by client-side code." | Cut to terminal running `bash contracts/real-verifier/scripts/e2e_testnet.sh`; let the pass/fail lines land. |
| **3:10–3:20** | "The compliance SDK is on npm today — `npm install confidia-sdk`. We're explicit about what's real, secrets rotate in production, and the whole thing reproduces from one command. Confidia — private USD distribution, with ZK that actually verifies on-chain." | README real-vs-simulated note + end card with **confidia.vercel.app**, **npmjs.com/package/confidia-sdk**, and the GitHub URL. |

## Every step above is real and works today
- **Overview** — active distributions, settled volume, LCP compliance ratio, and
  ZK-verified claims are all computed live from Supabase-backed data and real
  on-chain actions; the two charts are a real 7-day transaction count and a real
  asset-volume breakdown, not fabricated curves.
- Connect (Freighter via Stellar Wallets Kit, SEP-10 auth) · Identity Ops
  **Register on-chain** and **Revoke** (`jwk_registry.add_key` / `revoke_key`, both
  signed, both show their own evidence link) · **Legal Context** — a real HTTPS
  fetch of `.well-known/legal-context.json` plus a real SHA-256 hash check; a
  domain with no real document is correctly rejected with the actual reason, not
  a raw parse error · Confidential Treasury **Deposit** — reads the connected
  wallet's real balances off-chain via Horizon (no hardcoded asset address), can
  auto-establish a missing trustline server-side before the payment, then signs
  a real on-chain SEP-41 payment, with honest decoded failure reasons (e.g.
  `paymentNoTrust`) instead of a generic "failed" message · Security **Verify
  on-chain (sign)** + **Run Live Check** (read-only simulate) · **Claim Portal** —
  a real `claim()` call against a funded vesting-claim vault wired to the real
  Nethermind UltraHonk verifier, with 4 scenarios that exercise genuinely
  different real contract code paths (confirmed via direct CLI testing before the
  UI was wired): Happy Path settles funds for real and increments the Overview
  KPI; Untrusted Key, Tampered Proof, and Replay are all rejected by Soroban's
  mandatory pre-flight simulation before any signature is requested, so there is
  no tx hash for those three — the UI says so, and shows the real RPC diagnostic
  instead of fabricating one · the terminal reproducer (real UltraHonk proof
  verified + settled on-chain). Every signed action that succeeds returns a real,
  persisted tx hash as a clickable link to stellar.expert.
- The compliance SDK (`LcpClient`, `PolicyEngine`, SEP-10 helpers) is published
  and installable: `npm install confidia-sdk`.
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
- Refresh the Overview tab right after the Happy Path claim so the KPI increment is visible on camera (it's a live re-fetch, not a push update).
- If the terminal run is slow, speed up the quiet deploy waits 1.5–2× in editing — never cut the assertion lines.
- Keep a stellar.expert tab open as B-roll for the "inspect it yourself" beat.

## What the judge can verify independently
- Live dashboard: <https://confidia.vercel.app> · API: <https://confidia-api.fly.dev>
- SDK on npm: <https://www.npmjs.com/package/confidia-sdk> (`npm install confidia-sdk`).
- One-command proof: `bash contracts/real-verifier/scripts/e2e_testnet.sh` (only the `stellar` CLI needed).
- Every address/tx on <https://stellar.expert/explorer/testnet>.
- The vesting-claim vault used by the Claim Portal, its real UltraHonk verifier, and
  the on-chain JWK registry are all independently queryable — `is_key_trusted`
  genuinely returns `false` for the untrusted-key scenario's kid, and the nullifier
  used by Replay is genuinely already recorded on-chain after Happy Path runs once.
