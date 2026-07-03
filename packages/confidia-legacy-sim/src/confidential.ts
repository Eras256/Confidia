// Simulated confidential-token wrapper for the legacy
// /agents/payments/execute demo endpoint. This calls MockSorobanRpc (an
// in-memory fake, see confidia-test-utils) — no real Soroban contract, no
// real Pedersen commitments. Kept out of the published confidia-sdk package
// (this whole package is private, never published) so it can't be mistaken
// for a real, deployed confidential-transfer primitive, which does not exist
// in this build (see the notice in the Confidential Treasury tab).
import { CONFIDIA_ASSETS } from "confidia-config";
import { MockSorobanRpc } from "confidia-test-utils";
import * as crypto from "crypto";

export interface DisclosureRecord {
  transactionId: string;
  sender: string;
  recipient: string;
  amount: number;
  viewKeyUsed: string;
  disclosureReceiver: string;
  checksum: string;
  timestamp: string;
}

export class ConfidentialTokenClient {
  private rpc: MockSorobanRpc;

  constructor() {
    this.rpc = new MockSorobanRpc();
  }

  /**
   * Encrypts/commits balance value. In Pedersen, it's commitment = g^v * h^r.
   * We represent it as a cryptographically derived hash containing value and randomness.
   */
  public generateCommitment(value: number, randomness: string): string {
    return crypto
      .createHash("sha256")
      .update(`${value}:${randomness}`)
      .digest("hex");
  }

  /**
   * Deposits standard SEP-41 tokens into the confidential wrapper.
   */
  public async deposit(
    amount: number,
    assetCode: string,
    userPublicKey: string
  ): Promise<{ txHash: string; commitment: string }> {
    const asset = CONFIDIA_ASSETS[assetCode];
    if (!asset || !asset.wrapperAddress) {
      throw new Error(`Asset ${assetCode} does not have a registered confidential wrapper.`);
    }

    // Call Soroban contract wrapper
    const response = await this.rpc.callContract(asset.wrapperAddress, "deposit", [
      userPublicKey,
      amount
    ]);

    const randomness = crypto.randomBytes(16).toString("hex");
    const commitment = this.generateCommitment(amount, randomness);

    return {
      txHash: response.txHash,
      commitment
    };
  }

  /**
   * Transfers confidential balances by passing a ZK proof of balance and volume limits.
   */
  public async confidentialTransfer(
    from: string,
    to: string,
    amount: number,
    assetCode: string,
    zkProof: string,
    publicInputs: string[]
  ): Promise<{ txHash: string; senderCommitment: string; recipientCommitment: string }> {
    const asset = CONFIDIA_ASSETS[assetCode];
    if (!asset || !asset.wrapperAddress) {
      throw new Error(`Asset ${assetCode} does not have a registered confidential wrapper.`);
    }

    // Soroban contract call with proof verification
    const response = await this.rpc.callContract(asset.wrapperAddress, "confidential_transfer", [
      from,
      to,
      zkProof,
      publicInputs
    ]);

    const fromRandom = crypto.randomBytes(16).toString("hex");
    const toRandom = crypto.randomBytes(16).toString("hex");

    return {
      txHash: response.txHash,
      senderCommitment: this.generateCommitment(amount, fromRandom),
      recipientCommitment: this.generateCommitment(amount, toRandom)
    };
  }

  /**
   * Withdraws from confidential wrapper back to standard SEP-41.
   */
  public async withdraw(
    amount: number,
    assetCode: string,
    userPublicKey: string,
    balanceProof: string
  ): Promise<{ txHash: string }> {
    const asset = CONFIDIA_ASSETS[assetCode];
    if (!asset || !asset.wrapperAddress) {
      throw new Error(`Asset ${assetCode} does not have a registered confidential wrapper.`);
    }

    const response = await this.rpc.callContract(asset.wrapperAddress, "withdraw", [
      userPublicKey,
      amount,
      balanceProof
    ]);

    return {
      txHash: response.txHash
    };
  }

  /**
   * Decrypts balance commitment using view key.
   */
  public decryptBalance(commitment: string, viewKey: string): number {
    // In a mock, we derive the integer by querying a view-key lookup or decrypting
    // We simulate decryption logic by parsing the commitment parameters
    try {
      const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        crypto.createHash("sha256").update(viewKey).digest(),
        Buffer.alloc(16, 0)
      );
      let decrypted = decipher.update(commitment, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return Number(decrypted.split(":")[0]);
    } catch {
      // Fallback fallback: simulation yields value based on commitment numeric seed
      const sum = Array.from(commitment).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return (sum % 9900) + 100; // Mock balance between 100 and 10000
    }
  }

  /**
   * Creates a selective disclosure proof for a single transaction.
   */
  public async generateSelectiveDisclosure(
    transactionId: string,
    sender: string,
    recipient: string,
    amount: number,
    viewKey: string,
    disclosureReceiver: string
  ): Promise<DisclosureRecord> {
    const timestamp = new Date().toISOString();
    const hashPayload = `${transactionId}:${sender}:${recipient}:${amount}:${disclosureReceiver}:${timestamp}`;
    const checksum = crypto
      .createHmac("sha256", viewKey)
      .update(hashPayload)
      .digest("hex");

    return {
      transactionId,
      sender,
      recipient,
      amount,
      viewKeyUsed: crypto.createHash("sha256").update(viewKey).digest("hex").substring(0, 10),
      disclosureReceiver,
      checksum,
      timestamp
    };
  }

  /**
   * Verifies a selective disclosure claim.
   */
  public verifySelectiveDisclosure(
    record: DisclosureRecord,
    expectedAuditorHash: string
  ): boolean {
    const calculatedAuditorHash = crypto
      .createHash("sha256")
      .update(record.viewKeyUsed)
      .digest("hex")
      .substring(0, 10);

    // In real code we verify the signature or HMAC checksum
    return record.checksum.length > 0;
  }
}
