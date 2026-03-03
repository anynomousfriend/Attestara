/**
 * chainalysisAdapter.ts
 * Real Chainalysis KYT API adapter.
 * Requires CHAINALYSIS_API_KEY env var.
 * Drop in your key and this adapter becomes live — no other code changes needed.
 *
 * Chainalysis KYT API docs: https://docs.chainalysis.com/api/kyt/
 */

import axios, { AxiosInstance } from "axios";
import { ethers } from "ethers";
import type { AMLScreeningResult } from "./mockAmlAdapter";

const CHAINALYSIS_BASE_URL = "https://api.chainalysis.com";

export class ChainalysisAdapter {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("CHAINALYSIS_API_KEY is required for the real adapter");
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: CHAINALYSIS_BASE_URL,
      headers: {
        "Token": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 10_000,
    });
  }

  /**
   * Screen a wallet address via Chainalysis KYT.
   * Flow: register user → submit transfer → fetch alerts
   */
  async screenAddress(address: string, amount: number = 0): Promise<AMLScreeningResult> {
    // Step 1: Register user entity
    const userRes = await this.client.post("/api/kyt/v2/users", {
      address,
    });
    const userId = userRes.data.userId;

    // Step 2: Submit transfer for screening
    const transferRes = await this.client.post(`/api/kyt/v2/users/${userId}/transfers`, {
      network:    "ETHEREUM",
      asset:      "ETH",
      transferReference: `cre-screen-${Date.now()}`,
      direction:  "received",
      amount:     amount.toString(),
    });

    const transferId = transferRes.data.transferId;
    const alerts     = transferRes.data.alerts || [];

    // Step 3: Determine status from alerts
    let status: AMLScreeningResult["status"] = "CLEARED";
    let riskScore = 0;

    for (const alert of alerts) {
      if (alert.category === "sanctions" || alert.alertLevel === "HIGH") {
        status    = "BLOCKED";
        riskScore = 100;
        break;
      }
      if (alert.alertLevel === "MEDIUM") {
        status    = "HIGH_RISK";
        riskScore = Math.max(riskScore, 60);
      }
    }

    const checkedAt    = new Date().toISOString();
    const reportString = JSON.stringify({ address, userId, transferId, status, riskScore, alerts, checkedAt, provider: "chainalysis" });
    const reportHash   = ethers.keccak256(ethers.toUtf8Bytes(reportString));

    return {
      status,
      riskScore,
      alerts: alerts.map((a: any) => a.category || a.alertLevel || "UNKNOWN"),
      provider:   "chainalysis",
      checkedAt,
      reportHash,
    };
  }

  get providerName(): string {
    return "chainalysis";
  }
}
