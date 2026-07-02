import { Contract, TransactionBuilder, Networks, rpc, Account, xdr, scValToNative } from '@stellar/stellar-sdk';
import { signTransactionXDR } from './wallet-kit';

const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;

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
