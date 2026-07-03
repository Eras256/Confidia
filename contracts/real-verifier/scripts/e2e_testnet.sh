#!/usr/bin/env bash
#
# Confidia — self-contained end-to-end proof of REAL on-chain UltraHonk verification
# + vault settlement on Stellar Testnet.
#
# A third party can run this after `git clone` with ONLY the `stellar` CLI installed
# (plus curl/xxd/python3). It needs NO Noir/Barretenberg and recompiles NOTHING — it
# uses the committed wasms (contracts/real-verifier/wasm/) and the committed real
# circuit artifacts (contracts/real-verifier/artifacts/simple_circuit/).
#
# It funds a fresh throwaway key via Friendbot, deploys the real Nethermind UltraHonk
# verifier + Confidia's JWK registry + vesting-claim vault, and demonstrates:
#   1. verify_proof(real proof)      -> Ok        (real UltraHonk verification)
#   2. verify_proof(tampered proof)  -> FAILS     (soundness)
#   3. deposit -> claim(real proof)  -> settles 10 XLM via SEP-41
#   4. claim(tampered proof)         -> reverts, NO settlement
#   5. claim(reused nullifier)       -> reverts (double-claim guard)
#
# Usage:  bash contracts/real-verifier/scripts/e2e_testnet.sh
set -euo pipefail

NET=testnet
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RV="$(cd "$HERE/.." && pwd)"
ART="$RV/artifacts/simple_circuit"
WASM="$RV/wasm"
export PATH="$HOME/.local/bin:$PATH"

say()  { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
pass() { printf '\033[1;32m  ✅ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m  ❌ %s\033[0m\n' "$*"; exit 1; }

command -v stellar >/dev/null || fail "stellar CLI not found on PATH"
[ -f "$ART/proof" ] && [ -f "$ART/vk" ] && [ -f "$ART/public_inputs" ] || fail "missing committed artifacts"

# ---- 0. Fresh, Friendbot-funded throwaway identity ----------------------------
say "Creating a fresh Friendbot-funded testnet identity"
ID="confidia_demo_$$"
stellar keys generate "$ID" --network "$NET" --fund --overwrite >/dev/null 2>&1 || \
  stellar keys generate "$ID" --network "$NET" --fund >/dev/null 2>&1
PUB=$(stellar keys address "$ID")
pass "funded account: $PUB"
trap 'stellar keys rm "$ID" >/dev/null 2>&1 || true' EXIT

# ---- 1. Ensure the real verifier wasm is installed; deploy an instance with VK -
say "Deploying the REAL Nethermind UltraHonk verifier (soroban-sdk 26, BN254)"
WHASH=$(stellar contract upload --wasm "$WASM/rs_soroban_ultrahonk.wasm" --source "$ID" --network "$NET" 2>/dev/null | tail -1)
pass "verifier wasm hash: $WHASH"
VK_HEX=$(xxd -p "$ART/vk" | tr -d '\n')
VERIFIER=$(stellar contract deploy --wasm-hash "$WHASH" --source "$ID" --network "$NET" -- --vk_bytes "$VK_HEX" 2>/dev/null | tail -1)
pass "verifier instance (real VK registered): $VERIFIER"

# ---- 2. verify_proof: real proof passes, tampered proof fails -----------------
PROOF_HEX=$(xxd -p "$ART/proof" | tr -d '\n')
PUBS_HEX=$(xxd -p "$ART/public_inputs" | tr -d '\n')
BAD_HEX=$(python3 -c "b=bytearray.fromhex('$PROOF_HEX'); b[7000]^=0xff; print(b.hex())")

say "Verifier-level check (real UltraHonk verification on-chain)"
if stellar contract invoke --id "$VERIFIER" --source "$ID" --network "$NET" -- \
     verify_proof --public_inputs "$PUBS_HEX" --proof_bytes "$PROOF_HEX" >/dev/null 2>&1; then
  pass "verify_proof(real proof) -> Ok"
else
  fail "real proof did NOT verify (unexpected)"
fi
if stellar contract invoke --id "$VERIFIER" --source "$ID" --network "$NET" -- \
     verify_proof --public_inputs "$PUBS_HEX" --proof_bytes "$BAD_HEX" >/dev/null 2>&1; then
  fail "tampered proof VERIFIED (soundness broken!)"
else
  pass "verify_proof(tampered proof) -> rejected (VerificationFailed)"
fi

# ---- 3. Full vault flow: deposit -> claim -> real verification -> settlement --
say "Deploying JWK registry + vesting-claim vault wired to the real verifier"
JWK=$(stellar contract deploy --wasm "$WASM/jwk_registry.wasm" --source "$ID" --network "$NET" 2>/dev/null | tail -1)
VAULT=$(stellar contract deploy --wasm "$WASM/vesting_claim.wasm" --source "$ID" --network "$NET" 2>/dev/null | tail -1)
NSAC=$(stellar contract id asset --asset native --network "$NET")
ROOT="0000000000000000000000000000000000000000000000000000000000000000"
stellar contract invoke --id "$VAULT" --source "$ID" --network "$NET" -- initialize \
  --root "$ROOT" --token "$NSAC" --verifier "$VERIFIER" --jwk_registry "$JWK" >/dev/null 2>&1
pass "vault $VAULT  (verifier=$VERIFIER)"

stellar contract invoke --id "$JWK" --source "$ID" --network "$NET" -- \
  add_key --kid google-demo --n demo-modulus --e AQAB --alg RS256 >/dev/null 2>&1
pass "trusted key 'google-demo' registered in JWK registry"

say "DEPOSIT: funding vault with 50 XLM (native SAC)"
stellar contract invoke --id "$NSAC" --source "$ID" --network "$NET" -- \
  transfer --from "$PUB" --to "$VAULT" --amount 500000000 >/dev/null 2>&1
BAL0=$(stellar contract invoke --id "$NSAC" --source "$ID" --network "$NET" -- balance --id "$VAULT" 2>/dev/null | tr -d '"')
pass "vault balance: $BAL0 stroops (50 XLM)"

NULL="$(python3 -c 'import os;print(os.urandom(32).hex())')"
say "CLAIM (valid proof) -> real verification -> SEP-41 settlement of 10 XLM"
stellar contract invoke --id "$VAULT" --source "$ID" --network "$NET" --send=yes -- claim \
  --proof "$PROOF_HEX" --public_inputs "$PUBS_HEX" --recipient "$PUB" \
  --nullifier "$NULL" --kid google-demo --amount 100000000 >/dev/null 2>&1 || fail "valid claim reverted (unexpected)"
BAL1=$(stellar contract invoke --id "$NSAC" --source "$ID" --network "$NET" -- balance --id "$VAULT" 2>/dev/null | tr -d '"')
[ "$BAL1" = "400000000" ] && pass "settled: vault $BAL0 -> $BAL1 (10 XLM out)" || fail "unexpected vault balance $BAL1"

say "CLAIM (tampered proof) -> must revert with NO settlement"
NULL2="$(python3 -c 'import os;print(os.urandom(32).hex())')"
if stellar contract invoke --id "$VAULT" --source "$ID" --network "$NET" --send=yes -- claim \
     --proof "$BAD_HEX" --public_inputs "$PUBS_HEX" --recipient "$PUB" \
     --nullifier "$NULL2" --kid google-demo --amount 100000000 >/dev/null 2>&1; then
  fail "tampered claim SUCCEEDED (soundness broken!)"
fi
BAL2=$(stellar contract invoke --id "$NSAC" --source "$ID" --network "$NET" -- balance --id "$VAULT" 2>/dev/null | tr -d '"')
[ "$BAL2" = "$BAL1" ] && pass "tampered claim reverted; vault unchanged ($BAL2) — no funds released" || fail "balance changed on a forged proof!"

say "CLAIM (replayed nullifier) -> must revert (double-claim guard)"
if stellar contract invoke --id "$VAULT" --source "$ID" --network "$NET" --send=yes -- claim \
     --proof "$PROOF_HEX" --public_inputs "$PUBS_HEX" --recipient "$PUB" \
     --nullifier "$NULL" --kid google-demo --amount 100000000 >/dev/null 2>&1; then
  fail "replayed nullifier SUCCEEDED (double-claim guard broken!)"
else
  pass "replay rejected (nullifier already spent)"
fi

say "ALL CHECKS PASSED — real UltraHonk verification gates real SEP-41 settlement"
echo "   verifier : https://stellar.expert/explorer/testnet/contract/$VERIFIER"
echo "   vault    : https://stellar.expert/explorer/testnet/contract/$VAULT"
