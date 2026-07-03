-- Confidia — Supabase Postgres schema
--
-- Replaces the file-backed MockSupabaseClient (packages/confidia-test-utils)
-- as the API's persistence layer. Table/column shapes mirror exactly what
-- apps/api/src/server.ts reads and writes today, so the swap from the mock
-- to a real @supabase/supabase-js client requires no query-shape changes.
--
-- Run with: node scripts/db/migrate.js

create extension if not exists pgcrypto;

create table if not exists tenants (
  id text primary key,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists domains (
  id text primary key default ('domain-' || substr(gen_random_uuid()::text, 1, 8)),
  tenant_id text,
  url text,
  lcp_json jsonb,
  atr_hash text,
  verified_at timestamptz,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists policies (
  id text primary key,
  tenant_id text,
  name text,
  rules jsonb,
  created_at timestamptz not null default now()
);

create table if not exists agents (
  id text primary key,
  tenant_id text,
  name text,
  capabilities jsonb,
  bound_domains jsonb,
  keys jsonb,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists distributions (
  id text primary key,
  tenant_id text,
  name text,
  asset_id text,
  funding_mode text,
  identity_mode text,
  root_hash text,
  status text,
  total_amount numeric,
  total_recipients integer,
  created_at timestamptz not null default now()
);

create table if not exists claims (
  id text primary key default ('claim-' || substr(gen_random_uuid()::text, 1, 8)),
  distribution_id text,
  nullifier text,
  claimed_amount numeric,
  recipient_address text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists jwk_keys (
  id text primary key default ('id-' || substr(gen_random_uuid()::text, 1, 8)),
  kid text unique,
  provider_id text,
  n text,
  e text,
  alg text,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id text primary key default ('tx-' || substr(gen_random_uuid()::text, 1, 8)),
  tenant_id text,
  type text,
  amount numeric,
  asset_id text,
  status text,
  proof_type text,
  on_chain_tx text,
  created_at timestamptz not null default now()
);

create table if not exists agreements (
  id text primary key default ('agr-' || substr(gen_random_uuid()::text, 1, 8)),
  tenant_id text,
  domain_id text,
  agent_id text,
  atr_hash text,
  signed_terms text,
  consent_timestamp text,
  signature text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key default ('audit-' || substr(gen_random_uuid()::text, 1, 8)),
  distribution_id text,
  event text,
  data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id text primary key,
  tenant_id text,
  code text,
  issuer text,
  type text,
  contract_address text,
  created_at timestamptz not null default now()
);

create table if not exists confidential_wrappers (
  id text primary key,
  asset_id text,
  contract_address text,
  auditor_key text,
  policy_config jsonb,
  created_at timestamptz not null default now()
);

-- Defense in depth: enable RLS with no policies. All app traffic goes through
-- the Fly-hosted API using the service_role key, which always bypasses RLS —
-- so this only matters if the anon/publishable key were ever used directly
-- against these tables, in which case it correctly denies all access.
alter table tenants enable row level security;
alter table domains enable row level security;
alter table policies enable row level security;
alter table agents enable row level security;
alter table distributions enable row level security;
alter table claims enable row level security;
alter table jwk_keys enable row level security;
alter table transactions enable row level security;
alter table agreements enable row level security;
alter table audit_logs enable row level security;
alter table assets enable row level security;
alter table confidential_wrappers enable row level security;

-- Seed defaults (matching MockSupabaseClient.initializeDefaultDb), idempotent.
insert into tenants (id, name) values
  ('tenant-1', 'Confidia Institutional Dev')
on conflict (id) do nothing;

-- No seeded domain rows: "domains" only ever contains entries that genuinely
-- passed real LCP verification through /domains/register (real HTTPS fetch +
-- real SHA-256 hash check). A prior seed here ('treasury.example.mx', marked
-- 'verified') never resolved on the real internet and could never actually
-- pass that check — exactly the kind of fake-presented-as-real data this
-- project's real Legal Context flow is supposed to catch. Register a real
-- domain (e.g. confidia.vercel.app, which genuinely publishes LCP files)
-- through the app instead.

insert into policies (id, tenant_id, name, rules) values
  ('policy-1', 'tenant-1', 'Treasury Limits',
   '{"maxStandardAmount":5000,"requireConfidential":true,"requiredProofs":["zkBalance","zkEligibility"],"allowedJurisdictions":["MX","US","DE"]}'::jsonb)
on conflict (id) do nothing;

insert into agents (id, tenant_id, name, capabilities, bound_domains, keys, status) values
  ('agent-1', 'tenant-1', 'Treasury Operator',
   '["standard","confidential","zkKYC"]'::jsonb,
   '["confidia.vercel.app"]'::jsonb,
   '{"publicKey":"GDS5FCW6N7AW4BRJQS22AYUKYSAMNSHMUUTW6ZKRTYMWMIIJUSN7XAHR"}'::jsonb,
   'active'),
  ('agent-2', 'tenant-1', 'Distribution Agent',
   '["standard","confidential"]'::jsonb,
   '["confidia.vercel.app"]'::jsonb,
   '{"publicKey":"GCP5X7E7PXM3N5S5YF6K6R2G3F4H7J8K9L0M1N2PAYROLLKEY"}'::jsonb,
   'active')
on conflict (id) do nothing;

insert into assets (id, tenant_id, code, issuer, type, contract_address) values
  ('asset-usdc', 'tenant-1', 'USDC', 'CDLZCBXGUA72NV2HG646N7423NZ6VXZF6VZ3D27K33K3EUP57WPAUSDC', 'standard', 'CDLZCBXGUA72NV2HG646N7423NZ6VXZF6VZ3D27K33K3EUP57WPAUSDC')
on conflict (id) do nothing;
