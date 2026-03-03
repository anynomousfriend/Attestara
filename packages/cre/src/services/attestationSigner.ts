/**
 * attestationSigner.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Produces EIP-712 signed ComplianceAttestation payloads.
 * The CRE holds the private key; the smart contract verifies the signature.
 *
 * This is the "ZK-style" privacy layer:
 *   - No PII leaves this service
 *   - Only a hash of the AML report is committed on-chain
 *   - The signature proves the CRE ran the check without revealing what it found
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface ComplianceAttestation {
  subject:       string;  // institution wallet address
  amlReportHash: string;  // bytes32 hex — keccak256 of AML report
  expiry:        bigint;  // unix timestamp
  nonce:         bigint;  // unique per attestation
  amlProvider:   string;  // "mock-aml" | "chainalysis"
}

export interface SignedAttestation {
  attestation: ComplianceAttestation;
  signature:   string;   // 65-byte hex EIP-712 signature
  signerAddress: string;
}

const KEY_FILE = path.resolve(process.cwd(), "../../.cre-signer.key");

export class AttestationSigner {
  private wallet: ethers.Wallet | ethers.HDNodeWallet;
  private domain: ethers.TypedDataDomain;

  constructor(verifierAddress: string, chainId: number, privateKey?: string) {
    // Load or generate the CRE signing key
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey);
    } else if (fs.existsSync(KEY_FILE)) {
      const savedKey = fs.readFileSync(KEY_FILE, "utf8").trim();
      this.wallet = new ethers.Wallet(savedKey);
      console.log(`🔑 CRE Signer loaded from file: ${this.wallet.address}`);
    } else {
      // Generate a fresh key and persist it
      this.wallet = ethers.Wallet.createRandom();
      fs.writeFileSync(KEY_FILE, this.wallet.privateKey, { mode: 0o600 });
      console.log(`🔑 CRE Signer generated and saved: ${this.wallet.address}`);
      console.log(`   Key file: ${KEY_FILE}`);
      console.log(`   ⚠️  Add CRE_SIGNER_ADDRESS=${this.wallet.address} to .env`);
      console.log(`   ⚠️  Re-deploy ComplianceAttestationVerifier with this address\n`);
    }

    // EIP-712 domain — must match the contract constructor args exactly
    this.domain = {
      name:              "ComplianceAttestationVerifier",
      version:           "1",
      chainId:           chainId,
      verifyingContract: verifierAddress,
    };
  }

  get signerAddress(): string {
    return this.wallet.address;
  }

  /**
   * Sign a ComplianceAttestation using EIP-712 typed data.
   */
  async sign(
    subject:       string,
    amlReportHash: string,
    amlProvider:   string,
    ttlSeconds:    number = 900  // 15 minutes default
  ): Promise<SignedAttestation> {
    const expiry = BigInt(Math.floor(Date.now() / 1000) + ttlSeconds);
    const nonce  = BigInt("0x" + crypto.randomBytes(16).toString("hex"));

    const attestation: ComplianceAttestation = {
      subject,
      amlReportHash,
      expiry,
      nonce,
      amlProvider,
    };

    // EIP-712 types — must match ATTESTATION_TYPEHASH in the contract
    const types = {
      ComplianceAttestation: [
        { name: "subject",       type: "address" },
        { name: "amlReportHash", type: "bytes32" },
        { name: "expiry",        type: "uint256" },
        { name: "nonce",         type: "uint256" },
        { name: "amlProvider",   type: "string"  },
      ],
    };

    const value = {
      subject:       attestation.subject,
      amlReportHash: attestation.amlReportHash,
      expiry:        attestation.expiry,
      nonce:         attestation.nonce,
      amlProvider:   attestation.amlProvider,
    };

    const signature = await this.wallet.signTypedData(this.domain, types, value);

    return {
      attestation,
      signature,
      signerAddress: this.wallet.address,
    };
  }
}
