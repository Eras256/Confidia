# confidia-legacy-sim (private, never published)

Simulated ZK proof generation and confidential-token-transfer logic that
backs the legacy `POST /agents/payments/execute` demo endpoint in `apps/api`.

**Nothing in this package is real cryptography or a real on-chain call.**
`ZkClient` encodes/decodes a JSON blob instead of generating a real proof;
`ConfidentialTokenClient` calls `MockSorobanRpc` (an in-memory fake from
`confidia-test-utils`), not a deployed Soroban contract. It exists so the
package.json `private: true` on this repo keeps it out of the published
`confidia-sdk` — no external consumer of the SDK should be able to mistake
this for the real, on-chain UltraHonk verification used by the vesting-claim
vault (see `contracts/real-verifier` and the dashboard's Claim Portal, which
call `sendPayment()`/`writeContract()` directly and never touch this package).

`scripts/confidia-init.ts` is the `pnpm confidia:init` developer-journey CLI —
its LCP-discovery step is real (hits `confidia.vercel.app` for real), the ZK
and payment-execution steps it prints are simulated, same caveat as above.
