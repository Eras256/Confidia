#![no_std]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, token, Address, Bytes, Env, String, Vec,
    symbol_short,
};

/// External interface for the JWK registry contract.
///
/// Declared locally with `#[contractclient]` (rather than importing the
/// `jwk-registry` crate) so the registry's `#[contractimpl]` entrypoints are
/// NOT linked into — and re-exported from — this vault's WASM. Linking the
/// sibling contract crate leaks its exported functions (e.g. a second
/// `initialize`) into this module and collides with the vault's own, which is
/// exactly the duplicate-symbol problem the workspace split set out to avoid.
#[contractclient(name = "JwkRegistryClient")]
pub trait JwkRegistryInterface {
    fn is_key_trusted(env: Env, kid: String) -> bool;
}

/// External interface for the UltraHonk verifier contract.
#[contractclient(name = "UltrahonkVerifierClient")]
pub trait UltrahonkVerifierInterface {
    fn verify_proof(env: Env, proof: Bytes, public_inputs: Vec<Bytes>) -> bool;
}

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    MerkleRoot,
    FundingAsset,
    JwkRegistry,
    Verifier,
    Nullifier(Bytes),
}

#[contract]
pub struct VestingClaimVaultContract;

#[contractimpl]
impl VestingClaimVaultContract {
    pub fn initialize(
        env: Env,
        root: Bytes,
        token: Address,
        verifier: Address,
        jwk_registry: Address,
    ) {
        env.storage().instance().set(&StorageKey::MerkleRoot, &root);
        env.storage().instance().set(&StorageKey::FundingAsset, &token);
        env.storage().instance().set(&StorageKey::Verifier, &verifier);
        env.storage().instance().set(&StorageKey::JwkRegistry, &jwk_registry);
    }

    pub fn claim(
        env: Env,
        proof: Bytes,
        public_inputs: Vec<Bytes>,
        recipient: Address,
        nullifier: Bytes,
        kid: String,
        amount: i128,
    ) -> bool {
        let null_key = StorageKey::Nullifier(nullifier.clone());
        if env.storage().persistent().has(&null_key) {
            panic!("Double claim detected! Nullifier already spent.");
        }

        let jwk_registry_addr: Address = env.storage().instance().get(&StorageKey::JwkRegistry).unwrap();
        let jwk_client = JwkRegistryClient::new(&env, &jwk_registry_addr);
        let is_trusted = jwk_client.is_key_trusted(&kid);

        if !is_trusted {
            panic!("Claims verification failed: Key ID not trusted in registry.");
        }

        let verifier_addr: Address = env.storage().instance().get(&StorageKey::Verifier).unwrap();
        let verifier_client = UltrahonkVerifierClient::new(&env, &verifier_addr);
        let valid_proof = verifier_client.verify_proof(&proof, &public_inputs);

        if !valid_proof {
            panic!("ZK Proof Verification Failed.");
        }

        // Execute actual token transfer from vault to recipient
        let token_addr: Address = env.storage().instance().get(&StorageKey::FundingAsset).unwrap();
        token::Client::new(&env, &token_addr).transfer(&env.current_contract_address(), &recipient, &amount);

        env.storage().persistent().set(&null_key, &true);

        env.events().publish(
            (symbol_short!("claimed"), recipient.clone()),
            nullifier
        );

        true
    }
}
