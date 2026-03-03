import axios from "axios";

const CRE_BASE = "/api/v1";

export interface AuditLog {
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
  simulation?:  SimulationResult;
  gasBreakdown?: GasBreakdown;
}

// ── Feature 1: Simulation ──────────────────────────────────────────────────────
export interface SimulationResult {
  success:         boolean;
  gasUsed:         number;
  gasEstimateUsd?: string;
  revertReason?:   string;
  decodedRevert?:  string;
  logs:            { name: string; inputs: Record<string, string> }[];
  stateDiff:       { slot: string; original: string; dirty: string; label?: string }[];
  preview: {
    gasLabel:      string;
    stateChanges:  string[];
    events:        string[];
    errorSummary?: string;
  };
}

// ── Feature 2: Time-Travel Audit ───────────────────────────────────────────────
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

// ── Feature 3: Revocation ──────────────────────────────────────────────────────
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

// ── Feature 4: Scenarios ───────────────────────────────────────────────────────
export type ScenarioId = "sanctioned" | "replay" | "expired" | "no-did" | "pause";

export interface ScenarioStep {
  step:    number;
  label:   string;
  status:  "success" | "failed" | "expected-revert" | "info";
  detail:  string;
  data?:   Record<string, any>;
}

export interface ScenarioResult {
  scenarioId:  ScenarioId;
  title:       string;
  description: string;
  passed:      boolean;
  steps:       ScenarioStep[];
  summary:     string;
}

// ── Feature 5: Gas Trace ───────────────────────────────────────────────────────
export interface GasNode {
  label:    string;
  gasUsed:  number;
  pct:      number;
  children: GasNode[];
  type:     "call" | "staticcall" | "delegatecall" | "storage" | "root" | "other";
  error?:   string;
}

export interface GasBreakdown {
  txHash:         string;
  totalGas:       number;
  gasEstimateUsd: string;
  categories: {
    verification:  number;
    didCheck:      number;
    tokenTransfer: number;
    storage:       number;
    other:         number;
  };
  callTree:    GasNode;
  hints:       string[];
  sessionAvg?: number;
}

// ── Existing interfaces ────────────────────────────────────────────────────────
export interface QueueResponse   { queue: AuditLog[]; count: number; }
export interface LogsResponse    { logs:  AuditLog[]; total: number; }
export interface VaultStats      { totalDeposits: string; userBalance: string; note?: string; }
export interface HealthResponse  {
  status: string; service: string; amlProvider: string; rpcUrl: string;
  chainId?: number;
  contracts: { didRegistry: string; verifier: string; vault: string };
  features?: { simulation: boolean; timeTravel: boolean; revocation: boolean; scenarios: boolean; tracing: boolean };
  timestamp: string;
}

export interface ScreenRequest   { address: string; amount?: number; }
export interface ScreenResponse  {
  logId: string; status: string; did: string | null;
  amlProvider: string; riskScore: number;
  attestation: any; signature: string; signer?: string; signerAddress?: string;
  alerts?: string[]; reason?: string;
}

export interface DepositRequest  {
  address: string;
  amount: number;
  institutionPrivateKey: string;
  skipSimulation?: boolean;
}

export interface DepositResponse {
  logId:        string;
  status:       "SETTLED" | "FAILED" | "BLOCKED" | "SIMULATION_FAILED";
  txHash?:      string;
  blockNumber?: number;
  gasUsed?:     string;
  vaultBalance?: string;
  attestation?:  any;
  alerts?:       string[];
  error?:        string;
  message?:      string;
  simulation?:   SimulationResult;
}

export const api = {
  // Core
  health:     ()                              => axios.get<HealthResponse>(`/health`).then(r => r.data),
  queue:      ()                              => axios.get<QueueResponse>(`${CRE_BASE}/compliance/queue`).then(r => r.data.queue ?? []),
  logs:       (limit = 50, offset = 0)       => axios.get<LogsResponse>(`${CRE_BASE}/compliance/logs`, { params: { limit, offset } }).then(r => r.data.logs ?? []),
  vaultStats: ()                              => axios.get<VaultStats>(`${CRE_BASE}/vault/stats`).then(r => r.data),
  screen:     (req: ScreenRequest)            => axios.post<ScreenResponse>(`${CRE_BASE}/compliance/screen`, req).then(r => r.data),
  deposit:    (req: DepositRequest)           => axios.post<DepositResponse>(`${CRE_BASE}/compliance/deposit`, req).then(r => r.data),

  // Feature 2: Time-travel audit
  audit:      (txHash: string, subject?: string, nonce?: string) =>
    axios.get<AuditComparison>(`${CRE_BASE}/compliance/audit/${txHash}`, { params: { subject, nonce } }).then(r => r.data),

  // Feature 3: Revocation
  revoke:     (subject: string, nonce: string, reason?: string) =>
    axios.post<RevocationEvent>(`${CRE_BASE}/compliance/revoke`, { subject, nonce, reason }).then(r => r.data),
  revocations: () =>
    axios.get<{ events: RevocationEvent[] }>(`${CRE_BASE}/revocations`).then(r => r.data.events ?? []),

  // Feature 4: Scenarios
  runScenario: (scenarioId: ScenarioId) =>
    axios.post<ScenarioResult>(`${CRE_BASE}/scenarios/${scenarioId}`).then(r => r.data),

  // Feature 5: Gas trace
  trace:      (txHash: string) =>
    axios.get<GasBreakdown>(`${CRE_BASE}/vault/trace/${txHash}`).then(r => r.data),
};
