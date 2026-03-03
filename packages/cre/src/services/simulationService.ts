/**
 * simulationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Feature 1: Tenderly Simulation Pre-Flight ("Dry Run")
 *
 * Before executing any deposit on-chain, this service sends the calldata to
 * Tenderly's Simulation API. If the simulation reverts, we surface a human-
 * readable reason to the institution before any gas is spent.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from "axios";
import { ethers } from "ethers";
import type { SignedAttestation } from "./attestationSigner";

export interface SimulationStateChange {
  slot:     string;
  original: string;
  dirty:    string;
  label?:   string;
}

export interface SimulationCallTrace {
  type:     string;
  from:     string;
  to:       string;
  gas:      number;
  gasUsed:  number;
  input:    string;
  output?:  string;
  calls?:   SimulationCallTrace[];
  error?:   string;
}

export interface SimulationResult {
  success:       boolean;
  gasUsed:       number;
  gasEstimateUsd?: string;
  revertReason?:   string;
  decodedRevert?:  string;
  logs:          { name: string; inputs: Record<string, string> }[];
  stateDiff:     SimulationStateChange[];
  callTrace?:    SimulationCallTrace;
  preview: {
    gasLabel:       string;
    stateChanges:   string[];
    events:         string[];
    errorSummary?:  string;
  };
}

// Minimal vault ABI for encoding calldata
const VAULT_IFACE = new ethers.Interface([
  "function deposit(uint256 amount, tuple(address subject, bytes32 amlReportHash, uint256 expiry, uint256 nonce, string amlProvider) attestation, bytes signature) external",
]);

export class SimulationService {
  private apiKey:      string;
  private account:     string;
  private project:     string;
  private forkId:      string;
  private vaultAddr:   string;
  private networkId:   number;

  constructor(opts: {
    apiKey:    string;
    account:   string;
    project:   string;
    forkId:    string;
    vaultAddr: string;
    networkId?: number;
  }) {
    this.apiKey    = opts.apiKey;
    this.account   = opts.account;
    this.project   = opts.project;
    this.forkId    = opts.forkId;
    this.vaultAddr = opts.vaultAddr;
    this.networkId = opts.networkId ?? 1;
  }

  /**
   * Simulate the vault.deposit() call without actually mining it.
   * Returns a detailed preview of what would happen.
   */
  async simulateDeposit(
    from:              string,
    amount:            bigint,
    signedAttestation: SignedAttestation,
  ): Promise<SimulationResult> {
    const att = signedAttestation.attestation;

    // Encode calldata exactly as TxForwarder would
    const calldata = VAULT_IFACE.encodeFunctionData("deposit", [
      amount,
      {
        subject:       att.subject,
        amlReportHash: att.amlReportHash,
        expiry:        att.expiry,
        nonce:         att.nonce,
        amlProvider:   att.amlProvider,
      },
      signedAttestation.signature,
    ]);

    const url = `https://api.tenderly.co/api/v1/account/${this.account}/project/${this.project}/simulate`;

    let tenderlyResp: any;
    try {
      const resp = await axios.post(
        url,
        {
          network_id:   String(this.networkId),
          from,
          to:           this.vaultAddr,
          input:        calldata,
          gas:          500_000,
          gas_price:    "0",
          value:        "0",
          save:         false,
          save_if_fails: false,
          simulation_type: "full",
          // Use virtual testnet (fork) state
          root: this.forkId,
        },
        {
          headers: {
            "X-Access-Key": this.apiKey,
            "Content-Type":  "application/json",
          },
        },
      );
      tenderlyResp = resp.data;
    } catch (err: any) {
      // Tenderly itself failed (network/auth), not a revert
      throw new Error(`Tenderly API error: ${err?.response?.data?.error?.message ?? err.message}`);
    }

    return this._parse(tenderlyResp, amount);
  }

  // ── Private parser ──────────────────────────────────────────────────────────
  private _parse(raw: any, amount: bigint): SimulationResult {
    const tx         = raw?.transaction;
    const txInfo     = tx?.transaction_info;
    const status     = tx?.status ?? false;
    const gasUsed    = Number(txInfo?.gas_used ?? tx?.gas_used ?? 0);

    // Decode revert
    let revertReason: string | undefined;
    let decodedRevert: string | undefined;
    if (!status) {
      revertReason   = txInfo?.error_message ?? "Transaction reverted";
      decodedRevert  = this._decodeRevert(txInfo?.return_value ?? "");
      if (!decodedRevert) decodedRevert = revertReason;
    }

    // Parse decoded events / logs
    const logs: SimulationResult["logs"] = [];
    const rawLogs = txInfo?.logs ?? [];
    for (const log of rawLogs) {
      const name   = log?.name ?? log?.raw?.address ?? "UnknownEvent";
      const inputs = log?.inputs?.reduce((acc: any, inp: any) => {
        acc[inp.name] = String(inp.value);
        return acc;
      }, {}) ?? {};
      logs.push({ name, inputs });
    }

    // Parse state diff
    const stateDiff: SimulationStateChange[] = [];
    const rawDiff = txInfo?.state_diff ?? [];
    for (const diff of rawDiff) {
      for (const storage of (diff?.storage_diff ?? [])) {
        stateDiff.push({
          slot:     storage.key,
          original: storage.original ?? "0x0",
          dirty:    storage.dirty    ?? "0x0",
        });
      }
    }

    // Rough gas → USD estimate (assume 30 gwei, ETH=$3000)
    const gasPriceGwei = 30;
    const ethCost      = (gasUsed * gasPriceGwei * 1e9) / 1e18;
    const usdCost      = (ethCost * 3000).toFixed(2);

    // Build human-readable preview
    const amountUsdc = ethers.formatUnits(amount, 6);
    const stateChanges: string[] = [];
    if (stateDiff.length > 0) {
      stateChanges.push(`${stateDiff.length} storage slot(s) would change`);
    }
    if (status) {
      stateChanges.push(`Vault balance increases by ${amountUsdc} USDC`);
    }

    const events = logs.map(l => `✅ ${l.name}`);

    const preview: SimulationResult["preview"] = {
      gasLabel:     `~${gasUsed.toLocaleString()} gas ($${usdCost})`,
      stateChanges,
      events:       status ? events : [],
      errorSummary: !status ? (decodedRevert ?? revertReason) : undefined,
    };

    return {
      success:        status,
      gasUsed,
      gasEstimateUsd: usdCost,
      revertReason,
      decodedRevert,
      logs,
      stateDiff,
      callTrace:      txInfo?.call_trace,
      preview,
    };
  }

  private _decodeRevert(returnData: string): string | undefined {
    if (!returnData || returnData === "0x") return undefined;
    // Standard Error(string) selector: 0x08c379a0
    if (returnData.startsWith("0x08c379a0")) {
      try {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ["string"],
          "0x" + returnData.slice(10),
        );
        return `Error: ${decoded[0]}`;
      } catch { /* fall through */ }
    }
    // Custom error — return the 4-byte selector name if known
    const known: Record<string, string> = {
      "0x8d7e7d64": "Vault__Paused()",
      "0x94ab04f7": "Vault__DIDNotRegistered(address)",
      "0x8fba1f30": "Attestation__Expired(uint256,uint256)",
      "0x2d4c3c49": "Attestation__NonceUsed(address,uint256)",
      "0x5abc4b24": "Attestation__InvalidSigner(address,address)",
      "0x3c507e99": "Attestation__SubjectMismatch(address,address)",
    };
    const selector = returnData.slice(0, 10).toLowerCase();
    return known[selector] ?? `CustomError(${selector})`;
  }
}
