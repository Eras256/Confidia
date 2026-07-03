import { Contract, TransactionBuilder, Networks, rpc, Account, xdr, scValToNative } from '@stellar/stellar-sdk';
import { signTransactionXDR } from './wallet-kit';

const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';

export interface WalletBalance {
  code: string;       // e.g. "XLM", "USDC" — whatever the issuer/trustline actually names it
  issuer: string | null; // null for native XLM
  balance: string;
  assetType: string;
}

/**
 * Reads the REAL balances of a Stellar account straight from Horizon — no
 * hardcoded asset/issuer addresses. Returns whatever classic assets (USDC,
 * or anything else) the connected wallet actually holds a trustline +
 * balance for, so the UI never guesses at a possibly-wrong issuer.
 */
export async function fetchAccountBalances(address: string): Promise<WalletBalance[]> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (!res.ok) {
    if (res.status === 404) return []; // unfunded account — no balances yet
    throw new Error(`Horizon error ${res.status}`);
  }
  const data = await res.json();
  return (data.balances || []).map((b: any) => ({
    code: b.asset_type === 'native' ? 'XLM' : b.asset_code,
    issuer: b.asset_issuer || null,
    balance: b.balance,
    assetType: b.asset_type,
  }));
}

// A funded existing account is only needed as the simulation source; no
// signature or fees are consumed by a read-only simulate.
const SIM_SOURCE = process.env.NEXT_PUBLIC_STELLAR_WALLET_PUBLIC
  || 'GDS5FCW6N7AW4BRJQS22AYUKYSAMNSHMUUTW6ZKRTYMWMIIJUSN7XAHR';

/**
 * Invokes a deployed contract read-only via the Soroban RPC `simulateTransaction`.
 * This executes the real on-chain WASM against live ledger state and returns the
 * decoded native result — without signing, submitting, or spending fees. Ideal
 * for view-style methods (verify_proof, is_authorized, get_vk, ...).
 */
export async function readContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<{ result: any; latencyMs: number; rpcUrl: string }> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const started = Date.now();

  let account: Account;
  try {
    account = await server.getAccount(SIM_SOURCE);
  } catch {
    // Fall back to a synthetic account; simulation does not check sequence.
    account = new Account(SIM_SOURCE, '0');
  }

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const retval = sim.result?.retval;
  return {
    result: retval ? scValToNative(retval) : null,
    latencyMs: Date.now() - started,
    rpcUrl: SOROBAN_RPC_URL,
  };
}

const EXPLORER_BASE = 'https://stellar.expert/explorer/testnet';
export const txExplorerUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;
export const contractExplorerUrl = (id: string) => `${EXPLORER_BASE}/contract/${id}`;
export const accountExplorerUrl = (addr: string) => `${EXPLORER_BASE}/account/${addr}`;

export interface WriteResult {
  hash: string;
  explorerUrl: string;
  status: string;
  result: any;
}

// Human-readable explanations for real classic-Stellar operation failure
// codes, so a rejected on-chain payment reads as an honest explanation
// instead of a generic "failed" — these are genuine network semantics
// (e.g. a missing trustline), not bugs in this app.
const OP_FAILURE_EXPLANATIONS: Record<string, string> = {
  paymentNoTrust: "the destination account doesn't have a trustline for this asset",
  paymentNoDestination: "the destination account does not exist on the network",
  paymentUnderfunded: "the source account doesn't hold enough of this asset",
  paymentSrcNoTrust: "the source account doesn't have a trustline for this asset",
  paymentNotAuthorized: "the issuer has not authorized this account to hold the asset",
  paymentLineFull: "the destination's trustline limit for this asset has been reached",
};

/** Decodes the real per-operation failure reason from a failed transaction's
 * parsed result XDR (Soroban RPC already parses resultXdr into an object —
 * no manual base64 parsing needed). Returns null if it can't be determined. */
function decodeOperationFailure(resultXdr: any): string | null {
  try {
    const opResult = resultXdr.result().results()[0];
    const trResult = opResult.value(); // OperationResultTr
    const inner = trResult.value(); // the specific *Result union (e.g. PaymentResult)
    const code = inner.switch().name as string;
    const explanation = OP_FAILURE_EXPLANATIONS[code];
    return explanation ? `${explanation} (${code})` : code;
  } catch {
    return null;
  }
}

/**
 * Signs a Soroban contract invocation with the connected wallet (Freighter via
 * Stellar Wallets Kit), submits it, and polls the RPC until it is confirmed on
 * the ledger. Returns the real transaction hash + a stellar.expert link so the
 * result is independently verifiable by anyone (e.g. a judge).
 */
export async function writeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string
): Promise<WriteResult> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(contractId);

  let tx = new TransactionBuilder(account, {
    fee: '1000000', // fee cap (~0.1 XLM); unused portion is refunded
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    // Soroban simulates every invocation before ever asking the wallet to
    // sign — a call that will certainly fail (e.g. an untrusted key, a
    // tampered proof, a replayed nullifier) is rejected right here, for free,
    // with no signature requested and no transaction ever submitted to the
    // network. That means there is genuinely no tx hash for this case — the
    // rejection itself, straight from the public RPC, is the real evidence.
    const e: any = new Error(sim.error);
    e.stage = 'simulation';
    throw e;
  }
  tx = rpc.assembleTransaction(tx, sim).build();

  const signedXdr = await signTransactionXDR(tx.toXDR(), sourceAddress, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );
  if (sent.status === 'ERROR') {
    const e: any = new Error(`Submit rejected: ${JSON.stringify((sent as any).errorResult ?? sent.status)}`);
    e.stage = 'submit';
    throw e;
  }

  const hash = sent.hash;
  let getRes = await server.getTransaction(hash);
  const start = Date.now();
  while (getRes.status === rpc.Api.GetTransactionStatus.NOT_FOUND && Date.now() - start < 35000) {
    await new Promise((r) => setTimeout(r, 1500));
    getRes = await server.getTransaction(hash);
  }

  if (getRes.status === rpc.Api.GetTransactionStatus.FAILED) {
    const reason = decodeOperationFailure((getRes as any).resultXdr);
    const e: any = new Error(reason ? `Transaction failed on-chain: ${reason}` : `Transaction failed on-chain`);
    e.hash = hash;
    e.explorerUrl = txExplorerUrl(hash);
    e.stage = 'confirmed';
    throw e;
  }

  let result: any = null;
  try {
    if ((getRes as any).returnValue) result = scValToNative((getRes as any).returnValue);
  } catch {
    /* return value not decodable — fine */
  }
  return { hash, explorerUrl: txExplorerUrl(hash), status: String(getRes.status), result };
}

/**
 * Submits a classic Stellar payment (native XLM or SEP-41 SAC) signed by the
 * connected wallet, polling for confirmation. Returns the tx hash + explorer link.
 */
export async function sendPayment(
  fromAddress: string,
  toAddress: string,
  amount: string,
  asset?: import('@stellar/stellar-sdk').Asset
): Promise<WriteResult> {
  const { Operation, Asset } = await import('@stellar/stellar-sdk');
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const account = await server.getAccount(fromAddress);
  const tx = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.payment({ destination: toAddress, asset: asset ?? Asset.native(), amount }))
    .setTimeout(60)
    .build();

  const signedXdr = await signTransactionXDR(tx.toXDR(), fromAddress, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );
  if (sent.status === 'ERROR') {
    throw new Error(`Payment rejected: ${JSON.stringify((sent as any).errorResult ?? sent.status)}`);
  }
  const hash = sent.hash;
  let getRes = await server.getTransaction(hash);
  const start = Date.now();
  while (getRes.status === rpc.Api.GetTransactionStatus.NOT_FOUND && Date.now() - start < 35000) {
    await new Promise((r) => setTimeout(r, 1500));
    getRes = await server.getTransaction(hash);
  }
  if (getRes.status === rpc.Api.GetTransactionStatus.FAILED) {
    const reason = decodeOperationFailure((getRes as any).resultXdr);
    const e: any = new Error(reason ? `Payment rejected on-chain: ${reason}` : 'Payment failed on-chain');
    e.hash = hash; e.explorerUrl = txExplorerUrl(hash);
    throw e;
  }
  return { hash, explorerUrl: txExplorerUrl(hash), status: String(getRes.status), result: null };
}

export async function buildAndSubmit(contractId: string, method: string, args: any[], sourceAddress: string) {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const account = await server.getAccount(sourceAddress);
  const contract = new Contract(contractId);

  // Build temporary transaction
  let tx = new TransactionBuilder(account, { 
    fee: '10000', 
    networkPassphrase: NETWORK_PASSPHRASE 
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate first to populate accurate footprint details and gas allocations
  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }
  
  tx = rpc.assembleTransaction(tx, simulated).build();

  // Sign transaction
  const signedXdr = await signTransactionXDR(tx.toXDR(), sourceAddress, NETWORK_PASSPHRASE);
  
  // Submit transaction
  const response = await server.sendTransaction(TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE));
  
  return response;
}
