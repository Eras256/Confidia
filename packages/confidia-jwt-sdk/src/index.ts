import * as crypto from "crypto";

export interface DecodedJwt {
  header: { alg: string; typ: string; kid?: string };
  payload: OidcClaimPayload;
  signature: string;
}

/** Standard OIDC claim payload used in Confidia distribution eligibility proofs */
export interface OidcClaimPayload {
  sub: string;          // subject (user ID)
  iss: string;          // issuer (e.g. accounts.google.com)
  aud: string | string[]; // audience (client_id)
  exp: number;          // expiry (unix timestamp)
  iat: number;          // issued at (unix timestamp)
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  nonce?: string;
  [key: string]: unknown;
}

/** SEP-10 session JWT payload issued by Confidia backend */
export interface Sep10SessionPayload {
  address: string;      // Stellar G-address of authenticated wallet
  scope: string;        // e.g. "payout_claim"
  iat: number;
  exp: number;
}

export function parseJwt(token: string): DecodedJwt {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format: expected 3 dot-separated segments.");
  }

  const decodeSegment = (seg: string) => {
    let base64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
  };

  return {
    header: decodeSegment(parts[0]),
    payload: decodeSegment(parts[1]),
    signature: parts[2]
  };
}

/**
 * Checks if a decoded JWT payload is currently valid (not expired, not future-issued).
 */
export function validateJwtExpiry(payload: OidcClaimPayload | Sep10SessionPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return false;  // expired
  if (payload.iat && payload.iat > now + 60) return false;  // issued in the future (clock skew > 1m)
  return true;
}

/**
 * Fetches JWKS (JSON Web Key Set) for an OIDC provider. Returns the list of public keys.
 */
export async function fetchJwks(jwksUrl: string): Promise<any[]> {
  if (
    jwksUrl.includes("mock") ||
    jwksUrl.includes("example") ||
    jwksUrl.includes("localhost")
  ) {
    return [
      {
        kid: "mock-google-key-id",
        kty: "RSA",
        alg: "RS256",
        n: "mock-n-parameter-modulus-representing-google-public-key",
        e: "AQAB"
      }
    ];
  }

  try {
    const res = await fetch(jwksUrl, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) throw new Error(`JWKS fetch HTTP ${res.status}`);
    const json = await res.json();
    return json.keys || [];
  } catch (error) {
    console.warn(`JWKS fetch failed for ${jwksUrl}, returning empty set.`, error);
    return [];
  }
}

/**
 * Resolves the JWKS URL for a well-known OIDC issuer.
 * Supports Google, GitHub OAuth (mock), and generic OIDC discovery.
 */
export async function resolveJwksUrl(issuer: string): Promise<string> {
  const knownIssuers: Record<string, string> = {
    "accounts.google.com": "https://www.googleapis.com/oauth2/v3/certs",
    "https://accounts.google.com": "https://www.googleapis.com/oauth2/v3/certs",
    "https://token.actions.githubusercontent.com": "https://token.actions.githubusercontent.com/.well-known/jwks",
  };

  if (knownIssuers[issuer]) return knownIssuers[issuer];

  // Try standard OpenID Connect discovery document
  const discoveryUrl = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  try {
    const res = await fetch(discoveryUrl);
    if (res.ok) {
      const doc = await res.json();
      if (doc.jwks_uri) return doc.jwks_uri;
    }
  } catch {
    // fall through
  }

  throw new Error(`Cannot resolve JWKS URL for issuer: ${issuer}`);
}

/**
 * Computes the ZK-compatible JWT nullifier: a deterministic hash of (iss + sub + salt)
 * that can be used to prevent double-claims without revealing identity.
 */
export function getJwtNullifier(jwtPayload: OidcClaimPayload, salt: string): string {
  const sub = jwtPayload.sub || "anonymous";
  const iss = jwtPayload.iss || "unknown";
  const content = `${iss}:${sub}:${salt}`;
  return crypto.createHash("sha256").update(content).digest("hex");
}
