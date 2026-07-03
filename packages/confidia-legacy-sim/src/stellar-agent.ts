// Orchestrator for the legacy /agents/payments/execute demo endpoint. The LCP
// discovery/hash-check step (via confidia-sdk's real LcpClient) is genuine;
// everything downstream — ZK proof generation and the "confidential" or
// "standard" token transfer — is simulated (see zk.ts/confidential.ts in this
// same package). The real, on-chain payment flow used by the live dashboard
// (Confidential Treasury, Claim Portal) does not go through this class at
// all — it calls sendPayment()/writeContract() directly. This whole package
// is private and never published; the real confidia-sdk package does not
// export this class.
import { LcpClient, AgreementRecord, PolicyEngine, PolicyRules } from "confidia-sdk";
import { ZkClient } from "./zk.js";
import { ConfidentialTokenClient } from "./confidential.js";
import { CONFIDIA_ASSETS } from "confidia-config";
import * as crypto from "crypto";


export interface PaymentReceipt {
  success: boolean;
  txHash: string;
  tokenType: "standard" | "confidential";
  agreementRecord: AgreementRecord;
  proofsGenerated: string[];
  message: string;
}

export class StellarAgentClient {
  private lcpClient: LcpClient;
  private policyEngine: PolicyEngine;
  private zkClient: ZkClient;
  private confidentialTokenClient: ConfidentialTokenClient;

  constructor() {
    this.lcpClient = new LcpClient();
    this.policyEngine = new PolicyEngine();
    this.zkClient = new ZkClient();
    this.confidentialTokenClient = new ConfidentialTokenClient();
  }

  /**
   * Orchestrates a legal-context-aware agentic payment.
   */
  public async executePayment(params: {
    agentId: string;
    agentPrivateKey: string;
    targetDomain: string;
    amount: number;
    assetCode: string;
    policyRules: PolicyRules;
    userKYCState: {
      jurisdiction: string;
      isAccredited: boolean;
      userBalance: number;
    };
  }): Promise<PaymentReceipt> {
    // Step 1: LCP Discovery
    const lcp = await this.lcpClient.fetchLegalContext(params.targetDomain);
    const validLcp = this.lcpClient.validateLegalContext(lcp);
    if (!validLcp) {
      throw new Error(`Invalid LCP discovery file found at ${params.targetDomain}`);
    }

    // Fetch terms document and assert hash integrity
    const terms = await this.lcpClient.fetchTermsDocument(lcp.terms);
    const hashMatch = this.lcpClient.verifyAtrHash(terms, lcp.atrHash);
    if (!hashMatch) {
      throw new Error("LCP Terms integrity check failed: SHA-256 hash mismatch.");
    }

    // Step 2: Create Agreement Record
    const agreement = await this.lcpClient.createAgreementRecord(
      params.agentId,
      params.targetDomain,
      lcp.atrHash,
      params.agentPrivateKey
    );

    // Step 3: Evaluate Policies
    const evaluation = this.policyEngine.evaluate(
      {
        amount: params.amount,
        assetCode: params.assetCode,
        jurisdiction: params.userKYCState.jurisdiction,
        isAccredited: params.userKYCState.isAccredited
      },
      params.policyRules
    );

    if (!evaluation.allowed) {
      throw new Error(`Compliance Policy Rejection: ${evaluation.reasons.join(" | ")}`);
    }

    // Step 4: ZK Proof Generation
    const proofsGenerated: string[] = [];
    let activeProof = "";
    let activePublicInputs: string[] = [];

    for (const proofName of evaluation.requiredProofs) {
      let inputs: Record<string, any> = {};

      if (proofName === "zkBalance") {
        inputs = {
          balance: params.userKYCState.userBalance,
          transferAmount: params.amount,
          commitment: this.confidentialTokenClient.generateCommitment(params.userKYCState.userBalance, "randomness_salt"),
          transferAmountCommitment: this.confidentialTokenClient.generateCommitment(params.amount, "randomness_salt"),
          randomness: "randomness_salt"
        };
      } else if (proofName === "zkExposure") {
        inputs = {
          currentDailyVolume: 1000, // Simulated daily volume
          transferAmount: params.amount,
          limit: params.policyRules.maxStandardAmount * 2,
          currentDailyVolumeCommitment: this.confidentialTokenClient.generateCommitment(1000, "volume_salt"),
          randomness: "volume_salt"
        };
      } else if (proofName === "zkEligibility") {
        inputs = {
          userJurisdiction: params.userKYCState.jurisdiction,
          userAccreditedStatus: params.userKYCState.isAccredited ? "accredited" : "non-accredited",
          lcpJurisdictionHash: lcp.jurisdiction || "MX",
          accreditedStatusRequired: "accredited",
          userSignature: "user_ecdsa_sig"
        };
      }

      const proofObj = await this.zkClient.ultrahonk.generateProof(proofName, inputs);
      proofsGenerated.push(proofName);

      // Use the primary proof for the execution payload
      if (proofName === "zkBalance") {
        activeProof = proofObj.proof;
        activePublicInputs = proofObj.publicInputs;
      }
    }

    // Step 5: Execute On-chain Transfer (Simulated Soroban Gateway logic)
    let txHash = "";
    const asset = CONFIDIA_ASSETS[params.assetCode];

    if (evaluation.tokenType === "confidential") {
      // Execute confidential wrapper transfer
      const transferRes = await this.confidentialTokenClient.confidentialTransfer(
        params.agentId,
        params.targetDomain, // recipient endpoint
        params.amount,
        params.assetCode,
        activeProof || "0xvalidproofbytes",
        activePublicInputs
      );
      txHash = transferRes.txHash;
    } else {
      // Standard SEP-41 Token Transfer simulation
      txHash = "tx_standard_transfer_" + crypto.randomBytes(8).toString("hex");
    }

    return {
      success: true,
      txHash,
      tokenType: evaluation.tokenType,
      agreementRecord: agreement,
      proofsGenerated,
      message: `Transaction processed successfully with ${evaluation.tokenType} standard. LCP accepted.`
    };
  }
}
