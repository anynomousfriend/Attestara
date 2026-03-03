/**
 * CRE — Compliance & Routing Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Endpoints:
 *   POST /api/v1/compliance/screen          — screen + attest
 *   POST /api/v1/compliance/deposit         — screen + sign + simulate + execute
 *   GET  /api/v1/compliance/queue           — pending queue
 *   GET  /api/v1/compliance/logs            — AML audit logs
 *   GET  /api/v1/compliance/audit/:txHash   — [F2] time-travel audit
 *   POST /api/v1/webhooks/tenderly          — [F3] revocation webhook
 *   GET  /api/v1/revocations                — [F3] revocation event log
 *   POST /api/v1/scenarios/:scenarioId      — [F4] adversarial scenarios
 *   GET  /api/v1/vault/stats                — vault stats
 *   GET  /api/v1/vault/trace/:txHash        — [F5] gas trace analysis
 *   GET  /health
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

import { DIDResolver }        from "./services/didResolver";
import { AttestationSigner }  from "./services/attestationSigner";
import { TxForwarder }        from "./services/txForwarder";
import { SimulationService }  from "./services/simulationService";
import { TimeTravelService }  from "./services/timeTravelService";
import { RevocationService }  from "./services/revocationService";
import { ScenarioRunner }     from "./services/scenarioRunner";
import { TraceAnalyzer, registerAddressLabel } from "./services/traceAnalyzer";
import { MockAMLAdapter }     from "./adapters/mockAmlAdapter";
import { ChainalysisAdapter } from "./adapters/chainalysisAdapter";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ── Config ─────────────────────────────────────────────────────────────────────
const PORT              = process.env.CRE_PORT || 4000;
const RPC_URL           = process.env.TENDERLY_FORK_RPC || process.env.RPC_URL || "http://localhost:8545";
const CHAIN_ID          = parseInt(process.env.CHAIN_ID || "1");
const DID_REGISTRY_ADDR = process.env.DID_REGISTRY_ADDRESS!;
const VERIFIER_ADDR     = process.env.VERIFIER_ADDRESS!;
const VAULT_ADDR        = process.env.VAULT_ADDRESS!;
const USDC_ADDR         = process.env.USDC_ADDRESS || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const CRE_PRIVATE_KEY   = process.env.CRE_SIGNER_PRIVATE_KEY;
const DEPLOYER_KEY      = process.env.DEPLOYER_PRIVATE_KEY || "";
const CHAINALYSIS_KEY   = process.env.CHAINALYSIS_API_KEY;
const MOCK_AML_URL      = process.env.MOCK_AML_URL || "http://localhost:4001";

// Tenderly config (for simulation, time-travel, trace)
const TENDERLY_API_KEY  = process.env.TENDERLY_API_KEY || "";
const TENDERLY_ACCOUNT  = process.env.TENDERLY_ACCOUNT_SLUG || "";
const TENDERLY_PROJECT  = process.env.TENDERLY_PROJECT_SLUG || "";
const TENDERLY_FORK_ID  = process.env.TENDERLY_FORK_ID || "";

// ── Initialise core services ───────────────────────────────────────────────────
const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true, polling: false });

let didResolver:       DIDResolver | null       = null;
let attestationSigner: AttestationSigner | null = null;
let txForwarder:       TxForwarder | null       = null;

// ── Feature services (always initialised; degrade gracefully without Tenderly) ──
let simulationService: SimulationService | null = null;
let timeTravelService: TimeTravelService | null = null;
let revocationService: RevocationService | null = null;
let scenarioRunner:    ScenarioRunner    | null = null;
let traceAnalyzer:     TraceAnalyzer    | null = null;

// AML adapter
const amlAdapter = CHAINALYSIS_KEY
  ? new ChainalysisAdapter(CHAINALYSIS_KEY)
  : new MockAMLAdapter(MOCK_AML_URL);

console.log(`🛡️  AML Provider: ${amlAdapter.providerName}`);

// ── In-memory audit log ────────────────────────────────────────────────────────
interface AuditLog {
  id:           string;
  timestamp:    string;
  subject:      string;
  did:          string | null;
  amount:       string;
  amlStatus:    string;
  riskScore:    number;
  alerts:       string[];
  attestation:  any | null;
  txHash:       string | null;
  blockNumber?: number;
  nonce?:       string;
  status:       "PENDING" | "CLEARED" | "BLOCKED" | "SUBMITTED" | "SETTLED" | "FAILED" | "REVOKED";
  simulation?:  any;
  gasBreakdown?: any;
}

const auditLogs: AuditLog[]    = [];
const pendingQueue: AuditLog[] = [];

function createLog(data: Partial<AuditLog>): AuditLog {
  return {
    id:          require("crypto").randomUUID(),
    timestamp:   new Date().toISOString(),
    subject:     data.subject || "",
    did:         data.did     || null,
    amount:      data.amount  || "0",
    amlStatus:   data.amlStatus || "PENDING",
    riskScore:   data.riskScore || 0,
    alerts:      data.alerts    || [],
    attestation: data.attestation || null,
    txHash:      data.txHash      || null,
    status:      data.status      || "PENDING",
  };
}

function removePending(id: string) {
  const idx = pendingQueue.findIndex(l => l.id === id);
  if (idx !== -1) pendingQueue.splice(idx, 1);
}

// ── Express app ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ── Health ─────────────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status:      "ok",
    service:     "cre",
    amlProvider: amlAdapter.providerName,
    rpcUrl:      RPC_URL,
    contracts: {
      didRegistry: DID_REGISTRY_ADDR,
      verifier:    VERIFIER_ADDR,
      vault:       VAULT_ADDR,
    },
    features: {
      simulation: !!simulationService,
      timeTravel: !!timeTravelService,
      revocation: !!revocationService,
      scenarios:  !!scenarioRunner,
      tracing:    !!traceAnalyzer,
    },
    timestamp: new Date().toISOString(),
  });
});

// ── POST /api/v1/compliance/screen ─────────────────────────────────────────────
app.post("/api/v1/compliance/screen", async (req: Request, res: Response) => {
  const { address, amount } = req.body;
  if (!address) { res.status(400).json({ error: "address is required" }); return; }

  const log = createLog({ subject: address, amount: String(amount || 0), status: "PENDING" });
  pendingQueue.push(log);
  auditLogs.push(log);

  try {
    let did: string | null = null;
    if (didResolver) {
      const doc = await didResolver.resolve(address);
      did       = doc?.did || null;
    }
    log.did = did;

    const amlResult = await amlAdapter.screenAddress(address, Number(amount || 0));
    log.amlStatus   = amlResult.status;
    log.riskScore   = amlResult.riskScore;
    log.alerts      = amlResult.alerts;

    if (amlResult.status === "BLOCKED") {
      log.status = "BLOCKED";
      removePending(log.id);
      return res.status(403).json({ logId: log.id, status: "BLOCKED", reason: "AML screening returned BLOCKED", alerts: amlResult.alerts });
    }
    if (amlResult.status === "HIGH_RISK") {
      log.status = "BLOCKED";
      removePending(log.id);
      return res.status(403).json({ logId: log.id, status: "HIGH_RISK", reason: "Transaction flagged for manual review", alerts: amlResult.alerts });
    }

    if (!attestationSigner) {
      return res.status(503).json({ error: "AttestationSigner not initialized — set contract addresses in .env" });
    }

    const signed = await attestationSigner.sign(address, amlResult.reportHash, amlResult.provider);
    log.attestation = {
      subject:       signed.attestation.subject,
      amlReportHash: signed.attestation.amlReportHash,
      expiry:        signed.attestation.expiry.toString(),
      nonce:         signed.attestation.nonce.toString(),
      amlProvider:   signed.attestation.amlProvider,
    };
    log.nonce  = signed.attestation.nonce.toString();
    log.status = "CLEARED";
    removePending(log.id);

    return res.json({
      logId:       log.id,
      status:      "CLEARED",
      did,
      amlProvider: amlResult.provider,
      riskScore:   amlResult.riskScore,
      attestation: log.attestation,
      signature:   signed.signature,
      signerAddress: signed.signerAddress,
    });
  } catch (err: any) {
    log.status = "FAILED";
    removePending(log.id);
    return res.status(500).json({ error: "Screening failed", message: err.message });
  }
});

// ── POST /api/v1/compliance/deposit ───────────────────────────────────────────
// Feature 1: Simulation pre-flight is run between sign and execute.
app.post("/api/v1/compliance/deposit", async (req: Request, res: Response) => {
  const { address, amount, institutionPrivateKey, skipSimulation } = req.body;

  if (!address || !amount)           { res.status(400).json({ error: "address and amount are required" }); return; }
  if (!institutionPrivateKey)        { res.status(400).json({ error: "institutionPrivateKey required for relay mode" }); return; }

  const log = createLog({ subject: address, amount: String(amount), status: "PENDING" });
  pendingQueue.push(log);
  auditLogs.push(log);

  try {
    // 1. DID
    let did: string | null = null;
    if (didResolver) {
      const doc = await didResolver.resolve(address);
      did       = doc?.did || null;
    }
    log.did = did;

    // 2. AML
    const amlResult = await amlAdapter.screenAddress(address, Number(amount));
    log.amlStatus   = amlResult.status;
    log.riskScore   = amlResult.riskScore;
    log.alerts      = amlResult.alerts;

    if (amlResult.status !== "CLEARED") {
      log.status = "BLOCKED";
      removePending(log.id);
      return res.status(403).json({ logId: log.id, status: amlResult.status, alerts: amlResult.alerts });
    }

    if (!attestationSigner || !txForwarder) {
      return res.status(503).json({ error: "Services not initialized" });
    }

    // 3. Sign attestation
    const signed      = await attestationSigner.sign(address, amlResult.reportHash, amlResult.provider);
    const amountBigInt = ethers.parseUnits(String(amount), 6);
    log.nonce = signed.attestation.nonce.toString();

    // 4. [Feature 1] Tenderly Simulation Pre-Flight
    let simulationResult: any = null;
    if (simulationService && !skipSimulation) {
      try {
        simulationResult = await simulationService.simulateDeposit(address, amountBigInt, signed);
        log.simulation   = simulationResult;

        if (!simulationResult.success) {
          log.status = "FAILED";
          removePending(log.id);
          return res.status(422).json({
            logId:      log.id,
            status:     "SIMULATION_FAILED",
            simulation: simulationResult,
            message:    simulationResult.decodedRevert ?? simulationResult.revertReason ?? "Simulation reverted",
          });
        }
      } catch (simErr: any) {
        // Non-fatal: if Tenderly is unreachable, proceed without simulation
        console.warn("⚠️  Simulation unavailable (non-fatal):", simErr.message);
      }
    }

    log.status = "SUBMITTED";

    // 5. Execute on-chain
    const institutionWallet = new ethers.Wallet(institutionPrivateKey);
    const result = await txForwarder.executeDeposit(institutionWallet, amountBigInt, signed);

    log.txHash      = result.txHash;
    log.blockNumber = result.blockNumber;
    log.status      = "SETTLED";
    log.attestation = {
      subject:       signed.attestation.subject,
      amlReportHash: signed.attestation.amlReportHash,
      expiry:        signed.attestation.expiry.toString(),
      nonce:         signed.attestation.nonce.toString(),
      amlProvider:   signed.attestation.amlProvider,
    };
    removePending(log.id);

    // 6. [Feature 5] Async gas trace (non-blocking)
    if (traceAnalyzer && result.txHash) {
      traceAnalyzer.analyze(result.txHash)
        .then(gb => { log.gasBreakdown = gb; })
        .catch(() => {});
    }

    return res.json({
      logId:        log.id,
      status:       "SETTLED",
      txHash:       result.txHash,
      blockNumber:  result.blockNumber,
      gasUsed:      result.gasUsed,
      vaultBalance: result.vaultBalance,
      attestation:  log.attestation,
      simulation:   simulationResult,
    });

  } catch (err: any) {
    log.status = "FAILED";
    removePending(log.id);
    return res.status(500).json({ error: "Deposit relay failed", message: err.message });
  }
});

// ── GET /api/v1/compliance/queue ───────────────────────────────────────────────
app.get("/api/v1/compliance/queue", (_req: Request, res: Response) => {
  res.json({ queue: pendingQueue, count: pendingQueue.length });
});

// ── GET /api/v1/compliance/logs ────────────────────────────────────────────────
app.get("/api/v1/compliance/logs", (req: Request, res: Response) => {
  const limit  = parseInt(req.query.limit as string || "50");
  const offset = parseInt(req.query.offset as string || "0");
  const logs   = auditLogs.slice().reverse().slice(offset, offset + limit);
  res.json({ logs, total: auditLogs.length });
});

// ── GET /api/v1/compliance/audit/:txHash  [Feature 2] ────────────────────────
app.get("/api/v1/compliance/audit/:txHash", async (req: Request, res: Response) => {
  const { txHash } = req.params;
  const { subject, nonce } = req.query as { subject?: string; nonce?: string };

  if (!timeTravelService) {
    return res.status(503).json({ error: "TimeTravelService not available — set TENDERLY_API_KEY in .env" });
  }

  // Try to find subject/nonce from our audit logs if not provided
  let resolvedSubject = subject || "";
  let resolvedNonce   = nonce   || "0";

  if (!resolvedSubject) {
    const found = auditLogs.find(l => l.txHash === txHash);
    if (found) {
      resolvedSubject = found.subject;
      resolvedNonce   = found.nonce || "0";
    }
  }

  if (!resolvedSubject) {
    return res.status(400).json({ error: "subject address required (or perform deposit first)" });
  }

  try {
    const comparison = await timeTravelService.audit(txHash, resolvedSubject, resolvedNonce);
    return res.json(comparison);
  } catch (err: any) {
    return res.status(500).json({ error: "Time-travel audit failed", message: err.message });
  }
});

// ── POST /api/v1/webhooks/tenderly  [Feature 3] ───────────────────────────────
app.post("/api/v1/webhooks/tenderly", async (req: Request, res: Response) => {
  if (!revocationService) {
    return res.status(503).json({ error: "RevocationService not available" });
  }

  const rescreenFn = async (address: string) => {
    const result = await amlAdapter.screenAddress(address, 0);
    return { status: result.status, riskScore: result.riskScore, alerts: result.alerts };
  };

  try {
    const event = await revocationService.processWebhook(req.body, rescreenFn);
    if (event) {
      // Update log status if we have a matching entry
      const matchingLog = auditLogs.find(l => l.subject === event.subject && l.status === "SETTLED");
      if (matchingLog && (event.newStatus === "BLOCKED" || event.newStatus === "HIGH_RISK")) {
        matchingLog.status = "REVOKED";
      }
    }
    return res.json({ received: true, event });
  } catch (err: any) {
    return res.status(500).json({ error: "Webhook processing failed", message: err.message });
  }
});

// ── POST /api/v1/compliance/revoke  [Feature 3] ───────────────────────────────
app.post("/api/v1/compliance/revoke", async (req: Request, res: Response) => {
  const { subject, nonce, reason } = req.body;
  if (!subject || !nonce) { return res.status(400).json({ error: "subject and nonce required" }); }
  if (!revocationService) { return res.status(503).json({ error: "RevocationService not available" }); }

  try {
    const event = await revocationService.revokeByNonce(subject, String(nonce), reason || "Manual revocation");
    const matchingLog = auditLogs.find(l => l.subject === subject && l.nonce === String(nonce));
    if (matchingLog) matchingLog.status = "REVOKED";
    return res.json(event);
  } catch (err: any) {
    return res.status(500).json({ error: "Revocation failed", message: err.message });
  }
});

// ── GET /api/v1/revocations  [Feature 3] ──────────────────────────────────────
app.get("/api/v1/revocations", (_req: Request, res: Response) => {
  if (!revocationService) { return res.json({ events: [] }); }
  return res.json({ events: revocationService.allEvents });
});

// ── POST /api/v1/scenarios/:scenarioId  [Feature 4] ──────────────────────────
app.post("/api/v1/scenarios/:scenarioId", async (req: Request, res: Response) => {
  const { scenarioId } = req.params;

  if (!scenarioRunner) {
    return res.status(503).json({ error: "ScenarioRunner not available — set contract addresses and DEPLOYER_PRIVATE_KEY in .env" });
  }

  const valid = ["sanctioned", "replay", "expired", "no-did", "pause"];
  if (!valid.includes(scenarioId)) {
    return res.status(400).json({ error: `Unknown scenario. Valid: ${valid.join(", ")}` });
  }

  try {
    const result = await scenarioRunner.run(scenarioId as any);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "Scenario failed", message: err.message });
  }
});

// ── GET /api/v1/vault/stats ────────────────────────────────────────────────────
app.get("/api/v1/vault/stats", async (_req: Request, res: Response) => {
  if (!txForwarder) {
    return res.json({ totalDeposits: "0", userBalance: "0", note: "Vault not connected" });
  }
  try {
    const stats = await txForwarder.getVaultStats();
    return res.json(stats);
  } catch (err: any) {
    console.warn("⚠️  vault/stats RPC error (non-fatal):", err.message);
    return res.json({ totalDeposits: "0", userBalance: "0", note: "RPC temporarily unavailable" });
  }
});

// ── GET /api/v1/vault/trace/:txHash  [Feature 5] ─────────────────────────────
app.get("/api/v1/vault/trace/:txHash", async (req: Request, res: Response) => {
  const { txHash } = req.params;
  if (!traceAnalyzer) {
    return res.status(503).json({ error: "TraceAnalyzer not available — set TENDERLY_API_KEY in .env" });
  }

  // Check if we already computed it for this tx
  const cached = auditLogs.find(l => l.txHash === txHash)?.gasBreakdown;
  if (cached) return res.json(cached);

  try {
    const breakdown = await traceAnalyzer.analyze(txHash);
    // Cache it back
    const log = auditLogs.find(l => l.txHash === txHash);
    if (log) log.gasBreakdown = breakdown;
    return res.json(breakdown);
  } catch (err: any) {
    return res.status(500).json({ error: "Trace analysis failed", message: err.message });
  }
});

// ── Error handler ──────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("CRE Error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// ── Start ──────────────────────────────────────────────────────────────────────
async function start() {
  if (DID_REGISTRY_ADDR && VERIFIER_ADDR && VAULT_ADDR) {
    didResolver       = new DIDResolver(DID_REGISTRY_ADDR, provider);
    attestationSigner = new AttestationSigner(VERIFIER_ADDR, CHAIN_ID, CRE_PRIVATE_KEY);
    txForwarder       = new TxForwarder(RPC_URL, VAULT_ADDR, USDC_ADDR);
    console.log("✅ DIDResolver, AttestationSigner, TxForwarder initialized");

    // Register address labels for gas trace readability
    registerAddressLabel(VAULT_ADDR,        "PermissionedVault");
    registerAddressLabel(VERIFIER_ADDR,     "ComplianceAttestationVerifier");
    registerAddressLabel(DID_REGISTRY_ADDR, "DIDRegistry");
    registerAddressLabel(USDC_ADDR,         "USDC (ERC20)");

    if (DEPLOYER_KEY) {
      // Feature 3: Revocation
      revocationService = new RevocationService({
        forkRpc:      RPC_URL,
        verifierAddr: VERIFIER_ADDR,
        deployerKey:  DEPLOYER_KEY,
      });
      console.log("✅ RevocationService initialized");

      // Feature 4: Scenario runner
      scenarioRunner = new ScenarioRunner({
        forkRpc:      RPC_URL,
        signer:       attestationSigner,
        forwarder:    txForwarder,
        vaultAddr:    VAULT_ADDR,
        usdcAddr:     USDC_ADDR,
        didAddr:      DID_REGISTRY_ADDR,
        verifierAddr: VERIFIER_ADDR,
        deployerKey:  DEPLOYER_KEY,
      });
      console.log("✅ ScenarioRunner initialized");
    }
  } else {
    console.warn("⚠️  Contract addresses not set — running in AML-only mode");
  }

  // Tenderly-powered features (require API key + fork)
  if (TENDERLY_API_KEY && TENDERLY_ACCOUNT && TENDERLY_PROJECT) {
    if (VAULT_ADDR && TENDERLY_FORK_ID) {
      // Feature 1: Simulation
      simulationService = new SimulationService({
        apiKey:    TENDERLY_API_KEY,
        account:   TENDERLY_ACCOUNT,
        project:   TENDERLY_PROJECT,
        forkId:    TENDERLY_FORK_ID,
        vaultAddr: VAULT_ADDR,
        networkId: CHAIN_ID,
      });
      console.log("✅ SimulationService initialized [Feature 1]");
    }

    if (DID_REGISTRY_ADDR && VAULT_ADDR && VERIFIER_ADDR) {
      // Feature 2: Time-travel
      timeTravelService = new TimeTravelService({
        apiKey:       TENDERLY_API_KEY,
        account:      TENDERLY_ACCOUNT,
        project:      TENDERLY_PROJECT,
        currentRpc:   RPC_URL,
        didAddr:      DID_REGISTRY_ADDR,
        vaultAddr:    VAULT_ADDR,
        verifierAddr: VERIFIER_ADDR,
      });
      console.log("✅ TimeTravelService initialized [Feature 2]");
    }

    if (TENDERLY_FORK_ID) {
      // Feature 5: Trace analyzer
      traceAnalyzer = new TraceAnalyzer({
        apiKey:  TENDERLY_API_KEY,
        account: TENDERLY_ACCOUNT,
        project: TENDERLY_PROJECT,
        forkId:  TENDERLY_FORK_ID,
      });
      console.log("✅ TraceAnalyzer initialized [Feature 5]");
    }
  } else {
    console.warn("⚠️  TENDERLY_API_KEY / ACCOUNT / PROJECT not set — simulation, time-travel, and tracing disabled");
  }

  app.listen(PORT, () => {
    console.log(`\n🔐 CRE (Compliance & Routing Engine) running on http://localhost:${PORT}`);
    console.log(`   AML Provider:  ${amlAdapter.providerName}`);
    console.log(`   RPC URL:       ${RPC_URL}`);
    console.log(`   Features:      simulation=${!!simulationService} timeTravel=${!!timeTravelService} revocation=${!!revocationService} scenarios=${!!scenarioRunner} tracing=${!!traceAnalyzer}\n`);
  });
}

start().catch((err) => {
  console.error("❌ CRE failed to start:", err);
  process.exit(1);
});

export default app;
