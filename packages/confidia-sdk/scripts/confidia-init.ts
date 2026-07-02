import { LcpClient } from "../src/lcp.js";
import { PolicyEngine } from "../src/policy.js";
import { ZkClient } from "../src/zk.js";
import { ConfidentialTokenClient } from "../src/confidential.js";
import { StellarAgentClient } from "../src/stellar-agent.js";
import { CONFIDIA_ASSETS } from "confidia-config";
import { execSync } from "child_process";

async function verifyTool(cmd: string, name: string): Promise<boolean> {
  try {
    execSync(cmd, { stdio: "ignore" });
    console.log(`  \x1b[32m✓\x1b[0m ${name} is available`);
    return true;
  } catch {
    console.log(`  \x1b[31m✗\x1b[0m ${name} is NOT available`);
    return false;
  }
}

async function runDeveloperJourney() {
  console.log("\x1b[36m===================================================\x1b[0m");
  console.log("\x1b[36m   CONFIDIA: ZK AGENTIC PAYMENTS DEV JOURNEY CLI   \x1b[0m");
  console.log("\x1b[36m===================================================\x1b[0m");

  console.log("\n\x1b[35m[Step 1] Checking Environment Toolchain...\x1b[0m");
  await verifyTool("node -v", "Node.js");
  await verifyTool("pnpm -v", "pnpm");
  await verifyTool("cargo --version", "Rust Cargo");
  await verifyTool("stellar --version", "Stellar CLI");
  await verifyTool("supabase --version", "Supabase CLI");
  await verifyTool("fly version", "Fly CLI");

  console.log("\n\x1b[35m[Step 2] Validating LCP Discovery Module...\x1b[0m");
  const lcpClient = new LcpClient(true);
  const domain = "treasury.example.mx";
  console.log(`  Resolving LCP for domain: ${domain}...`);
  const lcp = await lcpClient.fetchLegalContext(domain);
  const isLcpValid = lcpClient.validateLegalContext(lcp);
  
  if (isLcpValid) {
    console.log("  \x1b[32m✓\x1b[0m LCP discovered successfully.");
    console.log(`    - Jurisdiction: ${lcp.jurisdiction}`);
    console.log(`    - Dispute Resolution: ${lcp.disputeResolution}`);
    console.log(`    - ATR Hash: ${lcp.atrHash.substring(0, 16)}...`);
  } else {
    throw new Error("LCP verification failure.");
  }

  console.log("\n\x1b[35m[Step 3] Testing Policy Engine Rules...\x1b[0m");
  const policyEngine = new PolicyEngine();
  const rules = {
    maxStandardAmount: 5000,
    requireConfidential: true,
    requiredProofs: ["zkBalance", "zkEligibility"],
    allowedJurisdictions: ["MX", "US", "DE"]
  };

  const evalStandard = policyEngine.evaluate(
    { amount: 3000, assetCode: "USDC", jurisdiction: "MX", isAccredited: true },
    rules
  );
  console.log(`  - Tx under threshold: uses ${evalStandard.tokenType.toUpperCase()} tokens`);

  const evalConf = policyEngine.evaluate(
    { amount: 15000, assetCode: "USDC", jurisdiction: "MX", isAccredited: true },
    rules
  );
  console.log(`  - Tx over threshold: uses ${evalConf.tokenType.toUpperCase()} tokens (Requires: ${evalConf.requiredProofs.join(", ")})`);

  console.log("\n\x1b[35m[Step 4] Executing ZK Prover & Pedersen commitments...\x1b[0m");
  const zkClient = new ZkClient();
  const inputs = {
    balance: 20000,
    transferAmount: 15000,
    commitment: "e2c849103...commitment",
    transferAmountCommitment: "e3b0c44...transCommitment",
    randomness: "salt"
  };

  console.log("  Generating zkBalance proof bytes...");
  const proofResult = await zkClient.ultrahonk.generateProof("zkBalance", inputs);
  console.log(`    - Proof length: ${proofResult.proof.length} hex chars`);
  
  console.log("  Verifying ZK proof on-chain simulation...");
  const isProofOk = await zkClient.ultrahonk.verifyProof("zkBalance", proofResult.proof, proofResult.publicInputs);
  console.log(`    - Proof Verification: ${isProofOk ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}`);

  console.log("\n\x1b[35m[Step 5] Orchestrating E2E Agentic Payment...\x1b[0m");
  const agentClient = new StellarAgentClient(true);
  const receipt = await agentClient.executePayment({
    agentId: "agent-1",
    agentPrivateKey: "SAGENTMOCKPRIVATEKEY72304892304892304892348",
    targetDomain: "treasury.example.mx",
    amount: 15000,
    assetCode: "USDC",
    policyRules: rules,
    userKYCState: {
      jurisdiction: "MX",
      isAccredited: true,
      userBalance: 20000
    }
  });

  if (receipt.success) {
    console.log("\n\x1b[32m===================================================\x1b[0m");
    console.log("\x1b[32m   CONGRATULATIONS: DEV JOURNEY COMPLETED!        \x1b[0m");
    console.log("\x1b[32m===================================================\x1b[0m");
    console.log(`  Payment status: Success`);
    console.log(`  Token type: ${receipt.tokenType.toUpperCase()}`);
    console.log(`  TX Hash: ${receipt.txHash}`);
    console.log(`  ATR Hash Agreement: ${receipt.agreementRecord.atrHash}`);
    console.log(`  Signature: ${receipt.agreementRecord.signature.substring(0, 24)}...`);
    console.log(`  Proofs verified: ${receipt.proofsGenerated.join(", ")}`);
    console.log("\x1b[32m===================================================\x1b[0m\n");
  } else {
    console.log("\x1b[31m  ✗ Dev journey failed executing payment orchestrator.\x1b[0m\n");
  }
}

runDeveloperJourney().catch((err) => {
  console.error("\x1b[31mError during developer journey execution:\x1b[0m", err);
});
