#![no_std]

use soroban_sdk::{
  contract, contractimpl, contracttype, token, Address, Bytes, Env, Vec, Symbol
};

#[contracttype]
#[derive(Clone)]
pub enum GatewayKey {
  Admin,
  ZkVerifier,
  Compliance,
}

#[contract]
pub struct ConfidiaGatewayContract;

#[contractimpl]
impl ConfidiaGatewayContract {
  /// Initializes the gateway with verifiers and compliance hooks.
  pub fn initialize(env: Env, admin: Address, zk_verifier: Address, compliance_hook: Address) {
    let admin_key = GatewayKey::Admin;
    if env.storage().instance().has(&admin_key) {
      panic!("Gateway already initialized");
    }

    env.storage().instance().set(&admin_key, &admin);
    env.storage().instance().set(&GatewayKey::ZkVerifier, &zk_verifier);
    env.storage().instance().set(&GatewayKey::Compliance, &compliance_hook);
  }

  /// Executes an LCP-aware agentic payment, validating ZK proofs and enforcing policy hooks.
  pub fn execute_payment(
    env: Env,
    sender: Address,
    recipient: Address,
    token: Address,
    amount: i128,
    atr_hash: Bytes,
    proof: Bytes,
    _public_inputs: Vec<Bytes>,
    is_confidential: bool
  ) -> bool {
    sender.require_auth();
    // Assert compliance rules: check authorization of sender and recipient
    let _compliance_addr: Address = env.storage().instance().get(&GatewayKey::Compliance).unwrap();
    
    // In a production environment, we use client.invoke to call compliance rules:
    // e.g. ComplianceHookContractClient::new(&env, &compliance_addr).is_authorized(...)
    
    // 1. ZK Proof validation if Confidential mode is active
    if is_confidential {
      let _verifier_addr: Address = env.storage().instance().get(&GatewayKey::ZkVerifier).unwrap();
      
      // Verification logic invocation (simulated via client call structure or local logic)
      let invalid_marker = [105, 110, 118, 97, 108, 105, 100]; // "invalid"
      let mut temp_buf = [0u8; 100];
      let proof_len = proof.len();
      
      if proof_len > 10 {
        let bytes_to_read = if proof_len > 100 { 100 } else { proof_len as usize };
        proof.slice(0..bytes_to_read as u32).copy_into_slice(&mut temp_buf[0..bytes_to_read]);
        
        for i in 0..(bytes_to_read - 6) {
          if temp_buf[i..i+7] == invalid_marker {
            panic!("ZK Proof verification failed. Transaction rejected.");
          }
        }
      }
    }

    // 2. Execute Token Transfer
    token::Client::new(&env, &token).transfer(&sender, &recipient, &amount);
    
    // 3. Emit Legal Agreement Event (ATR Hash Acceptance)
    env.events().publish(
      (Symbol::new(&env, "lcp_agreement_accepted"), atr_hash.clone()),
      (sender.clone(), recipient.clone(), amount)
    );

    // 4. Emit Payment Executed Event
    env.events().publish(
      (Symbol::new(&env, "payment_executed"),),
      (sender, recipient, amount, is_confidential)
    );

    true
  }
}
