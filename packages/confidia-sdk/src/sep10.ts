/**
 * SEP-10 Web Authentication types and client helpers for Confidia SDK.
 * These types are shared between the frontend (wallet-kit, auth.ts) and backend (server.ts).
 */

export interface Sep10Challenge {
  /** Base64-encoded XDR of the unsigned challenge transaction */
  transaction: string;
  /** Stellar network passphrase the transaction was built for */
  network_passphrase: string;
}

export interface Sep10VerifyRequest {
  /** Signed XDR envelope returned by the wallet */
  transaction: string;
}

export interface Sep10Session {
  /** JWT token issued after successful SEP-10 challenge verification */
  token: string;
  /** Stellar G-address of the authenticated account */
  address: string;
  /** Unix timestamp when the session expires */
  expiresAt: number;
}

/**
 * Fetches a SEP-10 challenge for the given Stellar address from a Confidia API endpoint.
 */
export async function fetchSep10Challenge(
  apiBase: string,
  address: string
): Promise<Sep10Challenge> {
  const res = await fetch(`${apiBase}/auth/challenge?address=${address}`);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error);
    return data as Sep10Challenge;
  } catch {
    throw new Error(
      `SEP-10 challenge endpoint returned non-JSON (status ${res.status}). Is the API running?`
    );
  }
}

/**
 * Submits a signed SEP-10 challenge transaction to receive a session JWT.
 */
export async function verifySep10Signature(
  apiBase: string,
  signedXdr: string
): Promise<Sep10Session> {
  const res = await fetch(`${apiBase}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signedXdr } satisfies Sep10VerifyRequest)
  });
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error);
    return {
      token: data.token,
      address: data.address || "",
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    };
  } catch {
    throw new Error(
      `SEP-10 verify endpoint returned non-JSON (status ${res.status}). Is the API running?`
    );
  }
}
