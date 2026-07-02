import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const DB_FILE = "c:/DaAps/Confidia/db.json";

export class MockSupabaseClient {
  public db!: {
    tenants: any[];
    distributions: any[];
    claims: any[];
    jwk_keys: any[];
    agents: any[];
    domains: any[];
    policies: any[];
    transactions: any[];
    agreements: any[];
    audit_logs: any[];
    assets: any[];
    confidential_wrappers: any[];
  };

  private loadDb() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        this.db = JSON.parse(data);
      } else {
        this.initializeDefaultDb();
        this.saveDb();
      }
    } catch (e) {
      this.initializeDefaultDb();
    }
  }

  private saveDb() {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save db.json", e);
    }
  }

  private initializeDefaultDb() {
    this.db = {
      tenants: [{ id: "tenant-1", name: "Confidia Institutional Dev" }],
      distributions: [],
      claims: [],
      jwk_keys: [],
      agents: [
        {
          id: "agent-1",
          tenant_id: "tenant-1",
          name: "Agent Gold",
          capabilities: ["standard", "confidential", "zkKYC"],
          bound_domains: ["treasury.example.mx"],
          keys: { publicKey: "GDX...AGENTKEYS" },
          status: "active"
        }
      ],
      domains: [
        {
          id: "domain-1",
          tenant_id: "tenant-1",
          url: "treasury.example.mx",
          lcp_json: {
            terms: "https://treasury.example.mx/terms.md",
            atrHash: "a47d2f93d8b5c90d8108c148a1d65d648fc92c0192e46b08e24dc1a64bc1ae82",
            termsFormat: "md",
            acceptanceRequired: true,
            jurisdiction: "MX",
            disputeResolution: "UNCITRAL",
            consentModel: "opt-in"
          },
          atr_hash: "a47d2f93d8b5c90d8108c148a1d65d648fc92c0192e46b08e24dc1a64bc1ae82",
          verified_at: new Date().toISOString(),
          status: "verified"
        }
      ],
      policies: [
        {
          id: "policy-1",
          tenant_id: "tenant-1",
          name: "Treasury Limits",
          rules: {
            maxStandardAmount: 5000,
            requireConfidential: true,
            requiredProofs: ["zkBalance", "zkEligibility"],
            allowedJurisdictions: ["MX", "US", "DE"]
          }
        }
      ],
      transactions: [],
      agreements: [],
      audit_logs: [],
      assets: [
        {
          id: "asset-usdc",
          tenant_id: "tenant-1",
          code: "USDC",
          issuer: "CDLZCBXGUA72NV2HG646N7423NZ6VXZF6VZ3D27K33K3EUP57WPAUSDC",
          type: "standard",
          contract_address: "CDLZCBXGUA72NV2HG646N7423NZ6VXZF6VZ3D27K33K3EUP57WPAUSDC"
        }
      ],
      confidential_wrappers: [
        {
          id: "wrapper-usdc",
          asset_id: "asset-usdc",
          contract_address: "CBZ2K3CONFIDENTIALUSDCWRAPPERADDRESS72VXZF6N7423NZ6VPA",
          auditor_key: "GAUDITORVIEWKEY549023849023482348902348",
          policy_config: { limit: 1000000 }
        }
      ]
    };
  }

  constructor() {
    this.loadDb();
  }

  public from(table: string) {
    this.loadDb();
    const list = (this.db as any)[table] || [];
    
    const insertFn = (record: any) => {
      this.loadDb();
      const currentList = (this.db as any)[table] || [];
      const newRecord = { id: record.id || `id-${Math.random().toString(36).substr(2, 9)}`, ...record, created_at: new Date().toISOString() };
      currentList.push(newRecord);
      (this.db as any)[table] = currentList;
      this.saveDb();
      const insertPromise = Promise.resolve({ data: newRecord, error: null });
      
      return Object.assign(insertPromise, {
        select: () => {
          const selectResPromise = Promise.resolve({ data: [newRecord], error: null });
          return Object.assign(selectResPromise, {
            single: () => Promise.resolve({ data: newRecord, error: null })
          });
        }
      });
    };

    const updateFn = (record: any) => {
      return {
        eq: (col: string, val: any) => {
          this.loadDb();
          const currentList = (this.db as any)[table] || [];
          const index = currentList.findIndex((item: any) => item[col] === val);
          if (index !== -1) {
            currentList[index] = { ...currentList[index], ...record };
            (this.db as any)[table] = currentList;
            this.saveDb();
          }
          return Promise.resolve({ data: currentList[index] || null, error: null });
        }
      };
    };

    const selectChain = Object.assign(Promise.resolve({ data: list, error: null }), {
      eq: (col: string, val: any) => {
        this.loadDb();
        const currentList = (this.db as any)[table] || [];
        const filtered = currentList.filter((item: any) => item[col] === val);
        const eqPromise = Promise.resolve({ data: filtered, error: null });
        return Object.assign(eqPromise, {
          single: () => Promise.resolve({ data: filtered[0] || null, error: null })
        });
      }
    });

    return {
      select: () => selectChain,
      insert: insertFn,
      update: updateFn
    };
  }

}

export class MockSorobanRpc {
  private ledgerState: Map<string, any> = new Map();

  constructor() {
    // Initial balances (Commitments)
    this.ledgerState.set("CBZ2K3CONFIDENTIALUSDCWRAPPERADDRESS72VXZF6N7423NZ6VPA_balances", {
      "agent-1": "commitment_balance_10000_usd"
    });
  }

  public async callContract(contractId: string, functionName: string, args: any[]): Promise<any> {
    if (contractId.includes("WRAPPER") || contractId.includes("GATEWAY")) {
      switch (functionName) {
        case "deposit":
          return { status: "success", txHash: "tx_mock_deposit_" + Math.random().toString(16).substr(2, 8) };
        case "confidential_transfer":
          const [from, to, proof, publicInputs] = args;
          // In a mock, we verify proof strings
          if (proof && proof.includes("invalid")) {
            throw new Error("ContractInvocationError: ZK Proof Verification Failed");
          }
          return { status: "success", txHash: "tx_mock_transfer_" + Math.random().toString(16).substr(2, 8) };
        case "withdraw":
          return { status: "success", txHash: "tx_mock_withdraw_" + Math.random().toString(16).substr(2, 8) };
        case "verify_proof":
          return args[0]?.includes("valid") ?? true;
        default:
          return { status: "success" };
      }
    }
    return { status: "success" };
  }
}

export class MockLcpServer {
  private static domains: Record<string, { lcp: any; terms: string }> = {
    "treasury.example.mx": {
      lcp: {
        terms: "https://treasury.example.mx/terms.md",
        atrHash: "a47d2f93d8b5c90d8108c148a1d65d648fc92c0192e46b08e24dc1a64bc1ae82",
        termsFormat: "md",
        acceptanceRequired: true,
        jurisdiction: "MX",
        disputeResolution: "UNCITRAL",
        consentModel: "opt-in"
      },
      terms: "# Example Treasury Agreement Terms\n\n1. All transactions governed by UNCITRAL rules in jurisdiction MX.\n2. Agents must verify identities via zkKYC."
    },
    "issuer.example.com": {
      lcp: {
        terms: "https://issuer.example.com/legal.md",
        atrHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        termsFormat: "md",
        acceptanceRequired: false,
        jurisdiction: "US-DE",
        disputeResolution: "AAA",
        consentModel: "opt-in"
      },
      terms: "# General Issuer Agreement\n\nUS-DE jurisdiction terms."
    }
  };

  public static async fetchLcp(url: string): Promise<any> {
    const domain = url.replace("https://", "").split("/")[0];
    const data = this.domains[domain];
    if (!data) throw new Error("404: Domain Not Registered");
    if (url.endsWith(".well-known/legal-context.json")) {
      const normalized = data.terms.replace(/\r\n/g, "\n");
      const computedHash = crypto.createHash("sha256").update(normalized).digest("hex");
      return {
        ...data.lcp,
        atrHash: computedHash
      };
    }
    if (url.includes("terms.md") || url.includes("legal.md")) {
      return data.terms;
    }
    throw new Error("404: Not Found");
  }
}
