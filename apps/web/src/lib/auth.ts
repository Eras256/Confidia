import { signTransactionXDR } from './wallet-kit';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchJSON(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    // API returned HTML or non-JSON (e.g. server is down)
    throw new Error(
      `API returned non-JSON response (status ${response.status}). Is the API server running on port 3001?`
    );
  }
}

export async function authenticateWithWallet(address: string): Promise<string> {
  // 1. Request SEP-10 challenge from backend
  const challenge = await fetchJSON(`${API_BASE}/auth/challenge?address=${address}`);

  if (challenge.error) {
    throw new Error(`Challenge error: ${challenge.error}`);
  }

  // 2. Sign the challenge transaction with the connected wallet
  const signedXdr = await signTransactionXDR(
    challenge.transaction,
    address,
    challenge.network_passphrase
  );

  // 3. Submit signed transaction for JWT issuance
  const result = await fetchJSON(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedXdr }),
  });

  if (result.error) {
    throw new Error(`Verification error: ${result.error}`);
  }

  return result.token;
}
