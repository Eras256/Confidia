# Confidia — 3-Minute Demo Script

**Total ≈ 2:55. Narration ≈ 420 words. The two Freighter signatures and the
pass/fail proof are the money shots — don't rush them.**

| Time | NARRATION (say this) | ON-SCREEN (show this) |
|------|----------------------|------------------------|
| **0:00–0:18** | "Tokenization solved issuance. Distribution is the bottleneck. Paying five hundred contributors in USDC on a public ledger exposes every recipient's address, amount and timing. Confidia is private, compliant distribution rails for tokenized dollars on Stellar." | Title card → the live dashboard at **confidia.vercel.app**. Slowly scroll the Overview tab. |
| **0:18–0:38** | "It's live. Five contracts on Stellar Testnet, a Next.js dashboard, full English and Spanish. And it's real — let me prove it, not just claim it." | **Security** tab → "Deployed On-Chain Contracts" panel. Click one address → opens on **stellar.expert**. Toggle EN/ES once. |
| **0:38–1:05** | "First I connect my wallet with Freighter. Now, Identity Ops: I register an OIDC signing key on-chain. This isn't a mock — Freighter asks me to sign a real transaction. And there's the hash on the explorer." | **Connect Wallet** → Freighter → approve. **Identity Ops** → type a Key ID → **Register on-chain** → sign in Freighter → click the **tx hash link** → stellar.expert. |
| **1:05–1:35** | "Same for a treasury payout. I enter an amount, sign with Freighter, and it settles on-chain — a real SEP-41 payment with a verifiable hash. No simulation." | **Confidential Treasury** → amount 10 → **Execute Treasury Payout** → sign → click the **hash link** → explorer. |
| **1:35–2:20** | "Now the core. Confidia runs the real Nethermind UltraHonk verifier — genuine BN254 pairing on-chain, the same backend as OpenZeppelin's confidential tokens. A valid proof verifies… and if I corrupt a single byte, it's rejected — VerificationFailed. Valid proof accepted, forged proof rejected, by cryptography." | Security tab → **Run Live Check** (green ✓). Then cut to a **terminal** running `bash contracts/real-verifier/scripts/e2e_testnet.sh`; let the green ✅ lines land — especially the **tampered-proof rejection** and **"10 XLM settled"**. |
| **2:20–2:45** | "And it settles funds: deposit, a real proof, real verification, then a SEP-41 transfer to the recipient — a forged proof releases nothing." | Keep the terminal on the "settled 500000000 → 400000000" and "tampered claim reverted — no settlement" lines. |
| **2:45–2:55** | "We're explicit about what's real versus simulated, secrets rotate in production, and the whole thing reproduces from one command. Confidia — private USD distribution, with ZK that actually verifies on-chain." | README real-vs-simulated note + the SEP badges → end card with **confidia.vercel.app** and the GitHub URL. |

## Every step above is real and works today
- Connect (Freighter via Stellar Wallets Kit) · Identity Ops **Register on-chain**
  (`jwk_registry.add_key`, signed) · Treasury **Execute Payout** (real XLM payment,
  signed) · Security **Verify on-chain (sign)** + **Run Live Check** · the terminal
  reproducer. Each on-chain action returns a real tx hash linked to stellar.expert.
- The in-app **Docs** tab (menu) lists every contract address, the REST API, and the
  reproducer command — a clean place to point judges.

## Recording tips
- **Record mobile B-roll** (10–15s): open `confidia.vercel.app` on a phone, tap the hamburger, show the responsive layout (sidebar drawer, stacked cards).
- Pre-fund your Freighter testnet wallet via Friendbot so signatures don't fail on camera.
- If the terminal run is slow, speed up the quiet deploy waits 1.5–2× in editing — never cut the four assertion lines.
- Keep a stellar.expert tab open as B-roll for the "inspect it yourself" beat.

## What the judge can verify independently
- Live dashboard: <https://confidia.vercel.app> · API: <https://confidia-api.fly.dev>
- One-command proof: `bash contracts/real-verifier/scripts/e2e_testnet.sh` (only the `stellar` CLI needed).
- Every address/tx on <https://stellar.expert/explorer/testnet>.
