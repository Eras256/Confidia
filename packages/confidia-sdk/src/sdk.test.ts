import { describe, it, expect } from "vitest";
import { 
  LcpClient, 
  PolicyEngine, 
  ZkClient, 
  ConfidentialTokenClient, 
  StellarAgentClient 
} from "./index.js";

describe("Confidia SDK Integration Verification", () => {
  const lcpClient = new LcpClient(true);
  const policyEngine = new PolicyEngine();
  const zkClient = new ZkClient();
  const confidentialClient = new ConfidentialTokenClient();
  const agentClient = new StellarAgentClient(true);

  describe("LcpClient", () => {
    it("should fetch and validate LCP config for treasury.example.mx", async () => {
      const lcp = await lcpClient.fetchLegalContext("treasury.example.mx");
      expect(lcp.jurisdiction).toBe("MX");
      expect(lcp.disputeResolution).toBe("UNCITRAL");
      expect(lcpClient.validateLegalContext(lcp)).toBe(true);
    });

    it("should check ATR terms document SHA-256 hash match", async () => {
      const lcp = await lcpClient.fetchLegalContext("treasury.example.mx");
      const terms = await lcpClient.fetchTermsDocument(lcp.terms);
      expect(lcpClient.verifyAtrHash(terms, lcp.atrHash)).toBe(true);
      expect(lcpClient.verifyAtrHash("altered terms", lcp.atrHash)).toBe(false);
    });

    it("should sign a verifiable Agreement Record", async () => {
      const record = await lcpClient.createAgreementRecord(
        "agent-1",
        "treasury.example.mx",
        "mock_atr_hash",
        "secret_priv_key"
      );
      expect(record.agentId).toBe("agent-1");
      expect(record.status).toBe("signed");
      expect(record.signature).toBeDefined();
    });
  });

  describe("PolicyEngine", () => {
    const rules = {
      maxStandardAmount: 5000,
      requireConfidential: false,
      requiredProofs: ["zkBalance"],
      allowedJurisdictions: ["MX", "US"]
    };

    it("should choose standard token standard below threshold", () => {
      const evalRes = policyEngine.evaluate(
        { amount: 3000, assetCode: "USDC", jurisdiction: "MX", isAccredited: true },
        rules
      );
      expect(evalRes.allowed).toBe(true);
      expect(evalRes.tokenType).toBe("standard");
    });

    it("should choose confidential token standard above threshold", () => {
      const evalRes = policyEngine.evaluate(
        { amount: 12000, assetCode: "USDC", jurisdiction: "MX", isAccredited: true },
        rules
      );
      expect(evalRes.allowed).toBe(true);
      expect(evalRes.tokenType).toBe("confidential");
      expect(evalRes.requiredProofs).toContain("zkBalance");
    });

    it("should block transacting in unauthorized jurisdictions", () => {
      const evalRes = policyEngine.evaluate(
        { amount: 2000, assetCode: "USDC", jurisdiction: "CA" },
        rules
      );
      expect(evalRes.allowed).toBe(false);
    });
  });

  describe("ZkClient", () => {
    it("should generate and verify zkBalance proof", async () => {
      const inputs = {
        balance: 10000,
        transferAmount: 5000,
        commitment: "comm1",
        transferAmountCommitment: "comm2",
        randomness: "salt"
      };

      const proofObj = await zkClient.ultrahonk.generateProof("zkBalance", inputs);
      expect(proofObj.proof.startsWith("0x")).toBe(true);

      const isValid = await zkClient.ultrahonk.verifyProof("zkBalance", proofObj.proof, proofObj.publicInputs);
      expect(isValid).toBe(true);
    });

    it("should fail validation if balance is insufficient", async () => {
      const inputs = {
        balance: 2000,
        transferAmount: 5000,
        commitment: "comm1",
        transferAmountCommitment: "comm2",
        randomness: "salt"
      };

      const proofObj = await zkClient.ultrahonk.generateProof("zkBalance", inputs);
      const isValid = await zkClient.ultrahonk.verifyProof("zkBalance", proofObj.proof, proofObj.publicInputs);
      expect(isValid).toBe(false);
    });
  });

  describe("ConfidentialTokenClient", () => {
    it("should wrap assets, transfer balances, and generate disclosures", async () => {
      const depositRes = await confidentialClient.deposit(5000, "USDC", "GUSERKEY");
      expect(depositRes.txHash).toBeDefined();

      const transferRes = await confidentialClient.confidentialTransfer(
        "agent-1",
        "treasury.example.mx",
        3000,
        "USDC",
        "0xvalidproof",
        ["pub_in_1"]
      );
      expect(transferRes.txHash).toBeDefined();

      // Test auditor view-key balance decryption
      const decrypted = confidentialClient.decryptBalance(transferRes.senderCommitment, "auditor_key");
      expect(decrypted).toBeGreaterThan(0);

      // Test selective disclosure compilation
      const disclosure = await confidentialClient.generateSelectiveDisclosure(
        "tx-1",
        "agent-1",
        "treasury.example.mx",
        3000,
        "auditor_key",
        "receiver-1"
      );
      expect(disclosure.checksum).toBeDefined();
      expect(confidentialClient.verifySelectiveDisclosure(disclosure, "auditor_key")).toBe(true);
    });
  });

  describe("StellarAgentClient", () => {
    it("should process an E2E compliant agentic payment successfully", async () => {
      const rules = {
        maxStandardAmount: 5000,
        requireConfidential: true,
        requiredProofs: ["zkBalance", "zkEligibility"],
        allowedJurisdictions: ["MX", "US"]
      };

      const receipt = await agentClient.executePayment({
        agentId: "agent-1",
        agentPrivateKey: "secret-agent-key",
        targetDomain: "treasury.example.mx",
        amount: 8500,
        assetCode: "USDC",
        policyRules: rules,
        userKYCState: {
          jurisdiction: "MX",
          isAccredited: true,
          userBalance: 15000
        }
      });

      expect(receipt.success).toBe(true);
      expect(receipt.tokenType).toBe("confidential");
      expect(receipt.proofsGenerated).toContain("zkBalance");
      expect(receipt.proofsGenerated).toContain("zkEligibility");
      expect(receipt.agreementRecord.atrHash).toBeDefined();
    });
  });
});
