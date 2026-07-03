# Confidia — Legal Context Protocol Terms

1. Confidia is institutional infrastructure for zero-knowledge distribution of
   tokenized USD (USDC/EURC) on the Stellar network.
2. Settlements executed under this Legal Context are governed by the laws of
   the counterparty's declared jurisdiction and resolved via UNCITRAL
   arbitration rules unless a signed agreement states otherwise.
3. Recipients must independently verify eligibility via a zero-knowledge proof
   before a claim is honored; no personally identifying information is
   published to the public ledger.
4. Auditors holding a registered view key may inspect confidential balances
   for compliance purposes; this does not grant transfer authority.
5. This document's SHA-256 hash is published at
   `/.well-known/legal-context.json` as `atrHash`, and is independently
   verified by Confidia's API before a domain is accepted as a counterparty.
