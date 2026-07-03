import { LCP_SPEC } from "confidia-config";
import { MockLcpServer } from "confidia-test-utils";
import * as crypto from "crypto";

export interface LcpDocument {
  terms: string;
  atrHash: string;
  termsFormat: string;
  acceptanceRequired: boolean;
  jurisdiction?: string;
  disputeResolution?: string;
  consentModel?: string;
}

export interface AgreementRecord {
  agentId: string;
  domain: string;
  atrHash: string;
  consentTimestamp: string;
  signature: string;
  status: "signed" | "active" | "disputed";
}

export class LcpClient {
  private isTestEnv: boolean;

  constructor(isTestEnv = false) {
    this.isTestEnv = isTestEnv;
  }

  /**
   * Discovers and retrieves the legal context from a domain.
   *
   * The two named fixture domains (treasury.example.mx, issuer.example.com)
   * are demo data seeded elsewhere in the app (Overview/Agents cards) and
   * don't resolve on the real internet, so they always go through the mock.
   * Every other domain — including the app's own real domain — gets a
   * genuine network fetch. `isTestEnv` no longer forces the mock path: this
   * app's API runs with NODE_ENV=development on purpose (see Dockerfile.api),
   * and gating real network I/O on that flag meant registering any real
   * domain (e.g. confidia.vercel.app) silently 404'd against the mock.
   */
  public async fetchLegalContext(domain: string): Promise<LcpDocument> {
    const url = `https://${domain}/.well-known/legal-context.json`;
    if (domain.includes("example.mx") || domain.includes("example.com")) {
      return await MockLcpServer.fetchLcp(url);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch LCP document: ${response.statusText}`);
    }
    return await response.json() as LcpDocument;
  }

  /**
   * Fetches the raw terms document of the LCP. See fetchLegalContext for why
   * only the named fixture domains use the mock.
   */
  public async fetchTermsDocument(termsUrl: string): Promise<string> {
    if (termsUrl.includes("example.mx") || termsUrl.includes("example.com")) {
      return await MockLcpServer.fetchLcp(termsUrl);
    }
    const response = await fetch(termsUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch terms document: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Validates LcpDocument according to the protocol rules.
   */
  public validateLegalContext(lcp: any): boolean {
    for (const field of LCP_SPEC.requiredFields) {
      if (!lcp || typeof lcp !== "object" || !(field in lcp)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Verifies if the terms text SHA-256 matches the expected ATR hash.
   */
  public verifyAtrHash(termsText: string, expectedHash: string): boolean {
    // Standardize newlines before hashing
    const normalized = termsText.replace(/\r\n/g, "\n");
    const hash = crypto.createHash("sha256").update(normalized).digest("hex");
    
    // Clean expected hash (remove prefix 0x if present)
    const cleanExpected = expectedHash.replace(/^0x/, "");
    return hash === cleanExpected;
  }

  /**
   * Signs and creates a verifiable Agreement Record.
   */
  public async createAgreementRecord(
    agentId: string,
    domain: string,
    atrHash: string,
    agentPrivateKey: string
  ): Promise<AgreementRecord> {
    const consentTimestamp = new Date().toISOString();
    const payload = `${agentId}:${domain}:${atrHash}:${consentTimestamp}`;
    
    // Compute signature using mock/SHA256 signature
    const signature = crypto
      .createHmac("sha256", agentPrivateKey)
      .update(payload)
      .digest("hex");

    return {
      agentId,
      domain,
      atrHash,
      consentTimestamp,
      signature,
      status: "signed"
    };
  }
}
