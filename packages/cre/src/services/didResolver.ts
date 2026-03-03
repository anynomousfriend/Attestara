/**
 * didResolver.ts
 * Resolves a DID document from the on-chain DIDRegistry contract.
 */

import { ethers } from "ethers";

// Minimal ABI — only the functions we need
const DID_REGISTRY_ABI = [
  "function resolve(address owner) view returns (tuple(string did, bytes32 documentHash, string serviceEndpoint, uint256 registeredAt, uint256 updatedAt, bool active))",
  "function isRegistered(address owner) view returns (bool)",
];

export interface DIDDocument {
  did:             string;
  documentHash:    string;
  serviceEndpoint: string;
  registeredAt:    bigint;
  updatedAt:       bigint;
  active:          boolean;
}

export class DIDResolver {
  private contract: ethers.Contract;

  constructor(registryAddress: string, provider: ethers.Provider) {
    this.contract = new ethers.Contract(registryAddress, DID_REGISTRY_ABI, provider);
  }

  async resolve(address: string): Promise<DIDDocument | null> {
    const isRegistered = await this.contract.isRegistered(address);
    if (!isRegistered) return null;

    const doc = await this.contract.resolve(address);
    return {
      did:             doc.did,
      documentHash:    doc.documentHash,
      serviceEndpoint: doc.serviceEndpoint,
      registeredAt:    doc.registeredAt,
      updatedAt:       doc.updatedAt,
      active:          doc.active,
    };
  }

  async isRegistered(address: string): Promise<boolean> {
    return this.contract.isRegistered(address);
  }
}
