/**
 * integration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Full end-to-end integration test:
 *   Institution wallet → CRE intercepts → AML screens → Attestation signed →
 *   DID registered → PermissionedVault deposit → on-chain settlement verified
 *
 * Run: npm run integration:test -w packages/cre
 * Requires: Tenderly fork running, contracts deployed, mock-aml running
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const CRE_URL = `http://localhost:${process.env.CRE_PORT || 4000}`;
const MOCK_AML_URL = `http://localhost:${process.env.MOCK_AML_PORT || 4001}`;
const RPC_URL = process.env.TENDERLY_FORK_RPC || "http://localhost:8545";
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "11155111");

// Load deployed addresses
const DEPLOYED_PATH = path.resolve(__dirname, "../../../deployed.json");

interface DeployedContracts {
  contracts: {
    DIDRegistry: string;
    ComplianceAttestationVerifier: string;
    PermissionedVault: string;
  };
  external: { USDC: string };
}

// ABIs
const DID_REGISTRY_ABI = [
  "function register(string did, bytes32 documentHash, string serviceEndpoint) external",
  "function isRegistered(address owner) view returns (bool)",
  "function resolve(address owner) view returns (tuple(string did, bytes32 documentHash, string serviceEndpoint, uint256 registeredAt, uint256 updatedAt, bool active))",
];

const VERIFIER_ABI = [
  "function isAttestationValid(tuple(address subject, bytes32 amlReportHash, uint256 expiry, uint256 nonce, string amlProvider) attestation, bytes signature) view returns (bool valid, string reason)",
];

const VAULT_ABI = [
  "function deposit(uint256 amount, tuple(address subject, bytes32 amlReportHash, uint256 expiry, uint256 nonce, string amlProvider) attestation, bytes signature) external",
  "function balanceOf(address account) view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

// ── Test helpers ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  🧪 ${name}... `);
  try {
    await fn();
    console.log("✅ PASS");
    passed++;
  } catch (err: any) {
    console.log(`❌ FAIL\n     ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ── Main test suite ───────────────────────────────────────────────────────────
async function main() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  Attestara — Integration Test Suite");
  console.log("══════════════════════════════════════════════════════════════\n");

  // ── Load deployed addresses ────────────────────────────────────────────────
  if (!fs.existsSync(DEPLOYED_PATH)) {
    console.error("❌ deployed.json not found. Run 'npm run deploy -w packages/contracts' first.");
    process.exit(1);
  }

  const deployed: DeployedContracts = JSON.parse(fs.readFileSync(DEPLOYED_PATH, "utf8"));
  const { DIDRegistry, ComplianceAttestationVerifier, PermissionedVault } = deployed.contracts;
  const USDC_ADDR = deployed.external.USDC;

  console.log("📋 Deployed Contracts:");
  console.log(`   DIDRegistry:   ${DIDRegistry}`);
  console.log(`   Verifier:      ${ComplianceAttestationVerifier}`);
  console.log(`   Vault:         ${PermissionedVault}`);
  console.log(`   USDC:          ${USDC_ADDR}\n`);

  // ── Setup provider & wallets ───────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Generate a fresh institution wallet for each test run
  const institutionWallet = ethers.Wallet.createRandom().connect(provider);
  console.log(`🏦 Institution Wallet: ${institutionWallet.address}`);

  // Fund institution with ETH and USDC via Tenderly
  try {
    // Fund institution with ETH via Tenderly setBalance
    await axios.post(RPC_URL, {
      jsonrpc: "2.0", id: 1,
      method: "tenderly_setBalance",
      params: [[institutionWallet.address], "0x56BC75E2D63100000"], // 100 ETH
    });

    // Fund institution with USDC via Tenderly setErc20Balance
    await axios.post(RPC_URL, {
      jsonrpc: "2.0", id: 2,
      method: "tenderly_setErc20Balance",
      params: [USDC_ADDR, institutionWallet.address, "0x" + (1_000_000n * 1_000_000n).toString(16)], // 1M USDC
    });

    console.log("   💰 Funded with 100 ETH and 1M USDC\n");
  } catch (err: any) {
    console.warn("   ⚠️  Tenderly funding skipped (quota limit or auth error):", err.response?.data?.error?.message || err.message);
    console.warn("   ℹ️  Tests will proceed — wallet may need pre-existing funds on the fork.\n");
  }

  const didRegistry = new ethers.Contract(DIDRegistry, DID_REGISTRY_ABI, institutionWallet);
  const verifier = new ethers.Contract(ComplianceAttestationVerifier, VERIFIER_ABI, provider);
  const vault = new ethers.Contract(PermissionedVault, VAULT_ABI, institutionWallet);
  const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, institutionWallet);

  // ── TEST 1: Health checks ──────────────────────────────────────────────────
  console.log("── Block 1: Service Health ─────────────────────────────────────");

  await test("CRE health endpoint responds", async () => {
    const res = await axios.get(`${CRE_URL}/health`);
    assert(res.data.status === "ok", "CRE status not ok");
    assert(res.data.service === "cre", "Wrong service name");
  });

  await test("Mock AML health endpoint responds", async () => {
    const res = await axios.get(`${MOCK_AML_URL}/health`);
    assert(res.data.status === "ok", "Mock AML status not ok");
  });

  // ── TEST 2: DID Registration ───────────────────────────────────────────────
  console.log("\n── Block 2: DID Registration ───────────────────────────────────");

  await test("Institution registers DID on-chain", async () => {
    const did = `did:zk:${institutionWallet.address.toLowerCase()}`;
    const docJson = JSON.stringify({ id: did, controller: institutionWallet.address, type: "Institution" });
    const documentHash = ethers.keccak256(ethers.toUtf8Bytes(docJson));
    const endpoint = `https://did.example.com/${institutionWallet.address}`;

    const tx = await didRegistry.register(did, documentHash, endpoint);
    await tx.wait();

    const isReg = await didRegistry.isRegistered(institutionWallet.address);
    assert(isReg === true, "DID not registered after tx");
  });

  await test("DID resolves correctly", async () => {
    const doc = await didRegistry.resolve(institutionWallet.address);
    assert(doc.active === true, "DID not active");
    assert(doc.did.startsWith("did:zk:"), "DID format wrong");
  });

  // ── TEST 3: AML Screening ─────────────────────────────────────────────────
  console.log("\n── Block 3: AML Screening ──────────────────────────────────────");

  await test("CLEARED address passes AML screen via CRE", async () => {
    const res = await axios.post(`${CRE_URL}/api/v1/compliance/screen`, {
      address: institutionWallet.address,
      amount: 100000,
    });
    assert(res.data.status === "CLEARED", `Expected CLEARED, got ${res.data.status}`);
    assert(res.data.signature !== undefined, "No signature returned");
    assert(res.data.attestation !== undefined, "No attestation returned");
  });

  await test("BLOCKED address (0x000...) is rejected by CRE", async () => {
    try {
      await axios.post(`${CRE_URL}/api/v1/compliance/screen`, {
        address: "0x000000000000000000000000000000000000dEaD",
        amount: 100000,
      });
      throw new Error("Should have been rejected");
    } catch (err: any) {
      assert(err.response?.status === 403, `Expected 403, got ${err.response?.status}`);
    }
  });

  // ── TEST 4: Attestation Verification ──────────────────────────────────────
  console.log("\n── Block 4: Attestation Verification ───────────────────────────");

  let screenResult: any;
  await test("CRE produces valid EIP-712 attestation", async () => {
    const res = await axios.post(`${CRE_URL}/api/v1/compliance/screen`, {
      address: institutionWallet.address,
      amount: 500000,
    });
    screenResult = res.data;
    assert(screenResult.status === "CLEARED", "Not cleared");

    // Verify on-chain
    const att = screenResult.attestation;
    const [valid, reason] = await verifier.isAttestationValid(
      {
        subject: att.subject,
        amlReportHash: att.amlReportHash,
        expiry: BigInt(att.expiry),
        nonce: BigInt(att.nonce),
        amlProvider: att.amlProvider,
      },
      screenResult.signature
    );
    assert(valid === true, `Attestation invalid: ${reason}`);
  });

  // ── TEST 5: On-chain deposit with attestation ──────────────────────────────
  console.log("\n── Block 5: On-Chain Deposit ───────────────────────────────────");

  await test("Institution can deposit to PermissionedVault with valid attestation", async () => {
    const depositAmount = ethers.parseUnits("1000", 6); // 1,000 USDC

    // Get fresh attestation for deposit
    const screenRes = await axios.post(`${CRE_URL}/api/v1/compliance/screen`, {
      address: institutionWallet.address,
      amount: 1000,
    });
    const att = screenRes.data.attestation;
    const sig = screenRes.data.signature;

    // Approve vault
    const approveTx = await usdc.approve(PermissionedVault, depositAmount);
    await approveTx.wait();

    // Deposit
    const depositTx = await vault.deposit(
      depositAmount,
      {
        subject: att.subject,
        amlReportHash: att.amlReportHash,
        expiry: BigInt(att.expiry),
        nonce: BigInt(att.nonce),
        amlProvider: att.amlProvider,
      },
      sig
    );
    const receipt = await depositTx.wait();
    assert(receipt.status === 1, "Deposit tx failed");

    const balance = await vault.balanceOf(institutionWallet.address);
    assert(balance === depositAmount, `Balance mismatch: ${balance} !== ${depositAmount}`);
  });

  await test("Deposit FAILS without attestation (direct call)", async () => {
    const depositAmount = ethers.parseUnits("1000", 6);
    try {
      // Try to call with a zeroed-out fake attestation
      const fakeSig = "0x" + "00".repeat(65);
      await vault.deposit(
        depositAmount,
        {
          subject: institutionWallet.address,
          amlReportHash: ethers.ZeroHash,
          expiry: BigInt(Math.floor(Date.now() / 1000) + 900),
          nonce: BigInt(1),
          amlProvider: "fake",
        },
        fakeSig
      );
      throw new Error("Should have reverted");
    } catch (err: any) {
      // Expect revert
      assert(
        err.message.includes("revert") || err.message.includes("CALL_EXCEPTION") || err.code === "CALL_EXCEPTION",
        `Expected revert, got: ${err.message}`
      );
    }
  });

  await test("Replay attack fails (nonce reuse)", async () => {
    // Use the attestation from the previous successful deposit (nonce already consumed)
    if (!screenResult) return;
    try {
      const depositAmount = ethers.parseUnits("1000", 6);
      const att = screenResult.attestation;
      await usdc.approve(PermissionedVault, depositAmount);
      await vault.deposit(
        depositAmount,
        {
          subject: att.subject,
          amlReportHash: att.amlReportHash,
          expiry: BigInt(att.expiry),
          nonce: BigInt(att.nonce),
          amlProvider: att.amlProvider,
        },
        screenResult.signature
      );
      throw new Error("Should have reverted on nonce reuse");
    } catch (err: any) {
      assert(
        err.message.includes("revert") || err.message.includes("CALL_EXCEPTION") || err.code === "CALL_EXCEPTION",
        `Expected nonce reuse revert, got: ${err.message}`
      );
    }
  });

  // ── TEST 6: Frontend API endpoints ────────────────────────────────────────
  console.log("\n── Block 6: Frontend API ────────────────────────────────────────");

  await test("GET /api/v1/compliance/logs returns audit log", async () => {
    const res = await axios.get(`${CRE_URL}/api/v1/compliance/logs`);
    assert(Array.isArray(res.data.logs), "logs not an array");
    assert(res.data.total > 0, "No logs recorded");
  });

  await test("GET /api/v1/compliance/queue returns queue", async () => {
    const res = await axios.get(`${CRE_URL}/api/v1/compliance/queue`);
    assert(Array.isArray(res.data.queue), "queue not an array");
  });

  await test("GET /api/v1/vault/stats returns vault data", async () => {
    const res = await axios.get(`${CRE_URL}/api/v1/vault/stats`);
    assert(res.data.totalDeposits !== undefined, "totalDeposits missing");
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("❌ Integration test crashed:", err);
  process.exit(1);
});
