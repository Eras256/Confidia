#!/usr/bin/env node
/**
 * Confidia — Soroban Testnet Deployment
 * ------------------------------------------------------------------
 * Builds (optional) and deploys the 5 Confidia contracts to Stellar
 * Testnet, initializes them, and records the resulting contract IDs to:
 *   - contracts/deployments.testnet.json   (canonical registry)
 *   - .env                                  (*_CONTRACT_ID vars)
 *   - db.json                               (contract_registry table)
 *
 * Usage:
 *   node packages/confidia-sdk/scripts/deploy.js [--skip-build] [--no-init]
 *
 * Requires:
 *   - stellar CLI on PATH
 *   - STELLAR_WALLET_SECRET (deployer secret) in .env or environment
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const CONTRACTS_DIR = path.join(ROOT, "contracts");
const WASM_DIR = path.join(
  CONTRACTS_DIR,
  "target",
  "wasm32-unknown-unknown",
  "release"
);
const NETWORK = process.env.STELLAR_NETWORK || "testnet";

// ── Load .env (lightweight parser, no dependency) ───────────────────
function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = { ...loadEnv(), ...process.env };
const SECRET = env.STELLAR_WALLET_SECRET;
const DEPLOYER_PUB = env.STELLAR_WALLET_PUBLIC;
if (!SECRET) {
  console.error("✖ STELLAR_WALLET_SECRET not set (checked .env and env vars).");
  process.exit(1);
}

const skipBuild = process.argv.includes("--skip-build");
const noInit = process.argv.includes("--no-init");

// Deploy order respects cross-contract dependencies.
const CONTRACTS = [
  { key: "jwkRegistry", wasm: "jwk_registry.wasm", envVar: "JWK_REGISTRY_CONTRACT_ID" },
  { key: "ultrahonkVerifier", wasm: "ultrahonk_verifier.wasm", envVar: "VERIFIER_CONTRACT_ID" },
  { key: "compliance", wasm: "compliance.wasm", envVar: "COMPLIANCE_CONTRACT_ID" },
  { key: "vestingClaim", wasm: "vesting_claim.wasm", envVar: "VESTING_CLAIM_CONTRACT_ID" },
  { key: "gateway", wasm: "gateway.wasm", envVar: "GATEWAY_CONTRACT_ID" },
];

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` },
    ...opts,
  });
}

function deployOne(wasmFile) {
  const wasmPath = path.join(WASM_DIR, wasmFile);
  if (!fs.existsSync(wasmPath)) throw new Error(`Missing wasm: ${wasmPath}`);
  const out = sh(
    `stellar contract deploy --wasm "${wasmPath}" --source "${SECRET}" --network ${NETWORK}`,
    { capture: true }
  );
  // The contract id is the last line matching the strkey contract format.
  const id = out
    .split("\n")
    .map((l) => l.trim())
    .reverse()
    .find((l) => /^C[A-Z2-7]{55}$/.test(l));
  if (!id) throw new Error(`Could not parse contract id from output:\n${out}`);
  return id;
}

function invoke(id, args) {
  try {
    sh(
      `stellar contract invoke --id ${id} --source "${SECRET}" --network ${NETWORK} -- ${args}`,
      { capture: true }
    );
    return true;
  } catch (e) {
    console.warn(`  ⚠ init call failed (non-fatal): ${args.split(" ")[0]}`);
    return false;
  }
}

// ── 1. Build ────────────────────────────────────────────────────────
// Soroban's VM (via soroban-sdk =20.0.0) only accepts MVP WebAssembly.
// Rust 1.82+ ships precompiled `std` with reference-types/multivalue on,
// so a plain `cargo build` links opcodes the VM rejects
// ("reference-types not enabled"). We recompile `std` MVP-clean with
// `-Z build-std` on a nightly toolchain and disable the features via
// RUSTFLAGS. Override the toolchain with CONFIDIA_WASM_TOOLCHAIN.
if (!skipBuild) {
  console.log("▶ Building contracts (wasm32, release, MVP feature set via build-std)…");
  const toolchain = process.env.CONFIDIA_WASM_TOOLCHAIN || "nightly-2025-02-04";
  execSync(
    `cargo +${toolchain} build --manifest-path "${path.join(CONTRACTS_DIR, "Cargo.toml")}" --target wasm32-unknown-unknown --release -Z build-std=std,panic_abort`,
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
        RUSTFLAGS: "-C target-feature=-reference-types,-multivalue",
      },
    }
  );
}

// ── 2. Deploy ───────────────────────────────────────────────────────
const deployed = {};
for (const c of CONTRACTS) {
  console.log(`▶ Deploying ${c.key} (${c.wasm})…`);
  deployed[c.key] = deployOne(c.wasm);
  console.log(`  ✅ ${c.key} = ${deployed[c.key]}`);
}

// ── 3. Initialize (best-effort) ─────────────────────────────────────
if (!noInit && DEPLOYER_PUB) {
  console.log("▶ Initializing contracts…");
  // stateless verifier: register admin so VK rotation is possible
  invoke(deployed.ultrahonkVerifier, `initialize --admin ${DEPLOYER_PUB}`);
  // compliance: register admin
  invoke(deployed.compliance, `initialize --admin ${DEPLOYER_PUB}`);
  // gateway: wire verifier + compliance hooks
  invoke(
    deployed.gateway,
    `initialize --admin ${DEPLOYER_PUB} --zk_verifier ${deployed.ultrahonkVerifier} --compliance_hook ${deployed.compliance}`
  );
  // vesting-claim vault: demo root + funding token placeholder (deployer addr)
  const demoRoot = "0000000000000000000000000000000000000000000000000000000000000000";
  invoke(
    deployed.vestingClaim,
    `initialize --root ${demoRoot} --token ${DEPLOYER_PUB} --verifier ${deployed.ultrahonkVerifier} --jwk_registry ${deployed.jwkRegistry}`
  );
}

// ── 4. Persist registry ─────────────────────────────────────────────
const registry = {
  network: NETWORK,
  deployedAt: new Date().toISOString(),
  deployer: DEPLOYER_PUB || null,
  rpcUrl:
    env.SOROBAN_RPC_URL ||
    (NETWORK === "testnet" ? "https://soroban-testnet.stellar.org" : ""),
  contracts: deployed,
};
const registryPath = path.join(CONTRACTS_DIR, "deployments.testnet.json");
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
console.log(`▶ Wrote ${path.relative(ROOT, registryPath)}`);

// ── 5. Update .env (upsert *_CONTRACT_ID vars) ──────────────────────
// Upsert `KEY=value` lines into an env file, creating the file/header if needed.
function upsertEnv(filePath, header, entries) {
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (header && !text.includes(header)) {
    text = text.replace(/\n*$/, "\n") + `\n${header}\n`;
  }
  for (const [key, value] of entries) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : text.replace(/\n*$/, "\n") + line + "\n";
  }
  fs.writeFileSync(filePath, text);
}

// Backend .env — plain *_CONTRACT_ID vars (read by the API loader/fallback).
upsertEnv(
  path.join(ROOT, ".env"),
  "# ── Deployed Contracts (Testnet) ────────────────────────────",
  CONTRACTS.map((c) => [c.envVar, deployed[c.key]])
);
console.log("▶ Updated .env with contract IDs");

// Frontend apps/web/.env.local — NEXT_PUBLIC_* so the browser bundle can read
// the deployed addresses at build time (contract IDs are public on-chain data).
upsertEnv(
  path.join(ROOT, "apps/web/.env.local"),
  "# ── Deployed Contracts (Stellar Testnet) ────────────────────",
  CONTRACTS.map((c) => [`NEXT_PUBLIC_${c.envVar}`, deployed[c.key]])
);
console.log("▶ Updated apps/web/.env.local with NEXT_PUBLIC contract IDs");

// ── 6. Update db.json (contract_registry table) ─────────────────────
const dbPath = path.join(ROOT, "db.json");
let db = {};
try {
  if (fs.existsSync(dbPath)) db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
} catch (_) {
  db = {};
}
db.contract_registry = [
  {
    id: "testnet",
    ...registry,
  },
];
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log("▶ Updated db.json contract_registry");

console.log("\n✅ Deployment complete:\n");
for (const c of CONTRACTS) console.log(`   ${c.key.padEnd(20)} ${deployed[c.key]}`);
console.log(`\n   Explorer: https://stellar.expert/explorer/testnet/contract/${deployed.gateway}`);
