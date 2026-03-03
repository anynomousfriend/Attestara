/**
 * timeTravelService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Feature 2: Time-Travel Compliance Auditing
 *
 * Creates an ephemeral Tenderly fork pinned to the block of a historical
 * deposit and re-queries on-chain state (DID, nonce, vault balance) at that
 * point in time, then compares it with the current state.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from "axios";
import { ethers } from "ethers";

export interface TimeTravelSnapshot {
  blockNumber:   number;
  didRegistered: boolean;
  didString:     string | null;
  vaultBalance:  string;
  nonceConsumed: boolean;
  amlStatus?:    string;
}

export interface AuditComparison {
  txHash:      string;
  blockNumber: number;
  subject:     string;
  atDeposit:   TimeTravelSnapshot;
  now:         TimeTravelSnapshot;
  warnings:    string[];
}

// Minimal ABIs for read-only historical queries
const DID_ABI = [
  "function resolve(address owner) view returns (tuple(string did, bytes32 documentHash, string serviceEndpoint, uint256 registeredAt, uint256 updatedAt, bool active))",
  "function isRegistered(address owner) view returns (bool)",
];

const VAULT_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

const VERIFIER_ABI = [
  "function usedNonces(address subject, uint256 nonce) view returns (bool)",
];

export class TimeTravelService {
  private apiKey:      string;
  private account:     string;
  private project:     string;
  private currentRpc:  string;
  private didAddr:     string;
  private vaultAddr:   string;
  private verifierAddr: string;

  constructor(opts: {
    apiKey:       string;
    account:      string;
    project:      string;
    currentRpc:   string;
    didAddr:      string;
    vaultAddr:    string;
    verifierAddr: string;
  }) {
    this.apiKey       = opts.apiKey;
    this.account      = opts.account;
    this.project      = opts.project;
    this.currentRpc   = opts.currentRpc;
    this.didAddr      = opts.didAddr;
    this.vaultAddr    = opts.vaultAddr;
    this.verifierAddr = opts.verifierAddr;
  }

  /**
   * Audit a historical deposit.
   * @param txHash  The on-chain transaction hash of the deposit
   * @param subject The depositor address
   * @param nonce   The attestation nonce used in that deposit
   */
  async audit(
    txHash:  string,
    subject: string,
    nonce:   string,
  ): Promise<AuditComparison> {
    // 1. Fetch the block number from the current (live) fork RPC
    const currentProvider = new ethers.JsonRpcProvider(this.currentRpc, undefined, {
      staticNetwork: true, polling: false,
    });

    let blockNumber: number;
    try {
      const receipt = await currentProvider.getTransactionReceipt(txHash);
      blockNumber   = receipt?.blockNumber ?? 0;
    } catch {
      blockNumber = 0;
    }

    // 2. Create an ephemeral Tenderly fork pinned to that block
    let historicalRpc: string | null = null;
    let ephemeralForkId: string | null = null;

    if (blockNumber > 0) {
      try {
        const fork = await this._createEphemeralFork(blockNumber);
        historicalRpc   = fork.rpc;
        ephemeralForkId = fork.id;
      } catch (err: any) {
        console.warn("⚠️  Could not create historical fork:", err.message);
      }
    }

    // 3. Query historical state (or current if fork failed)
    const historicalProvider = historicalRpc
      ? new ethers.JsonRpcProvider(historicalRpc, undefined, { staticNetwork: true, polling: false })
      : currentProvider;

    const atDeposit = await this._queryState(historicalProvider, subject, nonce);

    // 4. Query current state
    const nowState = await this._queryState(currentProvider, subject, nonce);

    // 5. Tear down the ephemeral fork
    if (ephemeralForkId) {
      this._deleteEphemeralFork(ephemeralForkId).catch(() => {});
    }

    // 6. Build warnings for interesting diffs
    const warnings: string[] = [];
    if (atDeposit.didRegistered && !nowState.didRegistered) {
      warnings.push("DID was registered at deposit time but is now deactivated");
    }
    if (atDeposit.didRegistered && !nowState.nonceConsumed) {
      warnings.push("Nonce does not appear consumed — deposit may not have succeeded on-chain");
    }
    if (atDeposit.vaultBalance !== nowState.vaultBalance) {
      warnings.push(`Vault balance changed: ${atDeposit.vaultBalance} → ${nowState.vaultBalance} USDC`);
    }

    return {
      txHash,
      blockNumber,
      subject,
      atDeposit: { ...atDeposit, blockNumber },
      now:       { ...nowState, blockNumber: -1 /* current */ },
      warnings,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async _queryState(
    provider: ethers.JsonRpcProvider,
    subject:  string,
    nonce:    string,
  ): Promise<TimeTravelSnapshot> {
    const didContract      = new ethers.Contract(this.didAddr,      DID_ABI,      provider);
    const vaultContract    = new ethers.Contract(this.vaultAddr,    VAULT_ABI,    provider);
    const verifierContract = new ethers.Contract(this.verifierAddr, VERIFIER_ABI, provider);

    const [didRegistered, didDoc, vaultBal, nonceConsumed] = await Promise.allSettled([
      didContract.isRegistered(subject),
      didContract.resolve(subject),
      vaultContract.balanceOf(subject),
      verifierContract.usedNonces(subject, BigInt(nonce)),
    ]);

    const registered = didRegistered.status === "fulfilled" ? Boolean(didRegistered.value) : false;
    const didStr     = didDoc.status === "fulfilled" ? (didDoc.value?.did ?? null) : null;
    const balance    = vaultBal.status === "fulfilled"
      ? ethers.formatUnits(vaultBal.value as bigint, 6)
      : "0";
    const consumed   = nonceConsumed.status === "fulfilled" ? Boolean(nonceConsumed.value) : false;

    return {
      blockNumber:   0, // filled by caller
      didRegistered: registered,
      didString:     didStr,
      vaultBalance:  balance,
      nonceConsumed: consumed,
    };
  }

  private async _createEphemeralFork(blockNumber: number): Promise<{ id: string; rpc: string }> {
    const url = `https://api.tenderly.co/api/v1/account/${this.account}/project/${this.project}/vnets`;
    const resp = await axios.post(
      url,
      {
        slug:         `audit-fork-${blockNumber}-${Date.now()}`,
        display_name: `Audit Fork @ Block ${blockNumber}`,
        fork_config: {
          network_id:   1,
          block_number: blockNumber,
        },
        virtual_network_config: {
          chain_config: { chain_id: 1 },
        },
        sync_state_config: { enabled: false },
      },
      {
        headers: {
          "X-Access-Key": this.apiKey,
          "Content-Type":  "application/json",
        },
      },
    );

    const vnet  = resp.data;
    const id    = vnet.id;
    const rpc   = vnet.rpcs?.find((r: any) => r.name === "Admin RPC")?.url
               ?? vnet.rpcs?.[0]?.url;

    return { id, rpc };
  }

  private async _deleteEphemeralFork(forkId: string): Promise<void> {
    await axios.delete(
      `https://api.tenderly.co/api/v1/account/${this.account}/project/${this.project}/vnets/${forkId}`,
      {
        headers: { "X-Access-Key": this.apiKey },
      },
    ).catch(() => {});
  }
}
