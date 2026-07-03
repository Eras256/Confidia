# Real UltraHonk Verifier — Live On-Chain ZK Verification

This directory contains the **real, non-simulated** UltraHonk verification path for
Confidia: genuine Honk proof verification (transcript + sumcheck + Shplemini +
**BN254 pairing**) running on Stellar Testnet via `soroban-sdk 26`'s
`crypto::bn254` host functions (protocol 27).

The verifier backend is Nethermind's
[`rs-soroban-ultrahonk`](https://github.com/NethermindEth/rs-soroban-ultrahonk)
(rev `661db07`) — the exact backend OpenZeppelin's `ConfidentialVerifier` uses.

## ✅ Confirmed live on Testnet

| Item | Value |
|------|-------|
| Verifier instance | [`CAM2WWTB…IW6J`](https://stellar.expert/explorer/testnet/contract/CAM2WWTBWGNJBCB7J5LE76H2NUIXIO7VPJCKILY7SMORLPQ5HOGMIW6J) |
| Verifier wasm hash | `8c3db32f71eec194248975060d2e2e1531e9b7f3761b1148e332b63cd9d7b13b` |
| Positive (real proof) | `verify_proof(pubs, proof) → ()` — **accepted** |
| Negative (1 byte flipped) | `verify_proof(pubs, tampered) → Error(Contract, #4)` **VerificationFailed** — **rejected** |

The positive/negative pair is the soundness demonstration: the contract accepts a
valid proof and rejects a forged one — real cryptography, not a marker check.

## Circuit

`circuit/main.nr`:

```noir
fn main(x: Field, y: pub Field) { assert(x != y); }   // public input y = 2
```

A minimal circuit that proves knowledge of a private `x` distinct from a public
`y`, sufficient to exercise the full UltraHonk verifier on-chain. The production
Confidia circuit (OIDC-JWT identity → nullifier, Merkle inclusion) slots into the
same pipeline; only the circuit and its VK change.

## Artifacts (`artifacts/simple_circuit/`)

| File | Bytes | What |
|------|-------|------|
| `proof` | 14592 | real UltraHonk proof |
| `vk` | 1760 | packed UltraHonk verification key (registered on-chain) |
| `public_inputs` | 32 | the public input `y` |
| `*_fields.json` | — | field-encoded (human-readable) forms |

## Reproduce — one command (no Noir/Barretenberg needed)

A third party can verify the whole thing after `git clone`, with **only the
`stellar` CLI** installed. It funds a fresh Friendbot key, deploys the real
verifier + vault from the committed wasms, and asserts the positive/negative cases:

```bash
bash contracts/real-verifier/scripts/e2e_testnet.sh
```

Expected tail:

```
✅ verify_proof(real proof) -> Ok
✅ verify_proof(tampered proof) -> rejected (VerificationFailed)
✅ settled: vault 500000000 -> 400000000 (10 XLM out)
✅ tampered claim reverted; vault unchanged — no funds released
✅ replay rejected (nullifier already spent)
== ALL CHECKS PASSED ==
```

## Reproduce — regenerate the proof from scratch

Requires `nargo 1.0.0-beta.9`, `bb 0.87.0`, and the `stellar` CLI.

```bash
# 1. Build circuit + generate real proof/vk/public_inputs
cd circuit
nargo compile && nargo execute
bb prove   --scheme ultra_honk --oracle_hash keccak \
           --bytecode_path target/circuit.json --witness_path target/circuit.gz \
           --output_path target --output_format bytes_and_fields
bb write_vk --scheme ultra_honk --oracle_hash keccak \
           --bytecode_path target/circuit.json \
           --output_path target --output_format bytes_and_fields

# 2. Upload the verifier wasm (from NethermindEth/rs-soroban-ultrahonk, wasm32v1-none)
stellar contract upload --wasm rs_soroban_ultrahonk.wasm --source <SECRET> --network testnet

# 3. Instantiate with the real VK (constructor validates it)
stellar contract deploy --wasm-hash <hash> --source <SECRET> --network testnet \
  -- --vk_bytes $(xxd -p target/vk | tr -d '\n')

# 4. Verify the real proof on-chain
stellar contract invoke --id <verifier> --source <SECRET> --network testnet -- \
  verify_proof --public_inputs $(xxd -p target/public_inputs | tr -d '\n') \
               --proof_bytes  $(xxd -p target/proof | tr -d '\n')
# -> null  (Ok = verified). Flip one byte of the proof -> Error #4 VerificationFailed.
```

## Interface

```rust
__constructor(vk_bytes: Bytes) -> Result<(), Error>          // immutable VK, validated at deploy
verify_proof(public_inputs: Bytes, proof_bytes: Bytes) -> Result<(), Error>  // real UltraHonk verify
vk_bytes() -> Result<Bytes, Error>
```

`vesting-claim` calls `verify_proof` on this contract by address via a
`#[contractclient]` trait; the SDK-20 vault and SDK-26 verifier interoperate purely
through the contract address.
