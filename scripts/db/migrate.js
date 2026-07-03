#!/usr/bin/env node
// Confidia — run the Supabase Postgres schema migration (scripts/db/schema.sql).
//
// Usage:
//   SUPABASE_DB_URL="postgresql://postgres:***@host:5432/postgres" node scripts/db/migrate.js
//
// The connection string is read only from the environment — never hardcode
// it here or commit it anywhere in the repo.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error("✖ SUPABASE_DB_URL is not set.");
  process.exit(1);
}

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("✅ Schema migration applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("✖ Migration failed:", err.message);
  process.exit(1);
});
