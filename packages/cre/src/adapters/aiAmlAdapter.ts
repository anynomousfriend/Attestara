/**
 * aiAmlAdapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AI-Powered Compliance Oracle adapter.
 *
 * Flow:
 *   1. Fetch wallet transaction history from Etherscan (free API)
 *   2. Send tx summary to Google Gemini for AI risk analysis
 *   3. Return structured AMLScreeningResult + AI narrative
 *
 * Falls back to static mock rules if Etherscan/Gemini are unreachable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from "axios";
import { ethers } from "ethers";
import type { AMLScreeningResult } from "./mockAmlAdapter";

// Extended result type with AI narrative
export interface AIScreeningResult extends AMLScreeningResult {
    aiNarrative: string | null;
    txSummary: {
        totalTxs: number;
        uniqueCounterparties: number;
        activePeriod: string;
        protocols: string[];
    } | null;
}

// ── Known protocol addresses for labelling ──────────────────────────────────
const KNOWN_PROTOCOLS: Record<string, string> = {
    "0x7a250d5630b4cf539739df2c5dacab4c659f2488": "Uniswap V2 Router",
    "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap Universal Router",
    "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": "Aave V2 Lending Pool",
    "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": "Aave V3 Pool",
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": "SushiSwap Router",
    "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b": "Compound Comptroller",
    "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch V5 Router",
    "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange Proxy",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
    "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
};

// ── Mixer / sanctioned contract addresses for detection ─────────────────────
const SUSPICIOUS_ADDRESSES: Record<string, string> = {
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b": "Tornado Cash Router",
    "0x722122df12d4e14e13ac3b6895a86e84145b6967": "Tornado Cash 0.1 ETH",
    "0xdd4c48c0b24039969fc16d1cdf626eab821d3384": "Tornado Cash 1 ETH",
    "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3": "Tornado Cash 10 ETH",
    "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144": "Tornado Cash 100 ETH",
};

export class AIAMLAdapter {
    private etherscanKey: string;
    private geminiKey: string;
    private etherscanBase: string;

    constructor(etherscanKey: string, geminiKey: string) {
        if (!etherscanKey) throw new Error("ETHERSCAN_API_KEY is required for AI adapter");
        if (!geminiKey) throw new Error("GEMINI_API_KEY is required for AI adapter");
        this.etherscanKey = etherscanKey;
        this.geminiKey = geminiKey;
        this.etherscanBase = "https://api.etherscan.io/api";
    }

    async screenAddress(address: string, amount: number = 0): Promise<AIScreeningResult> {
        // ── Static rules first (for demo hint pills compatibility) ──────────────
        const staticResult = this._checkStaticRules(address, amount);
        if (staticResult) return staticResult;

        // ── Fetch tx history from Etherscan ────────────────────────────────────
        let txSummary: AIScreeningResult["txSummary"] = null;
        let etherscanData: any[] = [];

        try {
            etherscanData = await this._fetchTxHistory(address);
            txSummary = this._summarizeTxHistory(address, etherscanData);
        } catch (err: any) {
            console.warn("⚠️  Etherscan fetch failed (non-fatal):", err.message);
        }

        // ── Call Gemini for AI analysis ────────────────────────────────────────
        let aiResult: { status: string; riskScore: number; alerts: string[]; narrative: string } | null = null;

        try {
            aiResult = await this._callGemini(address, amount, txSummary, etherscanData);
        } catch (err: any) {
            console.warn("⚠️  Gemini AI analysis failed (non-fatal):", err.message);
            // Build a data-driven fallback instead of returning nulls
            aiResult = this._buildDataDrivenFallback(address, amount, txSummary);
        }

        // ── Build result ──────────────────────────────────────────────────────
        const status = (aiResult?.status as AMLScreeningResult["status"]) ?? "CLEARED";
        const riskScore = aiResult?.riskScore ?? Math.floor(Math.random() * 15);
        const alerts = aiResult?.alerts ?? [];
        const narrative = aiResult?.narrative ?? null;
        const checkedAt = new Date().toISOString();

        const reportString = JSON.stringify({
            address,
            status,
            riskScore,
            alerts,
            narrative,
            txSummary,
            checkedAt,
            provider: "ai-oracle",
        });
        const reportHash = ethers.keccak256(ethers.toUtf8Bytes(reportString));

        return {
            status,
            riskScore,
            alerts,
            provider: "ai-oracle",
            checkedAt,
            reportHash,
            aiNarrative: narrative,
            txSummary,
        };
    }

    get providerName(): string {
        return "ai-oracle";
    }

    // ── Private: Static Rules (backward compat with demo hint pills) ────────
    private _checkStaticRules(address: string, amount: number): AIScreeningResult | null {
        const addr = address.toLowerCase();
        const checkedAt = new Date().toISOString();

        let status: AMLScreeningResult["status"] | null = null;
        let riskScore = 0;
        let alerts: string[] = [];
        let narrative: string | null = null;

        // Rule 1: 0x000 → BLOCKED
        if (addr.startsWith("0x000")) {
            status = "BLOCKED";
            riskScore = 100;
            alerts = ["OFAC_SANCTIONS_MATCH", "HIGH_RISK_ENTITY"];
            narrative = "This address matches OFAC sanctions patterns. The address prefix 0x000 is flagged as a known sanctioned entity indicator. All transactions are blocked under compliance policy.";
        }
        // Rule 2: dead/beef → HIGH_RISK
        else if (addr.includes("dead") || addr.includes("beef")) {
            status = "HIGH_RISK";
            riskScore = 75;
            alerts = ["MIXER_INTERACTION", "DARKNET_MARKET_EXPOSURE"];
            narrative = "This address contains patterns associated with mixer services and darknet market exposure. The address signature suggests interaction with privacy-enhancing protocols that may obscure transaction origins.";
        }
        // Rule 3: Amount > 10M → HIGH_RISK
        else if (amount > 10_000_000) {
            status = "HIGH_RISK";
            riskScore = 65;
            alerts = ["LARGE_TRANSACTION_THRESHOLD_EXCEEDED"];
            narrative = `Deposit amount of ${amount.toLocaleString()} USDC exceeds the large transaction threshold of $10,000,000. This triggers enhanced due diligence requirements under AML policy.`;
        }

        if (!status) return null;

        const reportString = JSON.stringify({ address, status, riskScore, alerts, narrative, checkedAt, provider: "ai-oracle" });
        const reportHash = ethers.keccak256(ethers.toUtf8Bytes(reportString));

        return { status, riskScore, alerts, provider: "ai-oracle", checkedAt, reportHash, aiNarrative: narrative, txSummary: null };
    }

    // ── Private: Etherscan API ──────────────────────────────────────────────
    private async _fetchTxHistory(address: string): Promise<any[]> {
        const [txRes, tokenRes] = await Promise.all([
            axios.get(this.etherscanBase, {
                params: {
                    module: "account",
                    action: "txlist",
                    address,
                    startblock: 0,
                    endblock: 99999999,
                    page: 1,
                    offset: 50,
                    sort: "desc",
                    apikey: this.etherscanKey,
                },
                timeout: 8000,
            }),
            axios.get(this.etherscanBase, {
                params: {
                    module: "account",
                    action: "tokentx",
                    address,
                    startblock: 0,
                    endblock: 99999999,
                    page: 1,
                    offset: 30,
                    sort: "desc",
                    apikey: this.etherscanKey,
                },
                timeout: 8000,
            }),
        ]);

        const transactions = txRes.data?.result ?? [];
        const tokenTransfers = tokenRes.data?.result ?? [];

        return [...(Array.isArray(transactions) ? transactions : []), ...(Array.isArray(tokenTransfers) ? tokenTransfers : [])];
    }

    // ── Private: Summarize tx data ──────────────────────────────────────────
    private _summarizeTxHistory(address: string, txs: any[]): AIScreeningResult["txSummary"] {
        if (!txs.length) {
            return { totalTxs: 0, uniqueCounterparties: 0, activePeriod: "No transactions found", protocols: [] };
        }

        const addr = address.toLowerCase();
        const counterparties = new Set<string>();
        const protocols: string[] = [];
        const suspiciousHits: string[] = [];
        let earliest = Infinity;
        let latest = 0;

        for (const tx of txs) {
            const to = (tx.to || "").toLowerCase();
            const from = (tx.from || "").toLowerCase();
            const counterparty = from === addr ? to : from;

            if (counterparty) counterparties.add(counterparty);

            // Check known protocols
            if (KNOWN_PROTOCOLS[to] && !protocols.includes(KNOWN_PROTOCOLS[to])) {
                protocols.push(KNOWN_PROTOCOLS[to]);
            }

            // Check suspicious addresses
            if (SUSPICIOUS_ADDRESSES[to]) {
                suspiciousHits.push(SUSPICIOUS_ADDRESSES[to]);
            }
            if (SUSPICIOUS_ADDRESSES[from]) {
                suspiciousHits.push(SUSPICIOUS_ADDRESSES[from]);
            }

            const ts = parseInt(tx.timeStamp || "0");
            if (ts > 0) {
                earliest = Math.min(earliest, ts);
                latest = Math.max(latest, ts);
            }
        }

        const earliestDate = earliest < Infinity ? new Date(earliest * 1000).toISOString().split("T")[0] : "unknown";
        const latestDate = latest > 0 ? new Date(latest * 1000).toISOString().split("T")[0] : "unknown";

        return {
            totalTxs: txs.length,
            uniqueCounterparties: counterparties.size,
            activePeriod: `${earliestDate} to ${latestDate}`,
            protocols: [...new Set([...protocols, ...suspiciousHits])],
        };
    }

    // ── Private: Gemini AI call with retry ──────────────────────────────────
    private async _callGemini(
        address: string,
        amount: number,
        txSummary: AIScreeningResult["txSummary"],
        rawTxs: any[],
    ): Promise<{ status: string; riskScore: number; alerts: string[]; narrative: string }> {

        // Build a concise tx digest for the LLM (avoid sending raw JSON of 50+ txs)
        const txDigest = rawTxs.slice(0, 20).map((tx) => {
            const to = (tx.to || "").toLowerCase();
            const label = KNOWN_PROTOCOLS[to] || SUSPICIOUS_ADDRESSES[to] || "";
            const value = tx.value ? ethers.formatEther(tx.value) : "0";
            const date = tx.timeStamp ? new Date(parseInt(tx.timeStamp) * 1000).toISOString().split("T")[0] : "?";
            return `${date} | ${tx.from?.slice(0, 10)}→${tx.to?.slice(0, 10)} | ${value} ETH${label ? ` | ${label}` : ""}`;
        }).join("\n");

        const prompt = `You are an AML (Anti-Money Laundering) compliance analyst for institutional DeFi. Analyze this Ethereum wallet and produce a risk assessment.

WALLET: ${address}
REQUESTED DEPOSIT: ${amount.toLocaleString()} USDC

TRANSACTION SUMMARY:
- Total transactions: ${txSummary?.totalTxs ?? 0}
- Unique counterparties: ${txSummary?.uniqueCounterparties ?? 0}
- Active period: ${txSummary?.activePeriod ?? "unknown"}
- Known protocol interactions: ${txSummary?.protocols?.join(", ") || "none detected"}

RECENT TRANSACTIONS (most recent first):
${txDigest || "No transaction data available"}

ANALYSIS INSTRUCTIONS:
1. Look for red flags: mixer interactions (Tornado Cash), sanctioned entity proximity, rapid fund cycling, layered transfers, large unexplained inflows
2. Look for positive signals: established DeFi history, regular protocol usage, long account age, small number of counterparties
3. If no transactions are found, assign a moderate risk score (20-40) due to lack of history

Respond with ONLY this JSON (no markdown, no backticks):
{"status":"CLEARED","riskScore":0,"alerts":[],"narrative":"2-3 sentence explanation"}

Where:
- status: "CLEARED" (risk 0-49), "HIGH_RISK" (risk 50-74), or "BLOCKED" (risk 75-100)
- riskScore: integer 0-100
- alerts: array of alert codes like "MIXER_INTERACTION", "RAPID_FUND_CYCLING", "NO_TRANSACTION_HISTORY", "SHORT_ACCOUNT_AGE", "SANCTIONED_ENTITY_PROXIMITY"
- narrative: clear, professional 2-3 sentence compliance summary`;

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 300,
                responseMimeType: "application/json",
            },
        };

        // Retry with exponential backoff (handles 429 rate limits)
        const response = await this._retryWithBackoff(() =>
            axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`,
                requestBody,
                { timeout: 20000 },
            ),
            3,   // max retries
            2000 // initial delay ms
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        console.log("🤖 Gemini raw response:", text.substring(0, 200));

        // Parse JSON from response
        try {
            const parsed = JSON.parse(text);
            // Validate and clamp
            const validStatuses = ["CLEARED", "HIGH_RISK", "BLOCKED"];
            return {
                status: validStatuses.includes(parsed.status) ? parsed.status : "CLEARED",
                riskScore: Math.max(0, Math.min(100, Number(parsed.riskScore) || 0)),
                alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
                narrative: typeof parsed.narrative === "string" ? parsed.narrative : "AI analysis completed.",
            };
        } catch {
            // If JSON parse fails, build a data-driven narrative from Etherscan data
            console.warn("⚠️  Gemini returned non-JSON, building data-driven fallback. Raw:", text.substring(0, 300));
            return this._buildDataDrivenFallback(address, amount, txSummary);
        }
    }

    // ── Private: Retry helper with exponential backoff ──────────────────────
    private async _retryWithBackoff<T>(
        fn: () => Promise<T>,
        maxRetries: number,
        initialDelayMs: number,
    ): Promise<T> {
        let lastError: any;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (err: any) {
                lastError = err;
                const status = err?.response?.status;
                // Only retry on 429 (rate limit) or 503 (service unavailable)
                if (attempt < maxRetries && (status === 429 || status === 503)) {
                    const delay = initialDelayMs * Math.pow(2, attempt);
                    console.log(`⏳ Gemini returned ${status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
                    await new Promise((r) => setTimeout(r, delay));
                } else {
                    throw err;
                }
            }
        }
        throw lastError;
    }

    // ── Private: Data-driven fallback when Gemini is unavailable ────────────
    private _buildDataDrivenFallback(
        address: string,
        amount: number,
        txSummary: AIScreeningResult["txSummary"],
    ): { status: string; riskScore: number; alerts: string[]; narrative: string } {
        const totalTxs = txSummary?.totalTxs ?? 0;
        const counterparties = txSummary?.uniqueCounterparties ?? 0;
        const protocols = txSummary?.protocols ?? [];
        const alerts: string[] = [];

        // Check for suspicious protocol interactions
        const hasSuspicious = protocols.some((p) =>
            p.toLowerCase().includes("tornado") || p.toLowerCase().includes("mixer")
        );
        const hasDeFi = protocols.some((p) =>
            ["uniswap", "aave", "compound", "sushiswap", "1inch", "0x"].some((d) => p.toLowerCase().includes(d))
        );

        let riskScore: number;
        let status: string;
        let narrative: string;

        if (hasSuspicious) {
            riskScore = 72;
            status = "HIGH_RISK";
            alerts.push("MIXER_INTERACTION", "ENHANCED_DUE_DILIGENCE_REQUIRED");
            narrative = `Wallet ${address.slice(0, 10)}... shows interaction with privacy-enhancing protocols (${protocols.filter(p => p.toLowerCase().includes("tornado")).join(", ")}). The address has ${totalTxs} transactions across ${counterparties} counterparties. Enhanced due diligence is recommended before proceeding with the ${amount.toLocaleString()} USDC deposit.`;
        } else if (totalTxs === 0) {
            riskScore = 32;
            status = "CLEARED";
            alerts.push("NO_TRANSACTION_HISTORY");
            narrative = `Wallet ${address.slice(0, 10)}... has no on-chain transaction history on Ethereum mainnet. While no risk indicators were found, the lack of history warrants a moderate risk score. The ${amount.toLocaleString()} USDC deposit may proceed with standard monitoring.`;
        } else if (hasDeFi && totalTxs > 10) {
            riskScore = 8;
            status = "CLEARED";
            narrative = `Wallet ${address.slice(0, 10)}... demonstrates an established DeFi presence with ${totalTxs} transactions across ${counterparties} unique counterparties. Protocol interactions include ${protocols.slice(0, 3).join(", ")}${protocols.length > 3 ? ` and ${protocols.length - 3} more` : ""}. Active period: ${txSummary?.activePeriod ?? "unknown"}. Low risk profile — the ${amount.toLocaleString()} USDC deposit is cleared for processing.`;
        } else {
            riskScore = Math.min(45, Math.max(5, 50 - totalTxs));
            status = "CLEARED";
            if (totalTxs < 5) alerts.push("LIMITED_HISTORY");
            narrative = `Wallet ${address.slice(0, 10)}... has ${totalTxs} transactions with ${counterparties} unique counterparties over ${txSummary?.activePeriod ?? "an unknown period"}. ${protocols.length > 0 ? `Known interactions: ${protocols.join(", ")}.` : "No known protocol interactions detected."} Risk assessment: ${riskScore < 30 ? "low" : "moderate"} — the ${amount.toLocaleString()} USDC deposit is cleared with standard compliance monitoring.`;
        }

        return { status, riskScore, alerts, narrative };
    }
}
