import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const CRE = "http://localhost:4000";
const DEPLOYER = "0xE8A457Ce1Ab8659a6410474dB5f1c6b070b98372";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const FORK_ID = process.env.TENDERLY_FORK_ID;

// ANSI colors
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  blue:   "\x1b[34m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  white:  "\x1b[37m",
  gray:   "\x1b[90m",
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function log(msg: string) { console.log(msg); }
function header(msg: string) {
  log("");
  log(`${C.bold}${C.blue}${'─'.repeat(60)}${C.reset}`);
  log(`${C.bold}${C.blue}  ${msg}${C.reset}`);
  log(`${C.bold}${C.blue}${'─'.repeat(60)}${C.reset}`);
}
function step(n: number, msg: string) {
  log(`\n${C.bold}${C.cyan}[${n}]${C.reset} ${C.white}${msg}${C.reset}`);
}
function ok(msg: string)   { log(`    ${C.green}✓${C.reset} ${msg}`); }
function fail(msg: string) { log(`    ${C.red}✗${C.reset} ${msg}`); }
function warn(msg: string) { log(`    ${C.yellow}⚠${C.reset} ${msg}`); }
function info(msg: string) { log(`    ${C.gray}${msg}${C.reset}`); }
function kv(k: string, v: string) { log(`    ${C.dim}${k}:${C.reset} ${C.white}${v}${C.reset}`); }

const SCENARIOS = [
  {
    name: "Tier-1 Institution (Goldman Sachs DID)",
    address: DEPLOYER,
    amount: 50000,
    deposit: true,
    expectStatus: "CLEARED",
  },
  {
    name: "Mid-Market Fund (Bridgewater DID)",
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    amount: 25000,
    deposit: false,
    expectStatus: "CLEARED",
  },
  {
    name: "OFAC Sanctioned Entity",
    address: "0x0000000000000000000000000000000000000001",
    amount: 100000,
    deposit: false,
    expectStatus: "BLOCKED",
  },
  {
    name: "Tornado Cash Mixer Wallet",
    address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    amount: 50000,
    deposit: false,
    expectStatus: "HIGH_RISK",
  },
  {
    name: "Whale — Suspicious Large Transfer",
    address: "0x1234567890123456789012345678901234567890",
    amount: 15000000,
    deposit: false,
    expectStatus: "HIGH_RISK",
  },
  {
    name: "Second Deposit — Same Institution",
    address: DEPLOYER,
    amount: 25000,
    deposit: true,
    expectStatus: "CLEARED",
  },
];

async function checkHealth() {
  step(0, "Checking service health...");
  const [cre, aml] = await Promise.all([
    axios.get(`${CRE}/health`).catch(() => null),
    axios.get("http://localhost:4001/health").catch(() => null),
  ]);
  if (!cre) throw new Error("CRE not running on port 4000 — run: npm run dev");
  if (!aml) throw new Error("Mock AML not running on port 4001 — run: npm run dev");
  ok(`CRE Engine     — ${cre.data.amlProvider} | vault: ${cre.data.contracts?.vault?.slice(0,10)}...`);
  ok(`Mock AML       — online`);
  ok(`Tenderly Fork  — ${FORK_ID ?? "unknown"}`);
}

async function runScenario(i: number, scenario: typeof SCENARIOS[0]): Promise<{
  status: string; txHash?: string; riskScore?: number; gasUsed?: string;
}> {
  const emoji = scenario.expectStatus === "CLEARED" ? "🟢" :
                scenario.expectStatus === "BLOCKED" ? "🔴" : "🟡";

  step(i + 1, `${emoji}  ${scenario.name}`);
  info(`Address: ${scenario.address}`);
  info(`Amount:  ${scenario.amount.toLocaleString()} USDC`);

  if (scenario.deposit) {
    // Full deposit relay
    const r = await axios.post(`${CRE}/api/v1/compliance/deposit`, {
      address: scenario.address,
      amount: scenario.amount,
      institutionPrivateKey: DEPLOYER_KEY,
    }).catch(e => e.response ?? { data: { status: "FAILED", message: e.message } });
    const d = r.data;
    if (d.status === "SETTLED") {
      ok(`SETTLED on-chain`);
      kv("tx",    d.txHash);
      kv("block", String(d.blockNumber));
      kv("gas",   Number(d.gasUsed).toLocaleString());
      kv("vault balance", `${Number(d.vaultBalance).toLocaleString()} USDC`);
      if (FORK_ID) {
        kv("tenderly", `https://dashboard.tenderly.co/tx/${d.txHash}`);
      }
    } else {
      fail(`Deposit failed: ${d.message ?? d.error}`);
    }
    return { status: d.status, txHash: d.txHash, gasUsed: d.gasUsed };
  } else {
    // Screen only
    const r = await axios.post(`${CRE}/api/v1/compliance/screen`, {
      address: scenario.address,
      amount: scenario.amount,
    }).catch(e => e.response ?? { data: { status: "ERROR", alerts: [e.message] } });
    const d = r.data;
    if (d.status === "CLEARED") {
      ok(`CLEARED — attestation issued`);
      kv("DID",        d.did ?? "not registered");
      kv("risk score", String(d.riskScore));
      kv("provider",   d.amlProvider);
      kv("expiry",     new Date(Number(d.attestation?.expiry) * 1000).toISOString());
    } else if (d.status === "BLOCKED") {
      fail(`BLOCKED — ${(d.alerts ?? []).join(", ") || "OFAC match"}`);
    } else {
      warn(`HIGH_RISK — score: ${d.riskScore} | alerts: ${(d.alerts ?? []).join(", ")}`);
    }
    return { status: d.status, riskScore: d.riskScore };
  }
}

async function printSummary(results: any[], startTime: number) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  header("DEMO SUMMARY");

  const settled   = results.filter(r => r.status === "SETTLED");
  const cleared   = results.filter(r => r.status === "CLEARED");
  const blocked   = results.filter(r => r.status === "BLOCKED");
  const highRisk  = results.filter(r => r.status === "HIGH_RISK");

  log(`\n  ${C.green}${C.bold}${settled.length} deposits SETTLED on-chain${C.reset}`);
  log(`  ${C.green}${cleared.length + settled.length} addresses CLEARED${C.reset}`);
  log(`  ${C.red}${blocked.length} addresses BLOCKED${C.reset}`);
  log(`  ${C.yellow}${highRisk.length} addresses HIGH RISK${C.reset}`);
  log(`  ${C.dim}Total time: ${elapsed}s${C.reset}`);

  const txHashes = results.filter(r => r.txHash);
  if (txHashes.length > 0) {
    log(`\n  ${C.bold}${C.cyan}On-Chain Transactions:${C.reset}`);
    for (const r of txHashes) {
      log(`  ${C.blue}→${C.reset} https://dashboard.tenderly.co/tx/${r.txHash}`);
    }
  }

  log(`\n  ${C.bold}${C.cyan}Live Dashboard:${C.reset}`);
  log(`  ${C.blue}→${C.reset} http://localhost:3000`);
  log(`\n  ${C.bold}${C.cyan}CRE Audit Log:${C.reset}`);
  log(`  ${C.blue}→${C.reset} http://localhost:4000/api/v1/compliance/logs`);
  log("");
}

async function main() {
  console.clear();

  log(`${C.bold}${C.blue}`);
  log("  ╔══════════════════════════════════════════════════════════╗");
  log("  ║      ZK INSTITUTIONAL COMPLIANCE PROXY — LIVE DEMO      ║");
  log("  ║                                                          ║");
  log("  ║  Institution → CRE → AML → EIP-712 → PermissionedVault  ║");
  log("  ╚══════════════════════════════════════════════════════════╝");
  log(`${C.reset}`);

  const startTime = Date.now();

  try {
    await checkHealth();

    header("RUNNING COMPLIANCE SCENARIOS");
    log(`  ${C.dim}6 scenarios: 3 cleared (2 deposited), 1 blocked, 2 high-risk${C.reset}`);

    const results: any[] = [];
    for (let i = 0; i < SCENARIOS.length; i++) {
      const result = await runScenario(i, SCENARIOS[i]);
      results.push(result);
      if (i < SCENARIOS.length - 1) await sleep(1200);
    }

    await printSummary(results, startTime);

  } catch (err: any) {
    log(`\n${C.red}${C.bold}Demo failed: ${err.message}${C.reset}`);
    if (err.response?.data) {
      log(`${C.red}${JSON.stringify(err.response.data, null, 2)}${C.reset}`);
    }
    process.exit(1);
  }
}

main();
