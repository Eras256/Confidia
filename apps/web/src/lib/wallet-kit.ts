import {
  StellarWalletsKit,
  Networks,
} from '@creit.tech/stellar-wallets-kit';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';

let isInitialized = false;

function ensureKitInitialized() {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;
  
  StellarWalletsKit.init({
    modules: defaultModules(),
    network: process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET,
  });
  
  isInitialized = true;
}

export async function connectWallet() {
  ensureKitInitialized();
  const result = await StellarWalletsKit.authModal();
  return result; // resolves with { address: string }
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
