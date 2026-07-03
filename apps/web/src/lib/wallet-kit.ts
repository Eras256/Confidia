import {
  StellarWalletsKit,
  Networks,
} from '@creit.tech/stellar-wallets-kit';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';

let isInitialized = false;

// Solid, opaque dark theme matching the Confidia dashboard so the wallet modal
// is fully readable (no transparency, white text on dark cards).
const CONFIDIA_DARK_THEME = {
  'background': '#0b1120',
  'background-secondary': '#151f33',
  'foreground-strong': '#ffffff',
  'foreground': '#e2e8f0',
  'foreground-secondary': '#94a3b8',
  'primary': '#6366f1',
  'primary-foreground': '#ffffff',
  'transparent': 'transparent',
  'lighter': '#1e293b',
  'light': '#182235',
  'light-gray': '#334155',
  'gray': '#64748b',
  'danger': '#f43f5e',
  'border': '#243049',
  'shadow': 'rgba(2, 6, 23, 0.75)',
  'border-radius': '16px',
  'font-family': 'inherit',
};

function ensureKitInitialized() {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;

  StellarWalletsKit.init({
    modules: defaultModules(),
    network: process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET,
    theme: CONFIDIA_DARK_THEME,
  });

  isInitialized = true;
}

export async function connectWallet() {
  ensureKitInitialized();
  const result = await StellarWalletsKit.authModal();
  return result; // resolves with { address: string }
}

/**
 * The kit persists `selectedModuleId` + `activeAddress` in localStorage itself
 * (keys `@StellarWalletsKit/*`) and seeds its in-memory signals from them at
 * module load. So after a page refresh, `getAddress()` already returns the
 * previously connected address — no need to reopen the connect modal. Call
 * this once on mount to silently restore the session.
 */
export async function getStoredAddress(): Promise<string | null> {
  ensureKitInitialized();
  try {
    const { address } = await StellarWalletsKit.getAddress();
    return address || null;
  } catch {
    return null;
  }
}

/** Clears the kit's persisted wallet selection (pairs with our own session cleanup). */
export async function disconnectWallet() {
  ensureKitInitialized();
  try {
    await StellarWalletsKit.disconnect();
  } catch {
    /* no-op — some modules don't implement an explicit disconnect */
  }
}

export async function signTransactionXDR(xdr: string, address: string, networkPassphrase: string) {
  ensureKitInitialized();
  const result = await StellarWalletsKit.signTransaction(xdr, { address, networkPassphrase });
  return result.signedTxXdr;
}

export async function getConnectedNetwork() {
  ensureKitInitialized();
  return StellarWalletsKit.getNetwork();
}
