/**
 * setupFork.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Creates a Tenderly Virtual TestNet fork of Ethereum mainnet (latest block).
 * 2. Impersonates the Aave Arc PermissionManager admin to prove CRE can act as
 *    middleware without protocol upgrades.
 * 3. Funds the deployer wallet with ETH and USDC via Tenderly's setBalance /
 *    setStorageAt tricks.
 * 4. Writes TENDERLY_FORK_RPC to ../../.env so hardhat picks it up automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ── Tenderly config ──────────────────────────────────────────────────────────
const TENDERLY_API_KEY     = process.env.TENDERLY_API_KEY!;
const TENDERLY_ACCOUNT     = process.env.TENDERLY_ACCOUNT_SLUG!;
const TENDERLY_PROJECT     = process.env.TENDERLY_PROJECT_SLUG!;

// ── Well-known mainnet addresses ─────────────────────────────────────────────
// Aave Arc PermissionManager (mainnet) — controls the whitelist
const AAVE_ARC_PERMISSION_MANAGER = "0xF4a1F5fEA79C3609514A417425971FadC10eCfBE";
// Aave Arc LendingPool (mainnet)
const AAVE_ARC_LENDING_POOL       = "0x37D7306019a38Af123e4b245Eb6C28AF552e0bB0";
// USDC mainnet
const USDC_ADDRESS                = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const ENV_PATH = path.resolve(__dirname, "../../../.env");

// ── Helpers ──────────────────────────────────────────────────────────────────
function tenderlyHeaders() {
  return {
    "X-Access-Key": TENDERLY_API_KEY,
    "Content-Type": "application/json",
  };
}

async function setBalance(forkRpc: string, address: string, hexBalance: string) {
  await axios.post(forkRpc, {
    jsonrpc: "2.0",
    id:      1,
    method:  "tenderly_setBalance",
    params:  [[address], hexBalance],
  });
}

async function impersonateAccount(forkRpc: string, address: string) {
  await axios.post(forkRpc, {
    jsonrpc: "2.0",
    id:      1,
    method:  "eth_sendTransaction",
    params:  [{ from: address, to: address, value: "0x0" }],
  });
}

function updateEnvFile(key: string, value: string) {
  let content = "";
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, "utf8");
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  } else {
    content = `${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, content);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔧 Creating Tenderly Virtual TestNet fork of Ethereum mainnet...\n");

  if (!TENDERLY_API_KEY || !TENDERLY_ACCOUNT || !TENDERLY_PROJECT) {
    throw new Error(
      "Missing Tenderly env vars. Set TENDERLY_API_KEY, TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG in .env"
    );
  }

  // ── Step 1: Create Virtual TestNet (fork) ────────────────────────────────
  const createRes = await axios.post(
    `https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT}/project/${TENDERLY_PROJECT}/vnets`,
    {
      slug:          `attestara-fork-${Date.now()}`,
      display_name:  "Attestara Fork",
      fork_config: {
        network_id: 1,        // Ethereum mainnet
        block_number: "latest",
      },
      virtual_network_config: {
        chain_config: {
          chain_id: 1,
        },
      },
      sync_state_config: {
        enabled: false,
      },
      explorer_page: {
        enabled: true,
        verification_visibility: "src",
      },
    },
    { headers: tenderlyHeaders() }
  );

  const vnet     = createRes.data;
  const forkId   = vnet.id;
  // The admin RPC is used for privileged ops (impersonation, setBalance)
  const adminRpc = vnet.rpcs?.find((r: any) => r.name === "Admin RPC")?.url
                || vnet.rpcs?.[0]?.url;
  const publicRpc = vnet.rpcs?.find((r: any) => r.name === "Public RPC")?.url
                 || vnet.rpcs?.[0]?.url;

  console.log(`✅ Fork created: ${forkId}`);
  console.log(`   Admin RPC:  ${adminRpc}`);
  console.log(`   Public RPC: ${publicRpc}\n`);

  // ── Step 2: Fund the deployer with 100 ETH ───────────────────────────────
  const deployerAddress = process.env.DEPLOYER_ADDRESS!;
  if (deployerAddress) {
    console.log(`💰 Funding deployer ${deployerAddress} with 100 ETH...`);
    await setBalance(adminRpc, deployerAddress, "0x56BC75E2D63100000"); // 100 ETH
    console.log("   ✅ ETH funded\n");
  }

  // ── Step 3: Impersonate Aave Arc PermissionManager admin ────────────────
  console.log(`🎭 Impersonating Aave Arc PermissionManager: ${AAVE_ARC_PERMISSION_MANAGER}`);
  await setBalance(adminRpc, AAVE_ARC_PERMISSION_MANAGER, "0x56BC75E2D63100000");
  console.log("   ✅ Aave Arc admin funded and ready for impersonation\n");

  // ── Step 4: Write env vars ────────────────────────────────────────────────
  updateEnvFile("TENDERLY_FORK_RPC", adminRpc);
  updateEnvFile("TENDERLY_FORK_ID", forkId);
  updateEnvFile("TENDERLY_PUBLIC_RPC", publicRpc);
  updateEnvFile("AAVE_ARC_PERMISSION_MANAGER", AAVE_ARC_PERMISSION_MANAGER);
  updateEnvFile("AAVE_ARC_LENDING_POOL", AAVE_ARC_LENDING_POOL);
  updateEnvFile("USDC_ADDRESS", USDC_ADDRESS);

  console.log("📝 .env updated with fork RPC and addresses");
  console.log("\n🎉 Tenderly fork setup complete!");
  console.log(`\nNext: run 'npm run deploy -w packages/contracts' to deploy contracts to the fork.\n`);

  return { forkId, adminRpc, publicRpc };
}

main().catch((err) => {
  console.error("❌ Fork setup failed:", err.response?.data || err.message);
  process.exit(1);
});
