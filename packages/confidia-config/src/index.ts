export interface StellarNetworkConfig {
  name: string;
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
}

export const STELLAR_NETWORKS: Record<string, StellarNetworkConfig> = {
  local: {
    name: "local",
    passphrase: "Standalone Network ; OpenStellar Protocol 25",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    horizonUrl: "http://localhost:8000"
  },
  testnet: {
    name: "testnet",
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org"
  },
  mainnet: {
    name: "mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://soroban-rpc.mainnet.stellar.org",
    horizonUrl: "https://horizon.stellar.org"
  }
};

export interface AssetConfig {
  code: string;
  name: string;
  type: "standard" | "confidential";
  sep41Address: string;
  wrapperAddress?: string;
  decimals: number;
}

export const CONFIDIA_ASSETS: Record<string, AssetConfig> = {
  USDC: {
    code: "USDC",
    name: "USD Coin",
    type: "standard",
    sep41Address: "CDLZCBXGUA72NV2HG646N7423NZ6VXZF6VZ3D27K33K3EUP57WPAUSDC",
    wrapperAddress: "CBZ2K3CONFIDENTIALUSDCWRAPPERADDRESS72VXZF6N7423NZ6VPA",
    decimals: 7
  },
  MGUSD: {
    code: "MGUSD",
    name: "Meta Gold USD",
    type: "standard",
    sep41Address: "CDLMGUSDGUA72NV2HG646N7423NZ6VXZF6VZ3D27K33K3EUP57WPAMGUSD",
    wrapperAddress: "CBZ2K3CONFIDENTIALMGUSDWRAPPERADDRESS72VXZF6N7423NZ6VPA",
    decimals: 7
  },
  OpenUSD: {
    code: "OpenUSD",
    name: "Open Settlement USD",
    type: "standard",
    sep41Address: "CDLOPENUSDGUA72NV2HG646N7423NZ6VXZF6VZ3D27K33K3EUP57WPAOPEN",
    wrapperAddress: "CBZ2K3CONFIDENTIALOPENUSDWRAPPERADDRESS72VXZF6N7423NZ6V",
    decimals: 7
  },
  EURC: {
    code: "EURC",
    name: "Euro Coin",
    type: "standard",
    sep41Address: "CDLEURCGUA72NV2HG646N7423NZ6VXZF6VZ3D27K33K3EUP57WPAEURC",
    wrapperAddress: "CBZ2K3CONFIDENTIALEURCWRAPPERADDRESS72VXZF6N7423NZ6VPA",
    decimals: 7
  }
};

export interface ZkCircuitSchema {
  name: string;
  description: string;
  publicInputs: string[];
  privateInputs: string[];
}

export const ZK_CIRCUITS: Record<string, ZkCircuitSchema> = {
  zkBalance: {
    name: "zkBalance",
    description: "Proves that account balance is greater than or equal to the transfer amount without revealing balance",
    publicInputs: ["commitment", "transferAmountCommitment"],
    privateInputs: ["balance", "randomness", "transferAmount"]
  },
  zkExposure: {
    name: "zkExposure",
    description: "Proves that daily cumulative transacted volume does not exceed preset institutional limits",
    publicInputs: ["limit", "currentDailyVolumeCommitment"],
    privateInputs: ["currentDailyVolume", "transferAmount", "randomness"]
  },
  zkEligibility: {
    name: "zkEligibility",
    description: "Proves KYC/Jurisdiction/Accreditation credentials meet LCP criteria via selective disclosure ZK proof",
    publicInputs: ["lcpJurisdictionHash", "accreditedStatusRequired"],
    privateInputs: ["userJurisdiction", "userAccreditedStatus", "userSignature"]
  }
};

export interface LcpSpec {
  version: string;
  requiredFields: string[];
  recommendedFormats: string[];
}

export const LCP_SPEC: LcpSpec = {
  version: "1.0.0",
  requiredFields: ["terms", "atrHash"],
  recommendedFormats: ["md", "json", "txt"]
};

// SEP-10 WebAuth configuration
export interface Sep10Config {
  serverSigningKey: string;
  webAuthDomain: string;
  networkPassphrase: string;
  jwtExpiresInSeconds: number;
}

export const DEFAULT_SEP10_CONFIG: Sep10Config = {
  serverSigningKey: "", // Set via env — never hardcode
  webAuthDomain: "confidia.app",
  networkPassphrase: "Test SDF Network ; September 2015",
  jwtExpiresInSeconds: 3600
};
