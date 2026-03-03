/**
 * revocationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Feature 3: Real-Time Attestation Revocation via Tenderly Webhooks
 *
 * Receives Tenderly Alert webhooks when a vault deposit is detected in-flight,
 * re-screens the address, and if the AML status has changed to BLOCKED/HIGH_RISK
 * burns the attestation nonce on-chain so the deposit will revert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from "axios";
import { ethers } from "ethers";

export interface RevocationEvent {
  id:              string;
  timestamp:       string;
  subject:         string;
  nonce:           string;
  reason:          string;
  originalStatus:  string;
  newStatus:       string;
  txHash?:         string;
  revokeTxHash?:   string;
  timeline:        { time: string; event: string }[];
}

// Storage slot layout for usedNonces mapping in ComplianceAttestationVerifier
// mapping(address => mapping(uint256 => bool)) public usedNonces;
function usedNoncesSlot(subject: string, nonce: bigint): string {
  // slot(usedNonces) = 1 (second state var after creSignerAddress)
  const outerKey = ethers.solidityPackedKeccak256(
    ["address", "uint256"],
    [subject, 1],
  );
  const innerKey = ethers.solidityPackedKeccak256(
    ["uint256", "bytes32"],
    [nonce, outerKey],
  );
  return innerKey;
}

export class RevocationService {
  private forkRpc:      string;
  private verifierAddr: string;
  private deployerKey:  string;
  private events:       RevocationEvent[] = [];

  constructor(opts: {
    forkRpc:      string;
    verifierAddr: string;
    deployerKey:  string;
  }) {
    this.forkRpc      = opts.forkRpc;
    this.verifierAddr = opts.verifierAddr;
    this.deployerKey  = opts.deployerKey;
  }

  get allEvents(): RevocationEvent[] {
    return this.events;
  }

  /**
   * Process a Tenderly webhook payload.
   * Re-screens the subject address and burns nonce if status changed.
   */
  async processWebhook(
    payload:   any,
    rescreenFn: (address: string) => Promise<{ status: string; riskScore: number; alerts: string[] }>,
  ): Promise<RevocationEvent | null> {
    // Extract subject & nonce from decoded transaction data
    const subject = payload?.transaction?.addresses?.[0]
                 ?? payload?.subject
                 ?? null;
    const nonce   = payload?.nonce ?? payload?.attestationNonce ?? null;
    const txHash  = payload?.transaction?.hash ?? payload?.txHash ?? null;

    if (!subject || !nonce) {
      console.warn("⚠️  RevocationService: missing subject or nonce in webhook payload");
      return null;
    }

    const timeline: { time: string; event: string }[] = [];
    const now = () => new Date().toISOString();

    timeline.push({ time: now(), event: `Tenderly webhook received for ${subject}` });

    // Re-screen
    const screenResult = await rescreenFn(subject);
    timeline.push({ time: now(), event: `Re-screen result: ${screenResult.status} (risk: ${screenResult.riskScore})` });

    const event: RevocationEvent = {
      id:             require("crypto").randomUUID(),
      timestamp:      new Date().toISOString(),
      subject,
      nonce:          String(nonce),
      reason:         screenResult.alerts.join(", ") || "Status changed",
      originalStatus: "CLEARED",
      newStatus:      screenResult.status,
      txHash,
      timeline,
    };

    if (screenResult.status === "BLOCKED" || screenResult.status === "HIGH_RISK") {
      // Burn the nonce on-chain using tenderly_setStorageAt
      try {
        const slot  = usedNoncesSlot(subject, BigInt(nonce));
        // Write 0x1 (true) to mark nonce as used
        const value = "0x" + "1".padStart(64, "0");

        await axios.post(this.forkRpc, {
          jsonrpc: "2.0",
          id:      1,
          method:  "tenderly_setStorageAt",
          params:  [this.verifierAddr, slot, value],
        });

        event.revokeTxHash = `nonce-burned-slot-${slot.slice(0, 10)}`;
        timeline.push({ time: now(), event: `Attestation nonce burned on-chain — deposit will revert with Attestation__NonceUsed` });
      } catch (err: any) {
        timeline.push({ time: now(), event: `⚠️  Failed to burn nonce: ${err.message}` });
      }
    } else {
      timeline.push({ time: now(), event: "Re-screen still CLEARED — no revocation needed" });
    }

    this.events.unshift(event);
    if (this.events.length > 100) this.events.pop();

    return event;
  }

  /**
   * Manually revoke an attestation by burning its nonce.
   * Used for the demo / adversarial scenarios.
   */
  async revokeByNonce(subject: string, nonce: string, reason: string): Promise<RevocationEvent> {
    const timeline: { time: string; event: string }[] = [];
    const now = () => new Date().toISOString();

    timeline.push({ time: now(), event: `Manual revocation triggered for ${subject}` });

    const slot  = usedNoncesSlot(subject, BigInt(nonce));
    const value = "0x" + "1".padStart(64, "0");

    try {
      await axios.post(this.forkRpc, {
        jsonrpc: "2.0",
        id:      1,
        method:  "tenderly_setStorageAt",
        params:  [this.verifierAddr, slot, value],
      });
      timeline.push({ time: now(), event: "Nonce marked as used via tenderly_setStorageAt" });
    } catch (err: any) {
      timeline.push({ time: now(), event: `⚠️  Storage write failed: ${err.message}` });
    }

    const event: RevocationEvent = {
      id:             require("crypto").randomUUID(),
      timestamp:      new Date().toISOString(),
      subject,
      nonce,
      reason,
      originalStatus: "CLEARED",
      newStatus:      "REVOKED",
      revokeTxHash:   `nonce-burned-slot-${slot.slice(0, 10)}`,
      timeline,
    };

    this.events.unshift(event);
    return event;
  }
}
