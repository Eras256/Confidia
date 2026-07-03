# Confidia — 2–3 Minute Demo Video Storyboard

Goal: let a judge *see* real ZK doing real work — a valid proof settles funds, a
forged proof does not — without having to trust a README. The centerpiece is the
one-command reproducer running live in a terminal.

**Total: ~2:30. The terminal run (Scene 3) is the money shot — give it the most time.**

---

### Scene 1 — The problem (0:00 → 0:20)
*On screen:* title card → the dashboard homepage.

> "Tokenization solved issuance. Distribution is the bottleneck: paying 500
> contributors in USDC on a public ledger doxxes every recipient's address, amount,
> and timing. Confidia is private, compliant distribution rails for tokenized USD on
> Stellar — recipients prove eligibility with a zero-knowledge proof, and only then
> do funds settle."

### Scene 2 — It's real and on-chain (0:20 → 0:45)
*On screen:* dashboard **Security** tab → the "Deployed On-Chain Contracts" panel;
click **Run Live Check**; then open the verifier on stellar.expert.

> "These aren't mockups — five contracts live on Testnet. The verifier here is the
> real Nethermind UltraHonk verifier, the exact backend OpenZeppelin's Confidential
> Token uses: genuine BN254 pairing verification, on soroban-sdk 26."

### Scene 3 — Proof it works, end-to-end (0:45 → 2:15)  ⭐
*On screen:* a clean terminal. Run:

```bash
bash contracts/real-verifier/scripts/e2e_testnet.sh
```

Narrate each ✅ as it appears (the script funds a brand-new key via Friendbot — so
this is exactly what a judge cloning the repo would see):

- ✅ *"Fresh account, funded by Friendbot — nothing pre-baked."*
- ✅ *"It deploys the real UltraHonk verifier and registers a real verification key."*
- ✅ **`verify_proof(real proof) → Ok`** — *"a real 14 KB UltraHonk proof verifies on-chain."*
- ✅ **`verify_proof(tampered proof) → rejected`** — *"flip one byte, it's rejected. Real cryptography, not a marker check."*
- ✅ *"Now the full flow: fund a vault with 50 XLM…"*
- ✅ **valid claim → `vault 500000000 → 400000000`** — *"a valid proof settles 10 XLM over SEP-41."*
- ✅ **tampered claim → reverts, balance unchanged** — *"a forged proof releases nothing. Settlement is gated on the real verifier."*
- ✅ **replay → rejected** — *"and nullifiers stop double-claims."*
- ✅ **ALL CHECKS PASSED**

> "Deposit, real proof, real verification, real settlement — and the negative cases
> that prove it isn't theater."

### Scene 4 — Honest, and complete (2:15 → 2:40)
*On screen:* README real-vs-simulated note + the SEP badges.

> "We're explicit about what's real: this verifier does genuine UltraHonk
> verification. A labeled SDK-20 simulation exists only for fast protocol testing.
> Dev uses mock secrets; production rotates them via a secrets manager. SEP-10 auth,
> SEP-41 tokens, SEP-43 wallets are wired throughout. The whole thing reproduces
> from a single script. Confidia: private USD distribution, with ZK that actually
> verifies on-chain."

---

## Recording tips
- **Pre-warm nothing on camera**, but do a dry run first so timing is known; the
  live run takes ~1–2 min of testnet round-trips (deploys + claims). If you need to
  fit 2:30, record the terminal run, then speed up the quieter deploy waits 1.5–2×
  in editing while narrating — never cut the four assertion lines.
- Keep the terminal font large; the green ✅ / red ❌ are the story.
- Have `contracts/real-verifier.testnet.json` and a stellar.expert tab ready as
  B-roll for the "inspect it yourself" beat.

## What the judge can verify independently
- `bash contracts/real-verifier/scripts/e2e_testnet.sh` — needs only the `stellar`
  CLI (no Noir/Barretenberg, no recompile).
- Regenerate the proof from scratch: `contracts/real-verifier/README.md`.
- Every address/tx on `https://stellar.expert/explorer/testnet/`.
