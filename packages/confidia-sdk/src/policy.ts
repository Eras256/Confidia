export interface PolicyRules {
  maxStandardAmount: number;
  requireConfidential: boolean;
  requiredProofs: string[];
  allowedJurisdictions: string[];
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  tokenType: "standard" | "confidential";
  requiredProofs: string[];
  reasons: string[];
}

export class PolicyEngine {
  /**
   * Evaluates if a transaction satisfies global policy rules and determines ZK requirements.
   */
  public evaluate(
    transaction: {
      amount: number;
      assetCode: string;
      jurisdiction?: string;
      isAccredited?: boolean;
    },
    policy: PolicyRules
  ): PolicyEvaluationResult {
    const reasons: string[] = [];
    let allowed = true;
    let tokenType: "standard" | "confidential" = "standard";
    const requiredProofs: string[] = [...policy.requiredProofs];

    // Check jurisdiction constraints
    if (transaction.jurisdiction && policy.allowedJurisdictions.length > 0) {
      if (!policy.allowedJurisdictions.includes(transaction.jurisdiction)) {
        allowed = false;
        reasons.push(`Jurisdiction ${transaction.jurisdiction} is not authorized by the compliance policy.`);
      }
    }

    // Determine standard vs confidential token selection
    if (policy.requireConfidential || transaction.amount > policy.maxStandardAmount) {
      tokenType = "confidential";
      reasons.push(`Transaction amount ${transaction.amount} exceeds public threshold ${policy.maxStandardAmount} or privacy is explicitly mandated.`);
    }

    // Accumulate required ZK proofs based on transaction parameters
    if (tokenType === "confidential") {
      if (!requiredProofs.includes("zkBalance")) {
        requiredProofs.push("zkBalance");
      }
      if (transaction.amount > policy.maxStandardAmount * 2 && !requiredProofs.includes("zkExposure")) {
        requiredProofs.push("zkExposure");
      }
    }

    // Add zkEligibility if accreditation or compliance checks are required
    if (policy.requiredProofs.includes("zkEligibility") && !transaction.isAccredited) {
      allowed = false;
      reasons.push("ZK accreditation eligibility proof is required but account eligibility state is false.");
    }

    return {
      allowed,
      tokenType,
      requiredProofs,
      reasons
    };
  }
}
