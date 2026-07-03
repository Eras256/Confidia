# confidia-sdk

Legal Context Protocol (LCP) client and a compliance policy engine, extracted
from [Confidia](https://github.com/Eras256/Confidia) — private, compliant
distribution rails for tokenized USD (USDC/EURC) on Stellar. Live demo:
[confidia.vercel.app](https://confidia.vercel.app).

Everything this package exports is real, dependency-free logic — no mocks, no
simulated network calls, no fabricated data:

- **`LcpClient`** — discovers a counterparty's Legal Context Protocol document
  over a genuine HTTPS fetch, validates its shape, and verifies the linked
  terms document's SHA-256 hash against the declared `atrHash`.
- **`PolicyEngine`** — evaluates a transaction against compliance rules
  (jurisdiction allow-lists, standard-vs-confidential thresholds, required
  proof types) and returns a decision plus the reasons behind it.
- **SEP-10 helpers** (`fetchSep10Challenge`, `verifySep10Signature`) — thin,
  typed wrappers around a Stellar SEP-10 web-authentication challenge/response
  flow against your own API.

## Install

```bash
npm install confidia-sdk
```

## Usage

```ts
import { LcpClient, PolicyEngine } from "confidia-sdk";

const lcp = new LcpClient();

// Real network fetch + real SHA-256 hash verification — no fixtures.
const doc = await lcp.fetchLegalContext("confidia.vercel.app");
if (!lcp.validateLegalContext(doc)) {
  throw new Error("Missing required LCP fields");
}
const terms = await lcp.fetchTermsDocument(doc.terms);
const hashMatches = lcp.verifyAtrHash(terms, doc.atrHash); // true

const policy = new PolicyEngine();
const decision = policy.evaluate(
  { amount: 12000, assetCode: "USDC", jurisdiction: "MX", isAccredited: true },
  {
    maxStandardAmount: 5000,
    requireConfidential: false,
    requiredProofs: ["zkBalance"],
    allowedJurisdictions: ["MX", "US"],
  }
);
// decision.tokenType === "confidential" (amount exceeds maxStandardAmount)
```

## What this package deliberately does not include

Confidia's dashboard also ships real zero-knowledge verification (a deployed
[Nethermind UltraHonk verifier](https://github.com/NethermindEth) doing
genuine BN254 pairing checks on Stellar Soroban) and a real on-chain claim
vault — those are Rust/Soroban contracts, not JS, so they aren't part of this
npm package. See [`contracts/real-verifier`](https://github.com/Eras256/Confidia/tree/main/contracts/real-verifier)
and the live Claim Portal for that code and its evidence trail on
[stellar.expert](https://stellar.expert/explorer/testnet).

An earlier internal build of this SDK also included a simulated ZK-proof
client and a simulated confidential-token wrapper for demo purposes. Those
were deliberately excluded from this public package — they encoded proofs as
plain JSON and called an in-memory mock RPC, not real cryptography or a real
contract, and publishing them under an SDK meant to represent real compliance
tooling would have been misleading.

## License

MIT
