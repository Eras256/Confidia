#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short};

#[contracttype]
#[derive(Clone)]
pub enum ComplianceKey {
  Frozen(Address),
  Registry(Address),
  Admin,
}

#[contract]
pub struct ComplianceHookContract;

#[contractimpl]
impl ComplianceHookContract {
  /// Initializes the compliance admin key.
  pub fn initialize(env: Env, admin: Address) {
    let key = ComplianceKey::Admin;
    if env.storage().instance().has(&key) {
      panic!("Compliance already initialized");
    }
    env.storage().instance().set(&key, &admin);
  }

  /// Checks if an address is authorized to transact (allowlist validation).
  pub fn is_authorized(env: Env, account: Address) -> bool {
    let frozen_key = ComplianceKey::Frozen(account.clone());
    let is_frozen: bool = env.storage().instance().get(&frozen_key).unwrap_or(false);
    
    // Account is authorized if NOT frozen
    !is_frozen
  }

  /// Sets the frozen status of an account. Admin only.
  pub fn set_frozen(env: Env, admin: Address, account: Address, freeze: bool) {
    admin.require_auth();
    let admin_key = ComplianceKey::Admin;
    let registered_admin: Address = env.storage().instance().get(&admin_key).unwrap();
    if admin != registered_admin {
      panic!("Unauthorized compliance administrator");
    }

    let frozen_key = ComplianceKey::Frozen(account.clone());
    env.storage().instance().set(&frozen_key, &freeze);

    env.events().publish(
      (symbol_short!("frozen"), account),
      freeze
    );
  }

  /// Configures an identity registry rule (e.g. KYC accredited status mapping).
  pub fn set_registry_rule(env: Env, admin: Address, rule_entity: Address, accredited_required: bool) {
    admin.require_auth();
    let admin_key = ComplianceKey::Admin;
    let registered_admin: Address = env.storage().instance().get(&admin_key).unwrap();
    if admin != registered_admin {
      panic!("Unauthorized compliance administrator");
    }

    let registry_key = ComplianceKey::Registry(rule_entity.clone());
    env.storage().instance().set(&registry_key, &accredited_required);

    env.events().publish(
      (Symbol::new(&env, "rule_set"), rule_entity),
      accredited_required
    );
  }

  /// Verifies if the target identity holds standard accreditation status.
  pub fn check_accreditation(env: Env, account: Address) -> bool {
    let registry_key = ComplianceKey::Registry(account);
    env.storage().instance().get(&registry_key).unwrap_or(false)
  }
}
