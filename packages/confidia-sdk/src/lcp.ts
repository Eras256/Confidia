import * as crypto from "crypto";

// Required fields per the Legal Context Protocol spec v1.0.0.
const LCP_REQUIRED_FIELDS = ["terms", "atrHash"];

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
  /**
   * Discovers and retrieves the legal context from a domain via a genuine
   * network fetch to https://<domain>/.well-known/legal-context.json — no
   * demo-domain special-casing, so behavior is identical for every caller.
   */
  public async fetchLegalContext(domain: string): Promise<LcpDocument> {
    const url = `https://${domain}/.well-known/legal-context.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch LCP document: ${response.statusText}`);
    }
    const text = await response.text();
    try {
      return JSON.parse(text) as LcpDocument;
    } catch {
      // A 2xx response that isn't JSON usually means the domain has no real
      // LCP document at this path (e.g. a SPA/catch-all route serving its
      // index.html for any unknown path) — surface that plainly instead of
      // leaking a raw "Unexpected token '<'" parse error.
      throw new Error(`Domain does not publish a valid legal-context.json document at ${url}`);
    }
  }

  /**
   * Fetches the raw terms document referenced by an LcpDocument's `terms` URL.
   */
  public async fetchTermsDocument(termsUrl: string): Promise<string> {
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
    for (const field of LCP_REQUIRED_FIELDS) {
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
