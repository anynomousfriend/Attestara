/**
 * Mock AML Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Simulates a Chainalysis KYT (Know Your Transaction) API.
 * Used by the CRE when CHAINALYSIS_API_KEY is not set.
 *
 * Endpoints:
 *   POST /v1/users                          — register a user entity
 *   POST /v1/users/:userId/transfers        — submit a transfer for screening
 *   GET  /v1/users/:userId/transfers/:txId  — get transfer alert status
 *   GET  /v1/address/:address/risk          — direct address risk check (CRE shortcut)
 *   GET  /health                            — health check
 *
 * Screening Logic:
 *   - Addresses starting with "0x000" → BLOCKED (simulates OFAC-sanctioned)
 *   - Amounts > 10,000,000 USDC (10M) → HIGH_RISK (flag for review)
 *   - Everything else → CLEARED
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express, { Request, Response, NextFunction } from "express";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";
import * as dotenv from "dotenv";

dotenv.config();

const app  = express();
const PORT = process.env.MOCK_AML_PORT || 4001;

app.use(express.json());
app.use(morgan("dev"));

// ── In-memory store ──────────────────────────────────────────────────────────
interface UserEntity {
  userId:    string;
  address:   string;
  createdAt: string;
}

interface TransferRecord {
  transferId:    string;
  userId:        string;
  asset:         string;
  amount:        number;
  direction:     "received" | "sent";
  status:        "CLEARED" | "BLOCKED" | "HIGH_RISK" | "PENDING";
  riskScore:     number;
  alerts:        string[];
  createdAt:     string;
  resolvedAt:    string | null;
}

const users     = new Map<string, UserEntity>();
const transfers = new Map<string, TransferRecord>();

// ── Screening engine ─────────────────────────────────────────────────────────
function screenAddress(address: string): { status: "CLEARED" | "BLOCKED" | "HIGH_RISK"; riskScore: number; alerts: string[] } {
  const lower = address.toLowerCase();

  // Simulate OFAC sanctions list match
  if (lower.startsWith("0x000")) {
    return { status: "BLOCKED", riskScore: 100, alerts: ["OFAC_SANCTIONS_MATCH", "HIGH_RISK_ENTITY"] };
  }

  // Simulate mixer/tumbler detection
  if (lower.includes("dead") || lower.includes("beef")) {
    return { status: "HIGH_RISK", riskScore: 75, alerts: ["MIXER_INTERACTION", "DARKNET_MARKET_EXPOSURE"] };
  }

  return { status: "CLEARED", riskScore: Math.floor(Math.random() * 15), alerts: [] };
}

function screenAmount(amount: number): { flagged: boolean; alert: string | null } {
  if (amount > 10_000_000) {
    return { flagged: true, alert: "LARGE_TRANSACTION_THRESHOLD_EXCEEDED" };
  }
  return { flagged: false, alert: null };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "mock-aml", timestamp: new Date().toISOString() });
});

// Register user entity
app.post("/v1/users", (req: Request, res: Response) => {
  const { address } = req.body;
  if (!address) {
    res.status(400).json({ error: "address is required" });
    return;
  }

  const userId = uuidv4();
  const user: UserEntity = {
    userId,
    address,
    createdAt: new Date().toISOString(),
  };
  users.set(userId, user);

  res.status(201).json({ userId, address, createdAt: user.createdAt });
});

// Submit transfer for screening
app.post("/v1/users/:userId/transfers", (req: Request, res: Response) => {
  const { userId } = req.params;
  const { asset, amount, direction, transferReference } = req.body;

  const user = users.get(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const addressScreen = screenAddress(user.address);
  const amountScreen  = screenAmount(Number(amount));

  let status: TransferRecord["status"] = addressScreen.status;
  const alerts = [...addressScreen.alerts];

  if (amountScreen.flagged && amountScreen.alert) {
    alerts.push(amountScreen.alert);
    if (status === "CLEARED") status = "HIGH_RISK";
  }

  const transferId = uuidv4();
  const record: TransferRecord = {
    transferId,
    userId,
    asset:      asset || "USDC",
    amount:     Number(amount),
    direction:  direction || "received",
    status,
    riskScore:  addressScreen.riskScore,
    alerts,
    createdAt:  new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
  };

  transfers.set(transferId, record);

  res.status(201).json({
    transferId,
    transferReference: transferReference || null,
    asset:      record.asset,
    amount:     record.amount,
    direction:  record.direction,
    status:     record.status,
    riskScore:  record.riskScore,
    alerts:     record.alerts,
    createdAt:  record.createdAt,
    resolvedAt: record.resolvedAt,
  });
});

// Get transfer status
app.get("/v1/users/:userId/transfers/:transferId", (req: Request, res: Response) => {
  const { userId, transferId } = req.params;

  const record = transfers.get(transferId);
  if (!record || record.userId !== userId) {
    res.status(404).json({ error: "Transfer not found" });
    return;
  }

  res.json(record);
});

// Direct address risk check (CRE shortcut — not in real Chainalysis API but useful for our flow)
app.get("/v1/address/:address/risk", (req: Request, res: Response) => {
  const { address } = req.params;
  const { amount } = req.query;

  const addressScreen = screenAddress(address);
  const amountScreen  = amount ? screenAmount(Number(amount)) : { flagged: false, alert: null };

  const alerts = [...addressScreen.alerts];
  if (amountScreen.flagged && amountScreen.alert) alerts.push(amountScreen.alert);

  let finalStatus = addressScreen.status;
  if (amountScreen.flagged && finalStatus === "CLEARED") finalStatus = "HIGH_RISK";

  res.json({
    address,
    status:    finalStatus,
    riskScore: addressScreen.riskScore,
    alerts,
    checkedAt: new Date().toISOString(),
  });
});

// List all transfers (admin/debug)
app.get("/v1/admin/transfers", (_req: Request, res: Response) => {
  res.json(Array.from(transfers.values()));
});

// List all users (admin/debug)
app.get("/v1/admin/users", (_req: Request, res: Response) => {
  res.json(Array.from(users.values()));
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Mock AML Error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡️  Mock AML Server running on http://localhost:${PORT}`);
  console.log(`   Simulating Chainalysis KYT API`);
  console.log(`   Screening rules:`);
  console.log(`     • 0x000... addresses → BLOCKED (OFAC)`);
  console.log(`     • 0x...dead.../0x...beef... → HIGH_RISK (mixer)`);
  console.log(`     • Amount > 10M USDC → HIGH_RISK flag`);
  console.log(`     • Everything else → CLEARED\n`);
});

export default app;
