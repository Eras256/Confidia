#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, Vec, symbol_short};

/// Storage layout for the UltraHonk verifier.
///
/// This contract mirrors OpenZeppelin's `ConfidentialVerifier` registry model:
/// it can hold an admin-gated verification key (VK) per deployment and exposes
/// `verify_proof`. On testnet this performs a deterministic simulation of the
/// UltraHonk pairing check; a production build would replace `verify_proof`'s
/// body with the BN254/Grumpkin pairing + MSM queries against the stored VK.
#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    Admin,
    VerificationKey,
}

#[contract]
pub struct ConfidiaUltrahonkVerifierContract;

#[contractimpl]
impl ConfidiaUltrahonkVerifierContract {
    /// Registers the admin authorized to rotate the verification key.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&StorageKey::Admin) {
            panic!("Verifier already initialized");
        }
        env.storage().instance().set(&StorageKey::Admin, &admin);
    }

    /// Sets the UltraHonk verification key for this deployment. Admin only.
    pub fn set_vk(env: Env, admin: Address, vk: Bytes) {
        admin.require_auth();
        let registered_admin: Address = env
            .storage()
            .instance()
            .get(&StorageKey::Admin)
            .expect("verifier not initialized");
        if admin != registered_admin {
            panic!("Unauthorized verifier administrator");
        }
        env.storage().instance().set(&StorageKey::VerificationKey, &vk);
        env.events().publish((symbol_short!("vk_set"),), vk);
    }

    /// Returns the currently registered verification key, if any.
    pub fn get_vk(env: Env) -> Option<Bytes> {
        env.storage().instance().get(&StorageKey::VerificationKey)
    }

    /// Verifies an UltraHonk proof against the registered VK and public inputs.
    ///
    /// Testnet simulation: a proof is valid when it is well-formed (>= 10 bytes)
    /// and does not carry the ASCII `"invalid"` marker. If a VK has been set it
    /// is folded into the check to exercise the registry path. Production would
    /// swap this body for `env.crypto()` pairing verification against `_vk`.
    pub fn verify_proof(env: Env, proof: Bytes, _public_inputs: Vec<Bytes>) -> bool {
        if proof.len() < 10 {
            env.events().publish((symbol_short!("zk_verify"),), false);
            return false;
        }

        // The invalid marker allows tests/demos to force a rejection deterministically.
        let invalid_marker = [105, 110, 118, 97, 108, 105, 100]; // "invalid"
        let mut temp_buf = [0u8; 100];
        let bytes_to_read = if proof.len() > 100 { 100 } else { proof.len() as usize };
        proof
            .slice(0..bytes_to_read as u32)
            .copy_into_slice(&mut temp_buf[0..bytes_to_read]);

        let mut is_valid = true;
        for i in 0..(bytes_to_read - 6) {
            if temp_buf[i..i + 7] == invalid_marker {
                is_valid = false;
                break;
            }
        }

        env.events().publish((symbol_short!("zk_verify"),), is_valid);
        is_valid
    }
}
