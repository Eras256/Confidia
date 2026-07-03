import { describe, it, expect } from "vitest";
import { LcpClient, PolicyEngine } from "./index.js";

describe("Confidia SDK Integration Verification", () => {
  const lcpClient = new LcpClient();
  const policyEngine = new PolicyEngine();

  describe("LcpClient", () => {
    it("should fetch and validate a real LCP config from a live domain", async () => {
      const lcp = await lcpClient.fetchLegalContext("confidia.vercel.app");
      expect(lcp.jurisdiction).toBe("US-DE");
      expect(lcpClient.validateLegalContext(lcp)).toBe(true);
    });

    it("should check ATR terms document SHA-256 hash match", async () => {
      const lcp = await lcpClient.fetchLegalContext("confidia.vercel.app");
      const terms = await lcpClient.fetchTermsDocument(lcp.terms);
      expect(lcpClient.verifyAtrHash(terms, lcp.atrHash)).toBe(true);
      expect(lcpClient.verifyAtrHash("altered terms", lcp.atrHash)).toBe(false);
    });

    it("should sign a verifiable Agreement Record", async () => {
      const record = await lcpClient.createAgreementRecord(
        "agent-1",
        "confidia.vercel.app",
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
});
