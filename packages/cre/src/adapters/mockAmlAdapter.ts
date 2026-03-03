/**
 * mockAmlAdapter.ts
 * Calls the local Mock AML server (Chainalysis-style).
 */

import axios from "axios";

export interface AMLScreeningResult {
  status:    "CLEARED" | "BLOCKED" | "HIGH_RISK";
  riskScore: number;
  alerts:    string[];
  provider:  string;
  checkedAt: string;
  reportHash: string; // keccak256-style hash of the full response for on-chain commitment
}

export class MockAMLAdapter {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:4001") {
    this.baseUrl = baseUrl;
  }

  async screenAddress(address: string, amount?: number): Promise<AMLScreeningResult> {
    const params = amount ? { amount } : {};
    const res = await axios.get(`${this.baseUrl}/v1/address/${address}/risk`, { params });

    const data = res.data;

    // Build a deterministic report string and hash it for on-chain commitment
    const reportString = JSON.stringify({
      address,
      status:    data.status,
      riskScore: data.riskScore,
      alerts:    data.alerts,
      checkedAt: data.checkedAt,
      provider:  "mock-aml",
    });

    const { ethers } = await import("ethers");
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes(reportString));

    return {
      status:    data.status,
      riskScore: data.riskScore,
      alerts:    data.alerts,
      provider:  "mock-aml",
      checkedAt: data.checkedAt,
      reportHash,
    };
  }

  get providerName(): string {
    return "mock-aml";
  }
}
