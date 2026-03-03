/**
 * txForwarder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Forwards the compliance-cleared deposit transaction to the PermissionedVault
 * on the Tenderly fork. The institution submits the tx intent to the CRE;
 * the CRE attaches the attestation and executes on-chain on their behalf.
 *
 * In production: the institution signs and submits the tx themselves with the
 * attestation attached. Here, the CRE acts as a relayer for demonstration.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from "ethers";
import type { SignedAttestation } from "./attestationSigner";

// Minimal ABI for PermissionedVault
const VAULT_ABI = [
  "function deposit(uint256 amount, tuple(address subject, bytes32 amlReportHash, uint256 expiry, uint256 nonce, string amlProvider) attestation, bytes signature) external",
  "function balanceOf(address account) view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
];

// Minimal ABI for ERC20 approve
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

export interface DepositResult {
  txHash:     string;
  blockNumber: number;
  gasUsed:    string;
  vaultBalance: string;
}

export class TxForwarder {
  private provider:      ethers.JsonRpcProvider;
  private vaultAddress:  string;
  private assetAddress:  string;

  constructor(rpcUrl: string, vaultAddress: string, assetAddress: string) {
    this.provider     = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true,
      polling: false,
    });
    this.vaultAddress = vaultAddress;
    this.assetAddress = assetAddress;
  }

  /**
   * Execute a deposit on behalf of the institution.
   * Uses the institution's own signer (passed in) — CRE never holds user funds.
   */
  async executeDeposit(
    institutionSigner: ethers.Wallet,
    amount:            bigint,
    signedAttestation: SignedAttestation
  ): Promise<DepositResult> {
    const signer    = institutionSigner.connect(this.provider);
    const vault     = new ethers.Contract(this.vaultAddress, VAULT_ABI, signer);
    const asset     = new ethers.Contract(this.assetAddress, ERC20_ABI, signer);

    // 1. Approve vault to pull tokens (if not already approved)
    const currentAllowance = await asset.allowance(signer.address, this.vaultAddress);
    if (currentAllowance < amount) {
      console.log(`   📝 Approving vault to spend ${ethers.formatUnits(amount, 6)} USDC...`);
      const approveTx = await asset.approve(this.vaultAddress, amount);
      await approveTx.wait();
      console.log(`   ✅ Approval confirmed`);
    }

    // 2. Build attestation tuple for the contract call
    const att = signedAttestation.attestation;
    const attestationTuple = {
      subject:       att.subject,
      amlReportHash: att.amlReportHash,
      expiry:        att.expiry,
      nonce:         att.nonce,
      amlProvider:   att.amlProvider,
    };

    // 3. Execute deposit
    console.log(`   🔄 Executing deposit of ${ethers.formatUnits(amount, 6)} USDC to vault...`);
    const tx     = await vault.deposit(amount, attestationTuple, signedAttestation.signature);
    const receipt = await tx.wait();

    const vaultBalance = await vault.balanceOf(signer.address);

    return {
      txHash:       receipt.hash,
      blockNumber:  receipt.blockNumber,
      gasUsed:      receipt.gasUsed.toString(),
      vaultBalance: ethers.formatUnits(vaultBalance, 6),
    };
  }

  /**
   * Get current vault stats for the frontend dashboard.
   */
  async getVaultStats(userAddress?: string): Promise<{
    totalDeposits: string;
    userBalance:   string;
  }> {
    const vault = new ethers.Contract(this.vaultAddress, VAULT_ABI, this.provider);
    const total = await vault.totalDeposits();
    const userBal = userAddress ? await vault.balanceOf(userAddress) : 0n;

    return {
      totalDeposits: ethers.formatUnits(total, 6),
      userBalance:   ethers.formatUnits(userBal, 6),
    };
  }
}
