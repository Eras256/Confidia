import * as crypto from "crypto";

export interface Recipient {
  email: string;
  amount: number;
  pin: string;
}

export function hashLeaf(recipient: Recipient): string {
  const content = `${recipient.email.toLowerCase().trim()}_${recipient.pin.trim()}_${recipient.amount}`;
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function buildMerkleTree(leaves: string[]): {
  root: string;
  getProof: (index: number) => string[];
} {
  if (leaves.length === 0) {
    return { root: "", getProof: () => [] };
  }

  let currentLayer = [...leaves];
  const tree: string[][] = [currentLayer];

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
      const combined = left < right ? left + right : right + left;
      const hash = crypto.createHash("sha256").update(combined).digest("hex");
      nextLayer.push(hash);
    }
    currentLayer = nextLayer;
    tree.push(currentLayer);
  }

  const root = currentLayer[0];

  const getProof = (index: number): string[] => {
    const proof: string[] = [];
    let layerIndex = index;
    for (let i = 0; i < tree.length - 1; i++) {
      const layer = tree[i];
      const isRight = layerIndex % 2 === 1;
      const siblingIndex = isRight ? layerIndex - 1 : layerIndex + 1;
      if (siblingIndex < layer.length) {
        proof.push(layer[siblingIndex]);
      } else {
        proof.push(layer[layerIndex]);
      }
      layerIndex = Math.floor(layerIndex / 2);
    }
    return proof;
  };

  return { root, getProof };
}

export function verifyMerkleProof(leaf: string, proof: string[], root: string): boolean {
  let current = leaf;
  for (const sibling of proof) {
    const combined = current < sibling ? current + sibling : sibling + current;
    current = crypto.createHash("sha256").update(combined).digest("hex");
  }
  return current === root;
}
