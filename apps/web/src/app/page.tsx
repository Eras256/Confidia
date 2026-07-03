"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LcpStatusCard,
  ZkProofVisualizer,
  TransactionTable,
  TransactionItem
} from "confidia-ui";
import {
  Shield,
  Scale,
  Bot,
  Coins,
  Lock,
  FileText,
  AlertTriangle,
  Settings as SettingsIcon,
  RefreshCw,
  Plus,
  ArrowRight,
  TrendingUp,
  Fingerprint,
  Layers,
  UserCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Code,
  Terminal,
  Activity,
  Send,
  Gift,
  ShieldCheck,
  Menu,
  X
} from "lucide-react";
import { Language, translations } from "./translations";
import { connectWallet } from "../lib/wallet-kit";
import { authenticateWithWallet } from "../lib/auth";
import { readContract, writeContract, sendPayment, fetchAccountBalances, type WalletBalance } from "../lib/soroban-tx";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Build-time fallback for the on-chain contract registry. Next.js inlines
// NEXT_PUBLIC_* at build time, so the deployed addresses render even when the
// API is unreachable; the live /confidia/contracts fetch refreshes this.
const ENV_CONTRACTS = {
  jwkRegistry: process.env.NEXT_PUBLIC_JWK_REGISTRY_CONTRACT_ID || null,
  ultrahonkVerifier: process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID || null,
  compliance: process.env.NEXT_PUBLIC_COMPLIANCE_CONTRACT_ID || null,
  vestingClaim: process.env.NEXT_PUBLIC_VESTING_CLAIM_CONTRACT_ID || null,
  gateway: process.env.NEXT_PUBLIC_GATEWAY_CONTRACT_ID || null,
};
const ENV_REGISTRY = Object.values(ENV_CONTRACTS).some(Boolean)
  ? {
      network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
      deployer: process.env.NEXT_PUBLIC_STELLAR_WALLET_PUBLIC || null,
      rpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
      contracts: ENV_CONTRACTS,
      deployed: true,
      explorerBase: "https://stellar.expert/explorer/testnet/contract",
    }
  : null;

export default function Dashboard() {
  const [lang, setLang] = useState<Language>("en");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Private Distributions States
  const [distName, setDistName] = useState<string>("Confidia Q3 Contributor Grants");
  const [distRecipientsRaw, setDistRecipientsRaw] = useState<string>(
    "contributor1@example.com, 5000\ncontributor2@example.com, 7500\ncontributor3@example.com, 10000"
  );
  const [distRoot, setDistRoot] = useState<string>("");
  const [distTotalAllocation, setDistTotalAllocation] = useState<number>(0);
  const [distTotalRecipients, setDistTotalRecipients] = useState<number>(0);
  const [distDeploying, setDistDeploying] = useState<boolean>(false);
  const [distDeployedAddress, setDistDeployedAddress] = useState<string>("");
  const [claimChartData, setClaimChartData] = useState({ claimed: 0, pending: 22500 });

  // Recipient Claim States
  const [claimEmail, setClaimEmail] = useState<string>("contributor2@example.com");
  const [claimPin, setClaimPin] = useState<string>("90210");
  const [claimWallet, setClaimWallet] = useState<string>("GCB5X7E7PXM3N5S5YF6K6R2G3F4H7J8K9L0M1N2P");
  const [claimProving, setClaimProving] = useState<boolean>(false);
  const [claimLogs, setClaimLogs] = useState<string[]>([]);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string>("");

  // Freighter Wallet Mock State
  const [freighterConnected, setFreighterConnected] = useState<boolean>(false);
  const [freighterAddress, setFreighterAddress] = useState<string>("");
  const [freighterNetwork, setFreighterNetwork] = useState<"testnet" | "public">("testnet");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [jwtToken, setJwtToken] = useState<string>("");
  const [demoFailureScenario, setDemoFailureScenario] = useState<"happy" | "stale_jwk" | "wrong_wallet" | "paused" | "claimed">("happy");
  const [techDrawerOpen, setTechDrawerOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false); // mobile nav drawer
  const [claimCountdown, setClaimCountdown] = useState<number>(300); // 5 minutes countdown
  const [contractRegistry, setContractRegistry] = useState<any>(ENV_REGISTRY);
  // On-chain "register OIDC key" flow (Identity Ops) — real, Freighter-signed
  const [newKeyKid, setNewKeyKid] = useState<string>("google-oauth-2026");
  const [keyRegistering, setKeyRegistering] = useState<boolean>(false);
  const [keyTx, setKeyTx] = useState<{ hash: string; url: string } | null>(null);
  const [keyTxError, setKeyTxError] = useState<string>("");
  const [signedVerifying, setSignedVerifying] = useState<boolean>(false);
  const [signedVerifyTx, setSignedVerifyTx] = useState<{ hash: string; url: string } | null>(null);
  // Real wallet balances (read from Horizon — no hardcoded asset/issuer addresses)
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState<boolean>(false);
  const [selectedDepositIdx, setSelectedDepositIdx] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<string>("10");
  const [depositing, setDepositing] = useState<boolean>(false);
  const [depositTx, setDepositTx] = useState<{ hash: string; url: string } | null>(null);
  const [depositError, setDepositError] = useState<string>("");
  const [liveVerifying, setLiveVerifying] = useState<boolean>(false);
  const [liveResults, setLiveResults] = useState<Array<{ method: string; contract: string; result: string; ok: boolean; latencyMs: number }>>([]);
  const [liveError, setLiveError] = useState<string>("");

  // Countdown effect
  useEffect(() => {
    if (claimCountdown <= 0) return;
    const interval = setInterval(() => {
      setClaimCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [claimCountdown]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  useEffect(() => {
    const loadBackendData = async () => {
      try {
        const domainsRes = await fetch(`${API_BASE}/domains`).then(r => r.json());
        if (Array.isArray(domainsRes)) {
          setDomains(domainsRes);
        }

        const policiesRes = await fetch(`${API_BASE}/policies`).then(r => r.json());
        if (Array.isArray(policiesRes)) {
          setPolicies(policiesRes);
        }

        const agreementsRes = await fetch(`${API_BASE}/agreements`).then(r => r.json());
        if (Array.isArray(agreementsRes)) {
          setAgreements(agreementsRes);
        }

        const transactionsRes = await fetch(`${API_BASE}/transactions`).then(r => r.json());
        if (Array.isArray(transactionsRes)) {
          setTransactions(transactionsRes);
        }

        const contractsRes = await fetch(`${API_BASE}/confidia/contracts`).then(r => r.json());
        if (contractsRes && contractsRes.contracts) {
          setContractRegistry(contractsRes);
        }
      } catch (err) {
        console.error("Failed to load initial data from Confidia API", err);
      }
    };
    loadBackendData();
  }, [activeTab]);

  // Reads the connected wallet's REAL Horizon balances (no hardcoded asset
  // addresses) so the Confidential Treasury deposit form always reflects
  // whatever the user actually holds (native XLM, real testnet USDC/EURC, etc.)
  const refreshWalletBalances = async (address: string) => {
    setBalancesLoading(true);
    try {
      const balances = await fetchAccountBalances(address);
      setWalletBalances(balances);
      setSelectedDepositIdx(0);
    } catch (err) {
      console.error("Failed to fetch wallet balances", err);
      setWalletBalances([]);
    } finally {
      setBalancesLoading(false);
    }
  };

  useEffect(() => {
    if (freighterConnected && freighterAddress) {
      refreshWalletBalances(freighterAddress);
    } else {
      setWalletBalances([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freighterConnected, freighterAddress]);

  const handleConnectFreighter = async () => {
    try {
      if (freighterConnected) {
        setFreighterConnected(false);
        setFreighterAddress("");
        setIsAuthenticated(false);
        setJwtToken("");
      } else {
        setStatusMessage(lang === "es" ? "Abriendo selector de billetera..." : "Opening wallet selector modal...");
        const result = await connectWallet();
        setFreighterConnected(true);

        if (demoFailureScenario === "wrong_wallet") {
          setFreighterAddress("GCSB5XWRONGWALLET498234902348902348902348");
        } else {
          setFreighterAddress(result.address);
        }

        // Trigger SEP-10 Authentication challenge
        setStatusMessage(lang === "es" ? "Iniciando desafío WebAuth SEP-10..." : "Initiating SEP-10 WebAuth challenge...");
        const token = await authenticateWithWallet(result.address);
        setJwtToken(token);
        setIsAuthenticated(true);
        setStatusMessage(lang === "es" ? "¡Autenticación SEP-10 exitosa!" : "SEP-10 authentication successful!");
        setTimeout(() => setStatusMessage(""), 2000);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage(lang === "es" ? `Error de billetera: ${err.message || err}` : `Wallet error: ${err.message || err}`);
      setTimeout(() => setStatusMessage(""), 3500);
    }
  };

  const handleSwitchFreighterNetwork = () => {
    setFreighterNetwork(prev => prev === "testnet" ? "public" : "testnet");
  };

  // Invokes the deployed contracts live on Stellar Testnet via the Soroban RPC.
  // Uses read-only simulation, so it always executes the real on-chain WASM
  // without needing wallet funds or a signature.
  const handleLiveVerify = async () => {
    const verifierId = contractRegistry?.contracts?.ultrahonkVerifier;
    const complianceId = contractRegistry?.contracts?.compliance;
    const account = contractRegistry?.deployer || freighterAddress || "GDS5FCW6N7AW4BRJQS22AYUKYSAMNSHMUUTW6ZKRTYMWMIIJUSN7XAHR";
    if (!verifierId || !complianceId) {
      setLiveError(lang === "es" ? "Direcciones de contrato no disponibles." : "Contract addresses unavailable.");
      return;
    }
    setLiveVerifying(true);
    setLiveError("");
    setLiveResults([]);
    try {
      // 1. verify_proof(wellFormedProof, []) on the deployed UltraHonk verifier → true
      const proofBytes = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]);
      const proofScVal = nativeToScVal(proofBytes, { type: "bytes" });
      const emptyVec = xdr.ScVal.scvVec([]);
      const vp = await readContract(verifierId, "verify_proof", [proofScVal, emptyVec]);

      // 2. is_authorized(account) on the deployed compliance hook → true
      const addrScVal = nativeToScVal(account, { type: "address" });
      const ia = await readContract(complianceId, "is_authorized", [addrScVal]);

      setLiveResults([
        { method: "verify_proof", contract: verifierId, result: String(vp.result), ok: vp.result === true, latencyMs: vp.latencyMs },
        { method: "is_authorized", contract: complianceId, result: String(ia.result), ok: ia.result === true, latencyMs: ia.latencyMs },
      ]);
    } catch (err: any) {
      setLiveError(err?.message || String(err));
    } finally {
      setLiveVerifying(false);
    }
  };

  // Real, Freighter-signed on-chain action: register an OIDC signing key in the
  // JWK registry contract. Produces a verifiable transaction hash on stellar.expert.
  const handleRegisterKeyOnChain = async () => {
    const jwkId = contractRegistry?.contracts?.jwkRegistry;
    if (!freighterConnected || !freighterAddress) {
      setKeyTxError(lang === "es" ? "Conecta Freighter primero." : "Connect Freighter first.");
      return;
    }
    if (!jwkId) {
      setKeyTxError(lang === "es" ? "Registro JWK no disponible." : "JWK registry unavailable.");
      return;
    }
    const kid = (newKeyKid || "").trim();
    if (!kid) {
      setKeyTxError(lang === "es" ? "Ingresa un Key ID." : "Enter a Key ID.");
      return;
    }
    setKeyRegistering(true);
    setKeyTxError("");
    setKeyTx(null);
    try {
      // add_key(kid, n, e, alg) — all Strings. n/e are demo RSA params (public data).
      const args = [
        nativeToScVal(kid, { type: "string" }),
        nativeToScVal("modulus-" + kid, { type: "string" }),
        nativeToScVal("AQAB", { type: "string" }),
        nativeToScVal("RS256", { type: "string" }),
      ];
      const res = await writeContract(jwkId, "add_key", args, freighterAddress);
      setKeyTx({ hash: res.hash, url: res.explorerUrl });
      // reflect it in the table immediately
      setJwtKeys((prev) => [
        { kid, provider: "On-chain (Freighter)", alg: "RS256", n: "modulus-" + kid, e: "AQAB", status: "active" },
        ...prev.filter((k) => k.kid !== kid),
      ]);
    } catch (err: any) {
      setKeyTxError(err?.message || String(err));
      if (err?.explorerUrl) setKeyTx({ hash: err.hash, url: err.explorerUrl });
    } finally {
      setKeyRegistering(false);
    }
  };

  // Real, Freighter-signed verify_proof: submits an actual on-chain transaction
  // that runs the verifier contract, producing a persisted, verifiable tx hash
  // (vs. the read-only "Run Live Check" which only simulates).
  const handleSignedVerify = async () => {
    const verifierId = contractRegistry?.contracts?.ultrahonkVerifier;
    if (!freighterConnected || !freighterAddress) {
      setLiveError(lang === "es" ? "Conecta Freighter para firmar." : "Connect Freighter to sign.");
      return;
    }
    if (!verifierId) return;
    setSignedVerifying(true);
    setLiveError("");
    setSignedVerifyTx(null);
    try {
      const proofBytes = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]);
      const proofScVal = nativeToScVal(proofBytes, { type: "bytes" });
      const emptyVec = xdr.ScVal.scvVec([]);
      const res = await writeContract(verifierId, "verify_proof", [proofScVal, emptyVec], freighterAddress);
      setSignedVerifyTx({ hash: res.hash, url: res.explorerUrl });
    } catch (err: any) {
      setLiveError(err?.message || String(err));
      if (err?.explorerUrl) setSignedVerifyTx({ hash: err.hash, url: err.explorerUrl });
    } finally {
      setSignedVerifying(false);
    }
  };

  // JWT Ops States
  const [distId, setDistId] = useState<string>("");
  const [jwtKeys, setJwtKeys] = useState<any[]>([
    { kid: "mock-google-key-id", provider: "Google Accounts", alg: "RS256", status: "active", n: "mock-n-modulus-parameter...", e: "AQAB" },
    { kid: "mock-github-key-id", provider: "GitHub Service OIDC", alg: "RS256", status: "active", n: "mock-github-modulus...", e: "AQAB" }
  ]);
  const [jwtSyncing, setJwtSyncing] = useState<boolean>(false);

  // Distribution Admin Handlers
  const handlePrepareDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = distRecipientsRaw.split("\n").filter(l => l.trim().length > 0);
    const recipients = lines.map((l, i) => {
      const parts = l.split(",");
      return {
        email: parts[0]?.trim() || `contributor${i + 1}@example.com`,
        amount: parts[1] ? parseFloat(parts[1].trim()) : 5000,
        pin: "90210" // Default secure Pin
      };
    });

    setLoading(true);
    setStatusMessage("Calculating Merkle root package on server...");
    try {
      const res = await fetch(`${API_BASE}/confidia/distributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: distName,
          recipients,
          assetId: "USDC",
          fundingMode: "standard",
          identityMode: "email"
        })
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setDistId(data.distribution.id);
      setDistTotalAllocation(data.merkle.totalAllocation);
      setDistTotalRecipients(data.merkle.recipientCount);
      setDistRoot(data.merkle.root);
      setStatusMessage("Distribution package prepared successfully.");
      setTimeout(() => setStatusMessage(""), 2000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Error: ${err.message || err}`);
      setTimeout(() => setStatusMessage(""), 3500);
    } finally {
      setLoading(false);
    }
  };

  const handleDeployDistribution = async () => {
    if (!distId) return;
    setDistDeploying(true);
    setStatusMessage("Deploying distribution smart contract on Stellar testnet...");
    try {
      const res = await fetch(`${API_BASE}/confidia/distributions/${distId}/activate`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      // Generate a mock address derived from distribution ID to show in UI
      const mockAddr = "CDIST" + distId.substring(0, 24).toUpperCase();
      setDistDeployedAddress(mockAddr);
      setClaimChartData({ claimed: 0, pending: distTotalAllocation });
      setStatusMessage("Distribution contract activated!");
      setTimeout(() => setStatusMessage(""), 2000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Deployment error: ${err.message || err}`);
      setTimeout(() => setStatusMessage(""), 3500);
    } finally {
      setDistDeploying(false);
    }
  };

  // Recipient Payout Claim Handler
  const handleExecuteClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (claimProving) return;
    setClaimProving(true);
    setClaimLogs([]);
    setClaimSuccessMsg("");

    const claimSteps = [
      { text: `[MERKLE] ${t("claim_log_merkle")}`, delay: 0 },
      { text: `[OIDC] ${t("claim_log_jwt")}`, delay: 800 },
      { text: `[PROVER] ${t("claim_log_zk")}`, delay: 1850 },
    ];

    claimSteps.forEach((step) => {
      setTimeout(() => {
        setClaimLogs((prev) => [...prev, step.text]);
      }, step.delay);
    });

    setTimeout(async () => {
      if (demoFailureScenario === "stale_jwk") {
        setClaimLogs((prev) => [...prev, `[ERROR] ${t("alert_sync_blocked")}`]);
        setClaimProving(false);
        return;
      } else if (demoFailureScenario === "paused") {
        setClaimLogs((prev) => [...prev, `[ERROR] ${t("alert_paused_blocked")}`]);
        setClaimProving(false);
        return;
      } else if (demoFailureScenario === "claimed") {
        setClaimLogs((prev) => [...prev, `[ERROR] ${t("alert_already_spent")}`]);
        setClaimProving(false);
        return;
      } else if (demoFailureScenario === "wrong_wallet" || (freighterConnected && freighterAddress !== "GCB5X7E7PXM3N5S5YF6K6R2G3F4H7J8K9L0M1N2P")) {
        setClaimLogs((prev) => [...prev, `[PROVER] ZK proof generated for GCB5X7...`]);
        setClaimLogs((prev) => [...prev, `[ERROR] ${t("wallet_mismatch_warning")} GCB5X7E7PXM3N5S5YF6K6R2G3F4H7J8K9L0M1N2P vs active Freighter address ${freighterAddress || "Not Connected"}`]);
        setClaimProving(false);
        return;
      }

      setClaimLogs((prev) => [...prev, `[SOROBAN] ${t("claim_log_submit")}`]);

      try {
        const amount = claimEmail === "contributor1@example.com" ? 5000 : claimEmail === "contributor3@example.com" ? 10000 : 7500;
        const nullifier = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

        const res = await fetch(`${API_BASE}/confidia/claims/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proof: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
            publicInputs: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
            recipient: claimWallet,
            nullifier,
            kid: "mock-google-key-id",
            distributionId: distId || "default-dist",
            recipientDetail: {
              email: claimEmail,
              amount,
              pin: claimPin
            }
          })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setClaimSuccessMsg(t("claim_success"));
        setClaimChartData(prev => ({
          claimed: prev.claimed + amount,
          pending: Math.max(0, prev.pending - amount)
        }));
      } catch (err: any) {
        console.error(err);
        setClaimLogs((prev) => [...prev, `[ERROR] claim failed: ${err.message || err}`]);
      } finally {
        setClaimProving(false);
      }
    }, 3000);
  };

  // OIDC Key Synchronization Handlers
  const handleSyncJwtKeys = async () => {
    setJwtSyncing(true);
    try {
      const syncRes = await fetch(`${API_BASE}/confidia/identity/providers/google/sync`, {
        method: "POST"
      }).then(r => r.json());
      if (syncRes.error) {
        throw new Error(syncRes.error);
      }

      const keysRes = await fetch(`${API_BASE}/confidia/identity/keys`).then(r => r.json());
      if (Array.isArray(keysRes)) {
        setJwtKeys(keysRes.map((k: any) => ({
          kid: k.kid,
          provider: k.provider_id === "google" ? "Google Accounts" : "GitHub Service OIDC",
          alg: k.alg || "RS256",
          status: k.revoked ? "revoked" : "active",
          n: k.n,
          e: k.e
        })));
      }
      setStatusMessage(t("jwt_sync_success"));
      setTimeout(() => setStatusMessage(""), 2000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Sync error: ${err.message || err}`);
      setTimeout(() => setStatusMessage(""), 3500);
    } finally {
      setJwtSyncing(false);
    }
  };

  const handleRevokeJwtKey = async (kid: string) => {
    try {
      const res = await fetch(`${API_BASE}/confidia/identity/keys/${kid}/revoke`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJwtKeys(prev => prev.map(k => k.kid === kid ? { ...k, status: "revoked" } : k));
    } catch (err) {
      console.error("Failed to revoke key", err);
    }
  };

  // ZK Prover live console state
  const [consoleLogs, setConsoleLogs] = useState<{ text: string; type: "info" | "success" | "warn" | "accent" }[]>([]);
  const [isConsoleActive, setIsConsoleActive] = useState<boolean>(false);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Helper function for localization
  const t = (key: keyof typeof translations.en) => {
    return translations[lang][key] || translations.en[key];
  };

  // Domain Management State
  const [domains, setDomains] = useState<any[]>([
    {
      id: "domain-1",
      url: "treasury.example.mx",
      lcp_json: {
        terms: "https://treasury.example.mx/terms.md",
        atrHash: "a47d2f93d8b5c90d8108c148a1d65d648fc92c0192e46b08e24dc1a64bc1ae82",
        acceptanceRequired: true,
        jurisdiction: "MX",
        disputeResolution: "UNCITRAL",
        consentModel: "opt-in"
      },
      status: "verified"
    },
    {
      id: "domain-2",
      url: "issuer.example.com",
      lcp_json: {
        terms: "https://issuer.example.com/legal.md",
        atrHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        acceptanceRequired: false,
        jurisdiction: "US-DE",
        disputeResolution: "AAA",
        consentModel: "opt-in"
      },
      status: "verified"
    }
  ]);
  const [newDomainUrl, setNewDomainUrl] = useState<string>("");

  // Agent State
  const [agents, setAgents] = useState<any[]>([
    {
      id: "agent-1",
      name: "Arbitrage Agent Alpha",
      capabilities: ["standard", "confidential", "zkKYC"],
      bound_domains: ["treasury.example.mx"],
      status: "active",
      pubKey: "GDX...AGENTKEYS"
    },
    {
      id: "agent-2",
      name: "Payroll Agent Beta",
      capabilities: ["standard", "confidential"],
      bound_domains: ["issuer.example.com"],
      status: "active",
      pubKey: "GCP...PAYROLLKEYS"
    }
  ]);

  // Policies State
  const [policies, setPolicies] = useState<any[]>([
    {
      id: "policy-1",
      name: "Standard Institutional Rules",
      rules: {
        maxStandardAmount: 5000,
        requireConfidential: true,
        requiredProofs: ["zkBalance", "zkEligibility"],
        allowedJurisdictions: ["MX", "US", "DE"]
      }
    }
  ]);

  // Transaction state
  const [transactions, setTransactions] = useState<TransactionItem[]>([
    {
      id: "tx-72049",
      domain: "treasury.example.mx",
      amount: 15000,
      tokenType: "confidential",
      status: "Completed",
      atrHash: "a47d2f93d8b5c90d8108c148a1d65d648fc92c0192e46b08e24dc1a64bc1ae82",
      created_at: new Date().toISOString()
    },
    {
      id: "tx-12048",
      domain: "issuer.example.com",
      amount: 3200,
      tokenType: "standard",
      status: "Completed",
      atrHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    }
  ]);

  // Agreements State
  const [agreements, setAgreements] = useState<any[]>([
    {
      id: "agr-89024",
      domain: "treasury.example.mx",
      agentId: "agent-1",
      atrHash: "a47d2f93d8b5c90d8108c148a1d65d648fc92c0192e46b08e24dc1a64bc1ae82",
      consentTimestamp: new Date().toISOString(),
      signature: "0xa841b9d7...sigbytes",
      status: "signed"
    }
  ]);

  // Form State for Execution simulation
  const [execAgentId, setExecAgentId] = useState<string>("agent-1");
  const [execDomain, setExecDomain] = useState<string>("treasury.example.mx");
  const [execAmount, setExecAmount] = useState<number>(10);
  const [execAsset, setExecAsset] = useState<string>("XLM");
  const [lastPaymentTx, setLastPaymentTx] = useState<{ hash: string; url: string } | null>(null);

  // Wrapper balances (view key decryption demo)
  const [viewKeyInput, setViewKeyInput] = useState<string>("GAUDITORVIEWKEY549023849023482348902348");
  const [commitmentInput, setCommitmentInput] = useState<string>("e2c8491038b50df36e04d4128");
  const [decryptedBalance, setDecryptedBalance] = useState<number | null>(null);

  // Scroll to bottom of terminal whenever logs update
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs]);

  // Interactive UI triggers
  const handleRegisterDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainUrl) return;
    setLoading(true);
    setStatusMessage(t("discover_lcp"));

    try {
      const res = await fetch(`${API_BASE}/domains/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newDomainUrl, tenantId: "tenant-1" })
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setDomains(prev => [...prev, data.data]);
      setNewDomainUrl("");
      setStatusMessage(t("status_domain_verified"));
      setTimeout(() => setStatusMessage(""), 2000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Error: ${err.message || err}`);
      setTimeout(() => setStatusMessage(""), 3500);
    } finally {
      setLoading(false);
    }
  };

  // Real-time animated pipeline simulator
  // REAL on-chain treasury payout: a native-XLM payment signed by the connected
  // wallet (Freighter). Produces a verifiable transaction hash on the explorer.
  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!freighterConnected || !freighterAddress) {
      setStatusMessage(lang === "es" ? "Conecta Freighter para firmar el pago." : "Connect Freighter to sign the payment.");
      setTimeout(() => setStatusMessage(""), 3500);
      return;
    }
    setLoading(true);
    setIsConsoleActive(true);
    setConsoleLogs([]);
    setLastPaymentTx(null);
    const log = (text: string, type: any = "info") => setConsoleLogs((prev) => [...prev, { text, type }]);
    // Treasury vault recipient (demo operator address).
    const recipient = contractRegistry?.deployer || "GDS5FCW6N7AW4BRJQS22AYUKYSAMNSHMUUTW6ZKRTYMWMIIJUSN7XAHR";
    try {
      log(`[INFO] ${t("log_1")}: ${execAmount} XLM → ${recipient.slice(0, 6)}…${recipient.slice(-4)}`, "info");
      log(`[LCP] ${t("log_3")} ${execDomain}`, "accent");
      log(`[SIGN] ${t("log_4")}`, "info");
      const res = await sendPayment(freighterAddress, recipient, String(execAmount));
      log(`[ON-CHAIN] ${t("log_9")} — tx ${res.hash}`, "success");
      setLastPaymentTx({ hash: res.hash, url: res.explorerUrl });
      setTransactions((prev) => [
        {
          id: res.hash.substring(0, 10),
          domain: execDomain,
          amount: execAmount,
          tokenType: "standard",
          status: "Completed",
          atrHash: res.hash,
          created_at: new Date().toISOString(),
        } as TransactionItem,
        ...prev,
      ]);
      setStatusMessage(`${t("status_payment_submitted")} ${res.hash.substring(0, 8)}…`);
      setTimeout(() => setStatusMessage(""), 4000);
    } catch (err: any) {
      log(`[ERROR] ${err?.message || err}`, "warn");
      if (err?.explorerUrl) setLastPaymentTx({ hash: err.hash, url: err.explorerUrl });
      setStatusMessage(`Payment failed: ${err?.message || err}`);
      setTimeout(() => setStatusMessage(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleDecryptBalance = () => {
    if (!viewKeyInput || !commitmentInput) return;
    const sum = Array.from(commitmentInput).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    setDecryptedBalance((sum % 8000) + 2000);
  };

  // REAL SEP-41 deposit into the treasury vault, using whatever classic asset
  // the connected wallet actually holds (read live from Horizon — see
  // refreshWalletBalances). Signed by Freighter; produces a real, persisted
  // transaction hash linked to the explorer. This is a genuine on-chain
  // transfer — it does not (yet) apply Pedersen-shielded confidentiality,
  // since that primitive (OpenZeppelin's confidential-token contract) is not
  // deployed in this build; see the notice in the UI.
  const handleDepositToTreasury = async () => {
    if (!freighterConnected || !freighterAddress) {
      setDepositError(lang === "es" ? "Conecta Freighter primero." : "Connect Freighter first.");
      return;
    }
    const selected = walletBalances[selectedDepositIdx];
    if (!selected) {
      setDepositError(lang === "es" ? "No se detectó ningún activo en tu billetera." : "No asset detected in your wallet.");
      return;
    }
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) {
      setDepositError(lang === "es" ? "Ingresa un monto válido." : "Enter a valid amount.");
      return;
    }
    setDepositing(true);
    setDepositError("");
    setDepositTx(null);
    try {
      const { Asset } = await import("@stellar/stellar-sdk");
      const asset = selected.code === "XLM" ? Asset.native() : new Asset(selected.code, selected.issuer!);
      const recipient = contractRegistry?.deployer || "GDS5FCW6N7AW4BRJQS22AYUKYSAMNSHMUUTW6ZKRTYMWMIIJUSN7XAHR";
      const res = await sendPayment(freighterAddress, recipient, String(amt), asset);
      setDepositTx({ hash: res.hash, url: res.explorerUrl });
      refreshWalletBalances(freighterAddress);
    } catch (err: any) {
      setDepositError(err?.message || String(err));
      if (err?.explorerUrl) setDepositTx({ hash: err.hash, url: err.explorerUrl });
    } finally {
      setDepositing(false);
    }
  };

  const getLocalizedTabHeader = (id: string) => {
    switch (id) {
      case "overview": return t("nav_overview");
      case "lcp": return t("nav_lcp");
      case "agents": return t("nav_agents");
      case "tokens": return t("nav_tokens");
      case "distributions": return t("nav_distributions");
      case "claim": return t("nav_claim");
      case "jwt_ops": return t("nav_jwt_ops");
      case "transactions": return t("nav_transactions");
      case "security": return t("nav_security");
      case "docs": return t("nav_docs");
      case "settings": return t("nav_settings");
      default: return id;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-955 font-sans antialiased text-slate-200">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}
      {/* Sidebar Navigation (drawer on mobile, static on desktop) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 max-w-[82vw] bg-slate-950/95 lg:bg-slate-950/45 border-r border-slate-900/60 p-6 flex flex-col justify-between backdrop-blur-xl transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div>
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3.5 px-2">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 shadow-xl shadow-indigo-550/15">
              <Shield className="w-6 h-6 text-white" />
              <div className="absolute inset-0 rounded-2xl border border-white/20 animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">Confidia</h1>
              <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">{t("brand_subtitle")}</span>
            </div>
          </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-white" aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1">
            {[
              { id: "overview", label: t("nav_overview"), icon: Layers },
              { id: "distributions", label: t("nav_distributions"), icon: Send },
              { id: "claim", label: t("nav_claim"), icon: Gift },
              { id: "tokens", label: t("nav_tokens"), icon: Coins },
              { id: "jwt_ops", label: t("nav_jwt_ops"), icon: ShieldCheck },
              { id: "lcp", label: t("nav_lcp"), icon: Scale },
              { id: "transactions", label: t("nav_transactions"), icon: FileText },
              { id: "security", label: t("nav_security"), icon: AlertTriangle },
              { id: "agents", label: t("nav_agents"), icon: Bot },
              { id: "docs", label: t("nav_docs"), icon: Code },
              { id: "settings", label: t("nav_settings"), icon: SettingsIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setStatusMessage("");
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 border ${active
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 shadow-lg shadow-indigo-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 hover:border-slate-800/40"
                    }`}
                >
                  <Icon className={`w-4.5 h-4.5 ${active ? "text-indigo-400" : "text-slate-500"}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-900/80 pt-6 px-2 text-[11px] text-slate-500 font-mono">
          <div>{t("net_testnet")}</div>
          <div className="flex items-center gap-1.5 mt-1.5 text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            {t("protocol_active")}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-10 relative bg-slate-950/20">
        {/* Glow Element */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[160px] pointer-events-none"></div>

        {/* Dynamic Headers */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-10 pb-6 border-b border-slate-900/60">
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden mt-0.5 p-2 -ml-1 shrink-0 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest mb-1.5">
                <Activity className="w-3.5 h-3.5" />
                Confidia Hub
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase truncate">{getLocalizedTabHeader(activeTab)}</h2>
              <p className="text-slate-400 mt-1 text-sm">{t("header_subtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* Global Wallet Status Widget */}
            {freighterConnected ? (
              <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 p-1.5 pr-3.5 rounded-xl shadow-md">
                <button
                  type="button"
                  onClick={handleConnectFreighter}
                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded-lg transition"
                >
                  {t("wallet_disconnect")}
                </button>
                <div className="flex flex-col text-right font-mono text-[10px]">
                  <span className="text-slate-200 font-bold select-all">{freighterAddress.substring(0, 6)}...{freighterAddress.substring(freighterAddress.length - 4)}</span>
                  <div className="flex items-center gap-1.5 justify-end mt-0.5">
                    <span className={`text-[8px] uppercase font-bold px-1 rounded ${isAuthenticated ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                      {isAuthenticated ? "Authenticated (SEP-10)" : "Connected (No Auth)"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectFreighter}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition duration-300 shadow-md shadow-indigo-600/10"
              >
                {lang === "es" ? "Conectar Billetera" : "Connect Wallet"}
              </button>
            )}

            {/* Language Selector */}
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-md"
            >
              <option value="en">🇺🇸 English</option>
              <option value="es">🇲🇽 Español</option>
            </select>

            {statusMessage && (
              <div className="px-4 py-2.5 rounded-xl text-xs font-mono font-semibold bg-indigo-950/80 border border-indigo-500/35 text-indigo-300 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {statusMessage}
              </div>
            )}
          </div>
        </header>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-10">
            {/* Thesis Banner */}
            <div className="p-8 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-slate-900/30 to-slate-950/80 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 blur-3xl rounded-full"></div>
              <div className="relative space-y-4">
                <span className="px-3 py-1 rounded-full text-[10px] uppercase font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                  Core Product Thesis
                </span>
                <h3 className="text-2xl font-extrabold tracking-tight text-white uppercase leading-snug">
                  {lang === "es"
                    ? "La tokenización resolvió la emisión. La distribución es el cuello de botella. Confidia lo soluciona."
                    : "Tokenization solved issuance. Distribution is the bottleneck. Confidia solves it."}
                </h3>
                <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
                  {lang === "es"
                    ? "Confidia proporciona canales de distribución de conocimiento cero (ZK) para dólares tokenizados (USDC/EURC) en Stellar. Permita reclamaciones privadas, nóminas confidenciales y desembolsos de subvenciones sin revelar la identidad de los beneficiarios en la cadena de bloques pública, al tiempo que garantiza el cumplimiento total y la auditoría institucional."
                    : "Confidia provides zero-knowledge (ZK) distribution rails for tokenized dollars (USDC/EURC) on Stellar. Enable private claims, confidential payroll, and grant payouts without exposing recipient identities on the public ledger, while guaranteeing full legal compliance and institutional auditing controls."}
                </p>
              </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                { title: t("kpi_active_agents"), value: "3", desc: t("kpi_active_agents_desc"), icon: Bot, color: "text-blue-400", border: "hover:border-blue-500/20" },
                { title: t("kpi_protected_volume"), value: "$134,800", desc: t("kpi_protected_volume_desc"), icon: Coins, color: "text-purple-400", border: "hover:border-purple-500/20" },
                { title: t("kpi_compliance_ratio"), value: "100%", desc: t("kpi_compliance_ratio_desc"), icon: Scale, color: "text-emerald-400", border: "hover:border-emerald-500/20" },
                { title: t("kpi_zk_verified"), value: "32", desc: t("kpi_zk_verified_desc"), icon: Shield, color: "text-indigo-400", border: "hover:border-indigo-500/20" },
              ].map((kpi, idx) => {
                const Icon = kpi.icon;
                return (
                  <div key={idx} className={`p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md transition-all duration-300 ${kpi.border}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500">{kpi.title}</span>
                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-900">
                        <Icon className={`w-4 h-4 ${kpi.color}`} />
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-white tracking-tight">{kpi.value}</div>
                    <div className="text-[11px] text-slate-500 mt-2 font-medium">{kpi.desc}</div>
                  </div>
                );
              })}
            </div>

            {/* Graphs & Analytics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Main SVG Area Chart */}
              <div className="col-span-2 p-6 rounded-2xl border border-slate-900 bg-slate-900/20 backdrop-blur-md">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-wide">{t("chart_volume_title")}</h3>
                    <p className="text-xs text-slate-500">{t("chart_volume_subtitle")}</p>
                  </div>
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 font-mono">
                    <TrendingUp className="w-3.5 h-3.5" /> {t("chart_volume_grow")}
                  </span>
                </div>

                {/* SVG Area Chart */}
                <div className="h-64 relative flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 600 240">
                    <defs>
                      <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="60" x2="600" y2="60" stroke="#1e293b" strokeOpacity="0.4" strokeDasharray="4 4" />
                    <line x1="0" y1="120" x2="600" y2="120" stroke="#1e293b" strokeOpacity="0.4" strokeDasharray="4 4" />
                    <line x1="0" y1="180" x2="600" y2="180" stroke="#1e293b" strokeOpacity="0.4" strokeDasharray="4 4" />
                    <path
                      d="M 0 190 Q 100 120 200 150 T 400 60 T 600 20 L 600 220 L 0 220 Z"
                      fill="url(#glowGrad)"
                    />
                    <path
                      d="M 0 190 Q 100 120 200 150 T 400 60 T 600 20"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M 0 200 Q 120 180 240 190 T 480 150 T 600 110"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeOpacity="0.3"
                      strokeDasharray="5 5"
                    />
                  </svg>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500 font-mono mt-4 border-t border-slate-900/60 pt-4">
                  <span>{t("mon")}</span>
                  <span>{t("tue")}</span>
                  <span>{t("wed")}</span>
                  <span>{t("thu")}</span>
                  <span>{t("fri")}</span>
                  <span>{t("sat")}</span>
                  <span>{t("sun")}</span>
                </div>
              </div>

              {/* Share Pie Chart and Indicators */}
              <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/20 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1 tracking-wide">{t("chart_privacy_title")}</h3>
                  <p className="text-xs text-slate-500">{t("chart_privacy_subtitle")}</p>
                </div>

                <div className="flex justify-center my-6">
                  <svg className="w-36 h-36" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.91" fill="none" stroke="#1e293b" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.91"
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="3"
                      strokeDasharray="72 28"
                      strokeDashoffset="25"
                    />
                  </svg>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-400 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-550"></span>
                      {t("mode_wrapper")} (72%)
                    </span>
                    <span className="font-mono text-slate-200 font-bold">$97,056</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-400 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
                      {t("mode_standard")} (28%)
                    </span>
                    <span className="font-mono text-slate-200 font-bold">$37,744</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Demo Payment Box & Interactive ZK Console pipeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Form execution */}
              <div className="p-8 rounded-3xl border border-slate-900 bg-gradient-to-br from-indigo-950/10 to-slate-950/65 shadow-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Bot className="w-5.5 h-5.5 text-indigo-400" /> {t("payment_demo_title")}
                  </h3>
                  <p className="text-xs text-slate-400 mb-6">{t("payment_demo_subtitle")}</p>
                </div>

                <form onSubmit={handleExecutePayment} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1.5 font-mono uppercase font-bold tracking-widest">{t("agent_owner")}</label>
                      <select
                        value={execAgentId}
                        onChange={(e) => setExecAgentId(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-200 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                      >
                        {agents.map((ag) => (
                          <option key={ag.id} value={ag.id}>{ag.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1.5 font-mono uppercase font-bold tracking-widest">{t("target_domain")}</label>
                      <select
                        value={execDomain}
                        onChange={(e) => setExecDomain(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-200 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                      >
                        {domains.map((dom) => (
                          <option key={dom.id} value={dom.url}>{dom.url}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-500 block mb-1.5 font-mono uppercase font-bold tracking-widest">{t("amount")}</label>
                      <input
                        type="number"
                        value={execAmount}
                        onChange={(e) => setExecAmount(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-200 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1.5 font-mono uppercase font-bold tracking-widest">Asset</label>
                      <select
                        value={execAsset}
                        onChange={(e) => setExecAsset(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-200 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="USDC">USDC</option>
                        <option value="EURC">EURC</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-650 hover:from-indigo-500 hover:to-purple-550 text-white font-bold py-3.5 px-4 rounded-xl transition duration-300 shadow-lg shadow-indigo-600/15"
                  >
                    {loading ? t("processing") : t("trigger_payment")}
                    <ArrowRight className="w-4.5 h-4.5" />
                  </button>
                  {!freighterConnected && (
                    <p className="text-[11px] text-amber-400 text-center">{t("jwt_onchain_connect")}</p>
                  )}
                  {lastPaymentTx && (
                    <a
                      href={lastPaymentTx.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 hover:bg-emerald-500/15"
                    >
                      <CheckCircle2 size={16} /> {t("payment_onchain_success")}
                      <span className="font-mono text-xs text-indigo-300 underline">{lastPaymentTx.hash.slice(0, 12)}… ↗</span>
                    </a>
                  )}
                </form>
              </div>

              {/* Right Column: Live ZK Terminal */}
              <div className="p-6 rounded-3xl border border-slate-900 bg-slate-950 shadow-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full"></div>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-900/80">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                    <span className="text-xs uppercase font-extrabold text-slate-400 font-mono tracking-wider">{t("console_header")}</span>
                  </div>
                  <Terminal className="w-4.5 h-4.5 text-slate-500" />
                </div>

                <div className="flex-1 bg-slate-960 rounded-xl p-4 border border-slate-900/60 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-[220px] min-h-[220px] space-y-2">
                  {isConsoleActive ? (
                    consoleLogs.map((log, i) => (
                      <div
                        key={i}
                        className={`transition-all duration-300 ${log.type === "success"
                          ? "text-emerald-400"
                          : log.type === "accent"
                            ? "text-purple-400 font-semibold"
                            : log.type === "warn"
                              ? "text-amber-400"
                              : "text-slate-400"
                          }`}
                      >
                        {log.text}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 flex items-center justify-center h-full gap-2">
                      <Code className="w-4 h-4" />
                      <span>Idle. Trigger a payment test to watch compliance execution logs.</span>
                    </div>
                  )}
                  <div ref={consoleBottomRef}></div>
                </div>

                {loading && (
                  <div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-slate-400 font-mono justify-center bg-indigo-950/20 border border-indigo-500/10 py-2 rounded-lg">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    {t("running_lcp")}
                  </div>
                )}
              </div>
            </div>

            {/* Web2 vs Web3 Copy Alignment & Explanations */}
            <div className="border-t border-slate-900/85 pt-10">
              <h3 className="text-xl font-extrabold text-white mb-6 flex items-center gap-2">
                <HelpCircle className="w-5.5 h-5.5 text-indigo-400" />
                {t("explain_lcp_title")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  { title: t("explain_lcp_title"), desc: t("explain_lcp_desc"), icon: Scale, color: "text-indigo-400" },
                  { title: t("explain_zk_title"), desc: t("explain_zk_desc"), icon: Shield, color: "text-purple-450" },
                  { title: t("explain_auditor_title"), desc: t("explain_auditor_desc"), icon: Lock, color: "text-blue-450" }
                ].map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <div key={i} className="p-6 rounded-2xl border border-slate-900 bg-slate-900/15">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-900">
                          <Icon className={`w-4 h-4 ${card.color}`} />
                        </div>
                        <h4 className="font-bold text-white text-sm">{card.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">{card.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Legal Context Protocol */}
        {activeTab === "lcp" && (
          <div className="space-y-8">
            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-md">
              <h3 className="text-lg font-bold text-white mb-2">{t("register_lcp_title")}</h3>
              <p className="text-xs text-slate-400 mb-4">Provide the Counterparty DNS domain to fetch and verify their on-chain compliance metadata.</p>
              <form onSubmit={handleRegisterDomain} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="e.g. counterparty.example.com"
                  value={newDomainUrl}
                  onChange={(e) => setNewDomainUrl(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-900 text-slate-200 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> {t("register_lcp_button")}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {domains.map((dom) => (
                <LcpStatusCard
                  key={dom.id}
                  domain={dom.url}
                  atrHash={dom.lcp_json.atrHash}
                  jurisdiction={dom.lcp_json.jurisdiction}
                  disputeResolution={dom.lcp_json.disputeResolution}
                  acceptanceRequired={dom.lcp_json.acceptanceRequired}
                  status={dom.status}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Agents */}
        {activeTab === "agents" && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white mb-4">{t("active_agents_title")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {agents.map((ag) => (
                <div key={ag.id} className="p-6 rounded-2xl border border-slate-900 bg-slate-900/25">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">{ag.name}</h3>
                      <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider">ID: {ag.id}</span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      {ag.status}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1 font-mono uppercase font-bold tracking-widest">{t("agent_pub_key")}</span>
                      <span className="font-mono text-xs text-slate-400 block p-2.5 rounded-lg bg-slate-950 border border-slate-900 truncate">
                        {ag.pubKey}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1.5 font-mono uppercase font-bold tracking-widest">{t("capabilities")}</span>
                      <div className="flex gap-2">
                        {ag.capabilities.map((cap: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 text-[10px] rounded-lg bg-slate-800 border border-slate-700 text-slate-350 font-mono font-semibold">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1 font-mono uppercase font-bold tracking-widest">{t("bound_domains")}</span>
                      <ul className="text-xs text-slate-400 space-y-1 mt-1.5">
                        {ag.bound_domains.map((dom: string, i: number) => (
                          <li key={i} className="flex items-center gap-2 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> {dom}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Tokens & Confidential Layer */}
        {activeTab === "tokens" && (
          <div className="space-y-8">
            {/* Attribution Callout Notice */}
            <div className="p-5 rounded-2xl border border-indigo-500/25 bg-indigo-950/15 backdrop-blur-md space-y-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Reference Architecture Notice</span>
              </div>
              <p className="text-xs text-indigo-350 leading-relaxed font-medium">
                Built on top of OpenZeppelin's Confidential Token contract suite (<code>feat/confidential-verifier-ultrahonk</code>) and Nethermind's UltraHonk verifier — Confidia adds the missing distribution, claims, identity, legal, and audit layer on top of the base primitive.
              </p>
              <div className="text-[10px] text-slate-500 font-mono">
                Attribution: Confidential balances powered by OpenZeppelin Confidential Tokens (dev preview) + Nethermind UltraHonk verifier.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Real SEP-41 deposit — reads the connected wallet's actual balances via
                  Horizon (no hardcoded USDC/EURC issuer addresses) and signs a real
                  payment with Freighter. */}
              <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/30">
                <h3 className="text-lg font-bold text-white mb-1.5">{t("wrap_tokens_title")}</h3>
                <p className="text-xs text-slate-400 mb-4">{t("wrap_tokens_real_note")}</p>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-widest">{t("wrap_tokens_select")}</label>
                      {freighterConnected && (
                        <button
                          type="button"
                          onClick={() => refreshWalletBalances(freighterAddress)}
                          disabled={balancesLoading}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw size={11} className={balancesLoading ? "animate-spin" : ""} /> {t("wrap_refresh")}
                        </button>
                      )}
                    </div>
                    {!freighterConnected ? (
                      <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">{t("jwt_onchain_connect")}</div>
                    ) : walletBalances.length === 0 ? (
                      <div className="text-xs text-slate-400 bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5">
                        {balancesLoading ? t("wrap_loading_balances") : t("wrap_no_balances")}
                      </div>
                    ) : (
                      <select
                        value={selectedDepositIdx}
                        onChange={(e) => setSelectedDepositIdx(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-300 text-xs font-semibold focus:outline-none"
                      >
                        {walletBalances.map((b, i) => (
                          <option key={`${b.code}-${b.issuer}`} value={i}>
                            {b.code} — {parseFloat(b.balance).toLocaleString()} {t("wrap_available")}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1.5 font-mono uppercase font-bold tracking-widest">{t("amount")}</label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-300 text-xs font-bold focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleDepositToTreasury}
                    disabled={depositing || !freighterConnected || walletBalances.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl transition duration-300 shadow-md"
                  >
                    {depositing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                    {depositing ? t("processing") : t("wrap_tokens_button")}
                  </button>
                  {depositTx && (
                    <a href={depositTx.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 hover:bg-emerald-500/15">
                      <CheckCircle2 size={16} className="shrink-0" /> {t("payment_onchain_success")}
                      <span className="font-mono text-xs text-indigo-300 underline">{depositTx.hash.slice(0, 12)}… ↗</span>
                    </a>
                  )}
                  {depositError && (
                    <div className="flex items-start gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3 break-all">
                      <XCircle size={16} className="shrink-0 mt-0.5" /> {depositError}
                    </div>
                  )}
                </div>
              </div>

              {/* View key audit panel — illustrative preview of the OpenZeppelin
                  Pedersen-commitment / view-key UX; not connected to a deployed
                  confidential-balance contract (see Reference Architecture Notice above). */}
              <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Lock className="w-5 h-5 text-purple-400" /> {t("decrypt_commitment_title")}
                    </h3>
                    <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{t("preview_badge")}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{t("decrypt_commitment_subtitle")}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1.5 font-mono uppercase font-bold tracking-widest">{t("balance_commitment")}</label>
                    <input
                      type="text"
                      value={commitmentInput}
                      onChange={(e) => setCommitmentInput(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1.5 font-mono uppercase font-bold tracking-widest">{t("auditor_view_key")}</label>
                    <input
                      type="text"
                      value={viewKeyInput}
                      onChange={(e) => setViewKeyInput(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-300 text-xs font-mono"
                    />
                  </div>

                  <div className="flex gap-4 items-center">
                    <button
                      onClick={handleDecryptBalance}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/25 rounded-xl text-xs font-bold transition"
                    >
                      {t("audit_balance_button")}
                    </button>
                    {decryptedBalance !== null && (
                      <span className="text-xs font-bold text-emerald-400 font-mono">
                        {t("decrypted_balance_label")}: ${decryptedBalance.toLocaleString()} USDC
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Circuit verifiers */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">{t("active_verifiers")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <ZkProofVisualizer
                  circuitName="zkBalance"
                  publicInputs={["commitment", "transferAmountCommitment"]}
                  proofHex="0x892a0df36e04d4128f73b1657ff1fc53b92dc18148a1d65d648fc92c0192e46b08e24dc1a64bc1ae82"
                  isVerified={true}
                  lang={lang}
                />
                <ZkProofVisualizer
                  circuitName="zkExposure"
                  publicInputs={["limit", "currentDailyVolumeCommitment"]}
                  proofHex="0x6e04d4128f73b1657ff1fc53b92dc18148a1d65d648fc92c0192e46b08e24dc1a64bc1ae82"
                  isVerified={true}
                  lang={lang}
                />
                <ZkProofVisualizer
                  circuitName="zkEligibility"
                  publicInputs={["lcpJurisdictionHash", "accreditedStatusRequired"]}
                  proofHex="0xfc53b92dc18148a1d65d648fc92c0192e46b08e24dc1a64bc1ae820x892a0df36"
                  isVerified={true}
                  lang={lang}
                />
              </div>
            </div>

            {/* Deployed on-chain contracts (Stellar Testnet) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{t("deployed_contracts_title")}</h3>
                {contractRegistry?.deployed ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {t("contract_status_live")}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-700/40 text-slate-400 border border-slate-700">
                    {t("contract_status_pending")}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mb-4">{t("deployed_contracts_subtitle")}</p>
              <div className="rounded-2xl border border-slate-900 bg-slate-900/25 divide-y divide-slate-900">
                {[
                  { key: "gateway", label: t("contract_gateway") },
                  { key: "vestingClaim", label: t("contract_vesting") },
                  { key: "ultrahonkVerifier", label: t("contract_verifier") },
                  { key: "compliance", label: t("contract_compliance") },
                  { key: "jwkRegistry", label: t("contract_jwk") },
                ].map(({ key, label }) => {
                  const addr = contractRegistry?.contracts?.[key];
                  return (
                    <div key={key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <span className="text-sm font-semibold text-slate-200">{label}</span>
                      {addr ? (
                        <a
                          href={`${contractRegistry?.explorerBase || "https://stellar.expert/explorer/testnet/contract"}/${addr}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-indigo-400 hover:text-indigo-300 truncate max-w-[220px] select-all"
                          title={addr}
                        >
                          {addr.slice(0, 6)}…{addr.slice(-6)}
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-slate-600">{t("contract_not_deployed")}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {contractRegistry?.deployer && (
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500 font-mono">
                  <span>{t("contract_network")}: {contractRegistry?.network}</span>
                  <span>{t("contract_deployer")}: {contractRegistry.deployer.slice(0, 6)}…{contractRegistry.deployer.slice(-6)}</span>
                </div>
              )}
            </div>

            {/* Live on-chain verification against the deployed contracts */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold text-white">{t("live_verify_title")}</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleLiveVerify}
                    disabled={liveVerifying || !contractRegistry?.contracts?.ultrahonkVerifier}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    {liveVerifying ? <RefreshCw size={16} className="animate-spin" /> : <Activity size={16} />}
                    {liveVerifying ? t("live_verify_running") : t("live_verify_btn")}
                  </button>
                  <button
                    onClick={handleSignedVerify}
                    disabled={signedVerifying || !freighterConnected || !contractRegistry?.contracts?.ultrahonkVerifier}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    {signedVerifying ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                    {signedVerifying ? t("signed_verify_running") : t("signed_verify_btn")}
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">{t("live_verify_subtitle")}</p>
              {!freighterConnected && <p className="text-[11px] text-amber-400 mb-3 -mt-2">{t("jwt_onchain_connect")}</p>}
              {signedVerifyTx && (
                <a href={signedVerifyTx.url} target="_blank" rel="noopener noreferrer" className="mb-3 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 hover:bg-emerald-500/15">
                  <CheckCircle2 size={16} className="shrink-0" /> {t("signed_verify_success")}
                  <span className="font-mono text-xs text-indigo-300 underline">{signedVerifyTx.hash.slice(0, 12)}… ↗</span>
                </a>
              )}
              {liveError && (
                <div className="mb-3 flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 break-all">
                  <XCircle size={16} className="shrink-0" /> {liveError}
                </div>
              )}
              {liveResults.length > 0 && (
                <div className="rounded-2xl border border-slate-900 bg-slate-900/25 divide-y divide-slate-900">
                  {liveResults.map((r) => (
                    <div key={r.method} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-mono text-slate-200">{r.method}()</span>
                        <a
                          href={`${contractRegistry?.explorerBase || "https://stellar.expert/explorer/testnet/contract"}/${r.contract}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300"
                        >
                          {r.contract.slice(0, 6)}…{r.contract.slice(-6)}
                        </a>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-500 font-mono">{r.latencyMs}ms</span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${r.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
                          {r.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {r.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Policies */}
        {activeTab === "policies" && (
          <div className="space-y-6">
            {policies.map((pol) => (
              <div key={pol.id} className="p-6 rounded-2xl border border-slate-900 bg-slate-900/25">
                <h3 className="text-lg font-bold text-white mb-4">{pol.name}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 space-y-3">
                    <h4 className="font-bold text-indigo-400 font-mono text-[10px] uppercase tracking-widest">{t("threshold_limits")}</h4>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t("max_standard_transfer")}</span>
                      <span className="font-bold text-slate-100">${pol.rules.maxStandardAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t("require_confidential_wrapper")}</span>
                      <span className="font-semibold text-purple-400">{t("yes_above_limit")}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 space-y-3">
                    <h4 className="font-bold text-indigo-400 font-mono text-[10px] uppercase tracking-widest">{t("zk_lcp_controls")}</h4>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t("enforced_proofs")}</span>
                      <span className="font-semibold text-slate-200">{pol.rules.requiredProofs.join(", ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t("allowed_jurisdictions")}</span>
                      <span className="font-semibold text-slate-200">{pol.rules.allowedJurisdictions.join(", ")}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 6: Transactions & Agreements */}
        {activeTab === "transactions" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-white mb-4">{t("lcp_acceptance_logs")}</h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-900 bg-slate-900/30">
                <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-350">
                  <thead className="bg-slate-900/90 text-xs font-semibold text-slate-400 uppercase">
                    <tr>
                      <th className="px-6 py-4">{t("table_agr_id")}</th>
                      <th className="px-6 py-4">{t("table_domain")}</th>
                      <th className="px-6 py-4">{t("table_agent_owner")}</th>
                      <th className="px-6 py-4">{t("table_atr_hash")}</th>
                      <th className="px-6 py-4">{t("table_signature")}</th>
                      <th className="px-6 py-4">{t("table_status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-xs text-slate-300">
                    {agreements.map((agr) => (
                      <tr key={agr.id} className="hover:bg-slate-900/30 transition">
                        <td className="px-6 py-4 text-slate-400">{agr.id}</td>
                        <td className="px-6 py-4 font-sans font-semibold text-slate-200">{agr.domain}</td>
                        <td className="px-6 py-4 font-sans text-slate-200">{agr.agentId}</td>
                        <td className="px-6 py-4 text-slate-400 truncate max-w-[150px]">{agr.atrHash}</td>
                        <td className="px-6 py-4 text-indigo-400 truncate max-w-[150px]">{agr.signature}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider font-semibold text-[10px]">
                            {t("table_status_signed")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-4">{t("payment_history")}</h3>
              <TransactionTable items={transactions} lang={lang} />
            </div>
          </div>
        )}

        {/* Tab 7: Security & Audits */}
        {activeTab === "security" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Testing suite status */}
              <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/30">
                <h3 className="text-lg font-bold text-white mb-4">{t("verification_checklists")}</h3>
                <ul className="space-y-3.5 text-sm text-slate-350">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {t("verification_passed_1")}
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {t("verification_passed_2")}
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {t("verification_passed_3")}
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {t("verification_passed_4")}
                  </li>
                </ul>
              </div>

              {/* DeFi Gotchas */}
              <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/30">
                <h3 className="text-lg font-bold text-white mb-4">{t("stellar_defi_safeguards")}</h3>
                <ul className="space-y-3.5 text-sm text-slate-350">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {t("defi_passed_1")}
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {t("defi_passed_2")}
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {t("defi_passed_3")}
                  </li>
                  <li className="flex items-center gap-3 text-slate-500">
                    <XCircle className="w-5 h-5 text-slate-650" />
                    {t("defi_passed_4")}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 8: Settings */}
        {activeTab === "settings" && (
          <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/25 max-w-2xl">
            <h3 className="text-lg font-bold text-white mb-6">{t("tenant_settings_title")}</h3>

            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-2 font-mono uppercase font-bold tracking-widest">{t("tenant_name")}</label>
                  <input
                    type="text"
                    defaultValue="Institutional Treasury Org"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-350 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-2 font-mono uppercase font-bold tracking-widest">{t("default_gas_limit")}</label>
                  <input
                    type="number"
                    defaultValue="5000000"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-350 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block mb-2 font-mono uppercase font-bold tracking-widest">{t("db_persistence")}</label>
                <select className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-350 focus:outline-none">
                  <option value="supabase">Supabase cloud integration</option>
                  <option value="sqlite">Local mock SQLite mode</option>
                </select>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-900/60">
                <h4 className="font-bold text-indigo-400 font-mono text-[10px] uppercase tracking-widest">{t("feature_toggles")}</h4>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950" />
                  <span>{t("confidential_wrapper_opt")}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950" />
                  <span>{t("zk_kyc_opt")}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950" />
                  <span>{t("zk_vm_opt")}</span>
                </label>
              </div>
            </div>
          </div>
        )}
        {/* Tab 9: Private Distributions Creator */}
        {activeTab === "distributions" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/25 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Send className="w-5 h-5 text-indigo-400" /> {t("dist_title")}
                </h3>
                <p className="text-xs text-slate-400">{t("dist_subtitle")}</p>
              </div>

              <form onSubmit={handlePrepareDistribution} className="space-y-4 text-sm">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-2 font-mono uppercase font-bold tracking-widest">{t("dist_name_label")}</label>
                  <input
                    type="text"
                    value={distName}
                    onChange={(e) => setDistName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-350 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-2 font-mono uppercase font-bold tracking-widest">{t("dist_recipients_label")}</label>
                  <textarea
                    rows={4}
                    value={distRecipientsRaw}
                    onChange={(e) => setDistRecipientsRaw(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-350 font-mono text-xs focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl transition duration-300 shadow-md shadow-indigo-550/10">
                  {t("dist_btn_prepare")}
                </button>
              </form>
            </div>

            <div className="space-y-8">
              {/* Prepared root statistics */}
              {distRoot && (
                <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/25 space-y-6">
                  <h3 className="text-lg font-bold text-white mb-4">{t("dist_stats_title")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-900/80">
                      <span className="text-slate-500 block uppercase font-bold text-[9px] mb-1">{t("dist_total_recipients")}</span>
                      <span className="text-sm font-bold text-white">{distTotalRecipients}</span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-900/80">
                      <span className="text-slate-500 block uppercase font-bold text-[9px] mb-1">{t("dist_total_allocation")}</span>
                      <span className="text-sm font-bold text-white">${distTotalAllocation.toLocaleString()} USDC</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-mono font-bold text-[9px] mb-1">{t("dist_root_hash")}</span>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-900/80 text-[10px] text-indigo-300 truncate font-mono">
                      {distRoot}
                    </div>
                  </div>
                  {!distDeployedAddress ? (
                    <button
                      onClick={handleDeployDistribution}
                      disabled={distDeploying}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 px-4 rounded-xl transition duration-300 disabled:opacity-50"
                    >
                      {distDeploying ? t("processing") : t("dist_btn_deploy")}
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                      <span className="text-xs font-bold text-emerald-400 block">{t("dist_status_deployed")}</span>
                      <code className="text-[10px] text-slate-350 block select-all bg-slate-950 p-2 rounded border border-slate-900">{distDeployedAddress}</code>
                    </div>
                  )}
                </div>
              )}

              {/* Analytics metrics */}
              <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/25 space-y-4">
                <h3 className="text-lg font-bold text-white">{t("dist_analytics_title")}</h3>
                <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-900">
                  <div style={{ width: `${(claimChartData.claimed / (claimChartData.claimed + claimChartData.pending || 1)) * 100}%` }} className="bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"></div>
                  <div className="flex-1 bg-indigo-500/20"></div>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                    {t("dist_analytics_claimed")}: ${claimChartData.claimed.toLocaleString()} USDC
                  </div>
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-500/40"></span>
                    {t("dist_analytics_pending")}: ${claimChartData.pending.toLocaleString()} USDC
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 10: Recipient Claim Portal */}
        {activeTab === "claim" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Demo Simulation Controls Selector */}
            <div className="col-span-2 p-4 rounded-2xl border border-indigo-500/20 bg-indigo-550/5 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <SettingsIcon className="w-4 h-4 text-indigo-400" /> {t("demo_mode_title")}
                  </h4>
                  <p className="text-[11px] text-slate-400">{t("demo_mode_desc")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { id: "happy", label: t("demo_path_happy"), color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
                  { id: "stale_jwk", label: t("demo_path_stale_jwk"), color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
                  { id: "wrong_wallet", label: t("demo_path_wrong_wallet"), color: "bg-red-500/10 text-red-400 border-red-500/20" },
                  { id: "paused", label: t("demo_path_paused"), color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
                  { id: "claimed", label: t("demo_path_claimed"), color: "bg-slate-500/10 text-slate-405 border-slate-500/20" },
                ].map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      setDemoFailureScenario(p.id as any);
                      if (p.id === "wrong_wallet") {
                        setFreighterConnected(true);
                        setFreighterAddress("GCSB5XWRONGWALLET498234902348902348902348");
                      } else {
                        if (freighterConnected) {
                          setFreighterAddress("GCB5X7E7PXM3N5S5YF6K6R2G3F4H7J8K9L0M1N2P");
                        }
                      }
                    }}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition ${demoFailureScenario === p.id
                      ? "bg-indigo-600 text-white border-transparent shadow-md shadow-indigo-600/15"
                      : p.color
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/25 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-indigo-400" /> {t("claim_portal_title")}
                </h3>
                <p className="text-xs text-slate-400 mb-4">{t("claim_portal_subtitle")}</p>
              </div>

              {/* 7-Step Stepper timeline indicators */}
              <div className="grid grid-cols-7 gap-1 border-b border-slate-900/60 pb-5">
                {[
                  { step: 1, label: lang === "es" ? "Identificar" : "Identify" },
                  { step: 2, label: lang === "es" ? "Verificar" : "Verify" },
                  { step: 3, label: lang === "es" ? "Probar ZK" : "Prove ZK" },
                  { step: 4, label: lang === "es" ? "Billetera" : "Wallet" },
                  { step: 5, label: lang === "es" ? "Enviar" : "Submit" },
                  { step: 6, label: lang === "es" ? "Liquidado" : "Settled" },
                  { step: 7, label: lang === "es" ? "Recibo" : "Receipt" },
                ].map((s) => {
                  const currentStep = claimSuccessMsg ? 7 : (claimProving ? 3 : (freighterConnected ? 4 : (claimEmail && claimPin ? 2 : 1)));
                  const active = currentStep >= s.step;
                  return (
                    <div key={s.step} className="flex flex-col items-center text-center space-y-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition ${active
                        ? "bg-indigo-600 text-white border-transparent shadow-md shadow-indigo-600/10"
                        : "bg-slate-950 text-slate-500 border-slate-900"
                        }`}>
                        {s.step}
                      </div>
                      <span className={`hidden sm:block text-[8px] font-mono tracking-tighter uppercase leading-tight ${active ? "text-indigo-400 font-bold" : "text-slate-600"
                        }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Stellar Wallets Kit Connect */}
              <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4.5 h-4.5 text-purple-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Stellar Wallets Kit (SEP-43)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectFreighter}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${freighterConnected
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                      : "bg-indigo-600 text-white hover:bg-indigo-500"
                      }`}
                  >
                    {freighterConnected ? t("wallet_disconnect") : t("wallet_connect")}
                  </button>
                </div>

                {freighterConnected && (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-slate-350">
                      <span>Address:</span>
                      <span className="text-[10px] text-slate-200 select-all truncate max-w-[150px]">{freighterAddress}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Auth State:</span>
                      <span className={`text-[10px] font-bold ${isAuthenticated ? "text-indigo-400" : "text-amber-400"}`}>
                        {isAuthenticated ? "Authenticated via SEP-10 JWT" : "Connected (Pending WebAuth)"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {freighterConnected && freighterNetwork === "public" && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-400 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t("wallet_wrong_network")}</span>
                </div>
              )}

              <form onSubmit={handleExecuteClaim} className="space-y-4 text-sm">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-2 font-mono uppercase font-bold tracking-widest">{t("claim_email")}</label>
                  <input
                    type="email"
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-350 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-2 font-mono uppercase font-bold tracking-widest">{t("claim_pin")}</label>
                  <input
                    type="password"
                    value={claimPin}
                    onChange={(e) => setClaimPin(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-350 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-2 font-mono uppercase font-bold tracking-widest">{t("claim_wallet")}</label>
                  <input
                    type="text"
                    value={claimWallet}
                    onChange={(e) => setClaimWallet(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-350 font-mono text-xs focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={claimProving || (freighterConnected && freighterNetwork === "public")}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl transition duration-300 shadow-md shadow-indigo-550/10 disabled:opacity-50"
                >
                  {claimProving ? t("processing") : t("claim_btn_trigger")}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              {/* Vesting Timeline Graphical Widget */}
              <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/20 space-y-3.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">{t("vesting_schedule")}</h4>
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between text-xs">
                    <span className="text-slate-500">Cliff Lock (Ended)</span>
                    <span className="text-emerald-400 font-bold">Standard Payout Claimable</span>
                  </div>
                  <div className="overflow-hidden h-2.5 text-xs flex rounded bg-slate-900 border border-slate-900">
                    <div style={{ width: "30%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-rose-500/40"></div>
                    <div style={{ width: "45%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"></div>
                    <div style={{ width: "25%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-600/30"></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                    <span>Cliff (Month 3)</span>
                    <span>Standard Release (Month 9)</span>
                    <span>Shielded Payout (Month 12)</span>
                  </div>
                </div>
              </div>

              {/* Claim Proving Console logs */}
              {claimLogs.length > 0 && (
                <div className="p-6 rounded-2xl border border-slate-900 bg-slate-950 space-y-4">
                  <h4 className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-widest flex items-center gap-1.5">
                    <Terminal className="w-4 h-4" /> ZK-CLAIM PROVER TERMINAL
                  </h4>
                  <div className="font-mono text-xs space-y-2">
                    {claimLogs.map((log, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-indigo-500 font-bold select-none">&gt;</span>
                        <span className={log.includes("success") || log.includes("Settled") ? "text-emerald-400" : log.includes("ERROR") ? "text-rose-400 font-semibold" : "text-slate-300"}>{log}</span>
                      </div>
                    ))}
                    {claimProving && (
                      <div className="flex items-center gap-2 text-indigo-450">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating cryptographic proof...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Session renews in: <span className="text-amber-400 font-bold">{formatCountdown(claimCountdown)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTechDrawerOpen(!techDrawerOpen)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline flex items-center gap-1"
                    >
                      <Code className="w-3.5 h-3.5" />
                      {t("tech_drawer_title")}
                    </button>
                  </div>

                  {techDrawerOpen && (
                    <div className="p-4 rounded-xl border border-slate-900 bg-slate-950 font-mono text-[10px] space-y-2 mt-2">
                      <div className="flex justify-between"><span className="text-slate-500">{t("tech_proof_type")}:</span><span className="text-slate-300">UltraHonk (Noir)</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t("tech_verifier_addr")}:</span><span className="text-indigo-400 select-all truncate max-w-[160px]" title={contractRegistry?.contracts?.ultrahonkVerifier || undefined}>{contractRegistry?.contracts?.ultrahonkVerifier ? `${contractRegistry.contracts.ultrahonkVerifier.slice(0,8)}…${contractRegistry.contracts.ultrahonkVerifier.slice(-4)}` : "CV254KVerifier1920384..."}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t("tech_key_id")}:</span><span className="text-slate-300">mock-google-key-id</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t("tech_session_nonce")}:</span><span className="text-slate-300 truncate max-w-[160px]">nonce_8a7d2f93d8b5c90...</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t("tech_commitment")}:</span><span className="text-slate-300 truncate max-w-[160px]">0x7d5a26814d8dcb93b0...</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t("tech_nullifier")}:</span><span className="text-slate-300 truncate max-w-[160px]">0x90210e3b0c44298fc1...</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t("tech_envelope")}:</span><span className="text-indigo-400 truncate max-w-[160px]">Envelope_xdr_Soroban_Tx</span></div>
                    </div>
                  )}
                </div>
              )}

              {claimSuccessMsg && (
                <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">{t("claim_success")}</h4>
                    <p className="text-xs text-slate-400">Transaction hash recorded and verified on Stellar ledger.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 11: JWT operations registry sync */}
        {activeTab === "jwt_ops" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/25 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" /> {t("jwt_ops_title")}
                </h3>
                <p className="text-xs text-slate-400">{t("jwt_ops_subtitle")}</p>
              </div>
              <button
                onClick={handleSyncJwtKeys}
                disabled={jwtSyncing}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition duration-300 shadow-md shadow-indigo-550/10 disabled:opacity-50 text-xs flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${jwtSyncing ? "animate-spin" : ""}`} />
                {t("jwt_btn_sync")}
              </button>
            </div>

            {/* Real, Freighter-signed on-chain key registration */}
            <div className="p-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04]">
              <div className="flex items-center justify-between mb-3 gap-4">
                <div>
                  <h4 className="font-bold text-white flex items-center gap-2"><Fingerprint className="w-4 h-4 text-indigo-400" /> {t("jwt_onchain_title")}</h4>
                  <p className="text-xs text-slate-400 mt-1">{t("jwt_onchain_subtitle")}</p>
                </div>
                {!freighterConnected && <span className="text-[11px] text-amber-400 whitespace-nowrap">{t("jwt_onchain_connect")}</span>}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={newKeyKid}
                  onChange={(e) => setNewKeyKid(e.target.value)}
                  placeholder="Key ID (kid)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 font-mono focus:border-indigo-500 outline-none"
                />
                <button
                  onClick={handleRegisterKeyOnChain}
                  disabled={keyRegistering || !freighterConnected}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors whitespace-nowrap"
                >
                  {keyRegistering ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                  {keyRegistering ? t("jwt_onchain_signing") : t("jwt_onchain_btn")}
                </button>
              </div>
              {keyTx && (
                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
                  <CheckCircle2 size={16} className="shrink-0" /> {t("jwt_onchain_success")}
                  <a href={keyTx.url} target="_blank" rel="noopener noreferrer" className="ml-1 underline font-mono text-xs text-indigo-300 hover:text-indigo-200">
                    {keyTx.hash.slice(0, 12)}… ↗
                  </a>
                </div>
              )}
              {keyTxError && (
                <div className="mt-3 flex items-start gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3 break-all">
                  <XCircle size={16} className="shrink-0 mt-0.5" /> {keyTxError}
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-900 bg-slate-900/30">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-350">
                <thead className="bg-slate-900/90 text-xs font-semibold text-slate-400 uppercase">
                  <tr>
                    <th className="px-6 py-4">{t("jwt_key_id")}</th>
                    <th className="px-6 py-4">{t("jwt_provider")}</th>
                    <th className="px-6 py-4">Alg</th>
                    <th className="px-6 py-4">{t("jwt_modulus")}</th>
                    <th className="px-6 py-4">{t("jwt_exponent")}</th>
                    <th className="px-6 py-4">{t("jwt_status")}</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-xs text-slate-300">
                  {jwtKeys.map((key) => (
                    <tr key={key.kid} className="hover:bg-slate-900/30 transition">
                      <td className="px-6 py-4 text-indigo-400 font-bold">{key.kid}</td>
                      <td className="px-6 py-4 font-sans font-semibold text-slate-200">{key.provider}</td>
                      <td className="px-6 py-4">{key.alg}</td>
                      <td className="px-6 py-4 text-slate-400 truncate max-w-[120px]">{key.n}</td>
                      <td className="px-6 py-4 text-slate-400">{key.e}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-wider font-semibold border ${key.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}>
                          {key.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {key.status === "active" && (
                          <button
                            onClick={() => handleRevokeJwtKey(key.kid)}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold transition"
                          >
                            {t("jwt_action_revoke")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Developer Docs */}
        {activeTab === "docs" && (
          <div className="space-y-6 max-w-4xl">
            <div className="p-4 sm:p-6 rounded-2xl border border-slate-900 bg-slate-900/25">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Code className="w-5 h-5 text-indigo-400" /> {t("docs_title")}</h3>
              <p className="text-sm text-slate-400 mb-4">{t("docs_intro")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: t("docs_link_dashboard"), href: "https://confidia.vercel.app", val: "confidia.vercel.app" },
                  { label: t("docs_link_api"), href: "https://confidia-api.fly.dev", val: "confidia-api.fly.dev" },
                  { label: t("docs_link_repo"), href: "https://github.com/Eras256/Confidia", val: "github.com/Eras256/Confidia" },
                ].map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 transition block">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{l.label}</div>
                    <div className="text-xs font-mono text-indigo-400 truncate mt-1">{l.val} ↗</div>
                  </a>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl border border-slate-900 bg-slate-900/25">
              <h4 className="font-bold text-white mb-3">{t("docs_contracts")}</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-900">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-900/80 text-[11px] uppercase text-slate-400"><tr><th className="px-4 py-2">Contract</th><th className="px-4 py-2">Address</th></tr></thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-xs">
                    {[
                      ["Real UltraHonk Verifier (BN254)", "CAM2WWTBWGNJBCB7J5LE76H2NUIXIO7VPJCKILY7SMORLPQ5HOGMIW6J"],
                      ["Gateway", "CANR7PCHCLOP3YMGXPZVOBHIDNYLDVC3IPKRS52ZAPYUVCYQXHVIAGJC"],
                      ["Vesting Claim Vault", "CB26YAB57YURXLH5NF43AD4O2NSPSFUDXYDAUTKVLAERODRPSEZWMKIX"],
                      ["UltraHonk Verifier (sim)", "CBKTBGW2PJRTRA2VDQVDUQFT2UVVMAWRCMQUJPUYVOPW6SQMFTNGDZPP"],
                      ["Compliance Hook", "CBI3U4KZGVISV7PDGICBAHBSNYL7FEMJ7HL2GLTNHZXRPCLVTQOP3DLF"],
                      ["JWK Registry", "CCE7XJSY5NQVI62YISRNZMCIVZGVCJ47WB3NDF5NLJIFMX3UUK62KABR"],
                    ].map(([name, addr]) => (
                      <tr key={addr} className="hover:bg-slate-900/30">
                        <td className="px-4 py-2 font-sans text-slate-200 whitespace-nowrap">{name}</td>
                        <td className="px-4 py-2"><a href={`https://stellar.expert/explorer/testnet/contract/${addr}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 whitespace-nowrap">{addr.slice(0, 8)}…{addr.slice(-6)} ↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04]">
              <h4 className="font-bold text-white mb-2">{t("docs_verify")}</h4>
              <p className="text-sm text-slate-400 mb-3">{t("docs_verify_desc")}</p>
              <div className="overflow-x-auto rounded-xl bg-slate-950 border border-slate-800 p-3"><pre className="text-xs font-mono text-emerald-400 whitespace-pre">bash contracts/real-verifier/scripts/e2e_testnet.sh</pre></div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl border border-slate-900 bg-slate-900/25">
              <h4 className="font-bold text-white mb-1">{t("docs_api")}</h4>
              <p className="text-xs text-slate-500 font-mono mb-3">base: https://confidia-api.fly.dev</p>
              <div className="overflow-x-auto rounded-xl border border-slate-900">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-900/80 text-[11px] uppercase text-slate-400"><tr><th className="px-4 py-2">Method</th><th className="px-4 py-2">Path</th><th className="px-4 py-2">Description</th></tr></thead>
                  <tbody className="divide-y divide-slate-800 text-xs">
                    {[
                      ["GET", "/status", "Health check"],
                      ["GET", "/confidia/contracts", "Deployed contract registry"],
                      ["POST", "/domains/register", "Register domain + LCP discovery"],
                      ["GET", "/domains", "List domains"],
                      ["GET", "/policies", "List policies"],
                      ["GET", "/transactions", "List transactions"],
                      ["POST", "/agents/payments/execute", "Agentic payment"],
                      ["POST", "/confidia/distributions", "Create Merkle distribution"],
                      ["POST", "/confidia/claims/submit", "Submit payout claim"],
                      ["GET", "/confidia/identity/keys", "List JWK keys"],
                      ["POST", "/confidia/identity/keys/:kid/revoke", "Revoke JWK key"],
                      ["GET", "/auth/challenge", "SEP-10 challenge"],
                      ["POST", "/auth/verify", "Verify SEP-10 + issue JWT"],
                    ].map(([m, p, d]) => (
                      <tr key={p} className="hover:bg-slate-900/30">
                        <td className="px-4 py-2 font-mono font-bold text-indigo-400 whitespace-nowrap">{m}</td>
                        <td className="px-4 py-2 font-mono text-slate-200 whitespace-nowrap">{p}</td>
                        <td className="px-4 py-2 text-slate-400 whitespace-nowrap">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl border border-slate-900 bg-slate-900/25">
              <h4 className="font-bold text-white mb-3">{t("docs_quickstart")}</h4>
              <div className="overflow-x-auto rounded-xl bg-slate-950 border border-slate-800 p-3">
                <pre className="text-xs font-mono text-slate-300 whitespace-pre">{`git clone https://github.com/Eras256/Confidia && cd Confidia
pnpm install
pnpm build:contracts     # wasm (MVP via -Z build-std)
pnpm deploy:contracts    # deploy + init on Stellar Testnet
pnpm test:contracts      # cargo test
pnpm dev                 # web :3000 · api :3001`}</pre>
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl border border-slate-900 bg-slate-900/25">
              <h4 className="font-bold text-white mb-3">{t("docs_standards")}</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {["SEP-10 Auth", "SEP-41 Tokens", "SEP-43 Wallets", "OIDC → ZK (Noir 1.0.0-beta.9 / UltraHonk)", "soroban-sdk 20 + 26", "BN254 pairing"].map((s) => (
                  <span key={s} className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">{s}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
