#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Env, String, symbol_short};

#[contracttype]
#[derive(Clone)]
pub struct JwkKey {
    pub n: String,
    pub e: String,
    pub alg: String,
    pub revoked: bool,
}

#[contract]
pub struct JwksRegistryContract;

#[contractimpl]
impl JwksRegistryContract {
    pub fn add_key(env: Env, kid: String, n: String, e: String, alg: String) {
        let key = JwkKey {
            n,
            e,
            alg,
            revoked: false,
        };
        env.storage().persistent().set(&kid, &key);
        
        env.events().publish(
            (symbol_short!("jwk_add"), kid.clone()),
            kid
        );
    }

    pub fn revoke_key(env: Env, kid: String) {
        if let Some(mut key) = env.storage().persistent().get::<String, JwkKey>(&kid) {
            key.revoked = true;
            env.storage().persistent().set(&kid, &key);
            
            env.events().publish(
                (symbol_short!("jwk_rev"), kid.clone()),
                kid
            );
        }
    }

    pub fn is_key_trusted(env: Env, kid: String) -> bool {
        if let Some(key) = env.storage().persistent().get::<String, JwkKey>(&kid) {
            !key.revoked
        } else {
            false
        }
    }
}
