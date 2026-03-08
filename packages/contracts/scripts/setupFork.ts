/**
 * setupFork.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Creates a Tenderly Virtual TestNet fork of Sepolia (latest block).
 * 2. Funds the deployer wallet with ETH via Tenderly's setBalance.
 * 3. Writes TENDERLY_VIRTUAL_SEPOLIA_RPC to ../../.env so hardhat picks it up
 *    automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ── Tenderly config ──────────────────────────────────────────────────────────
const TENDERLY_API_KEY = process.env.TENDERLY_API_KEY!;
const TENDERLY_ACCOUNT = process.env.TENDERLY_ACCOUNT_SLUG!;
const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT_SLUG!;

const ENV_PATH = path.resolve(__dirname, "../../../.env");

// ── Helpers ──────────────────────────────────────────────────────────────────
function tenderlyHeaders() {
  return {
    "X-Access-Key": TENDERLY_API_KEY,
    "Content-Type": "application/json",
  };
}

async function setBalance(rpcUrl: string, address: string, hexBalance: string) {
  await axios.post(rpcUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "tenderly_setBalance",
    params: [[address], hexBalance],
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
  console.log("🔧 Creating Tenderly Virtual TestNet fork of Sepolia...\n");

  if (!TENDERLY_API_KEY || !TENDERLY_ACCOUNT || !TENDERLY_PROJECT) {
    throw new Error(
      "Missing Tenderly env vars. Set TENDERLY_API_KEY, TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG in .env"
    );
  }

  // ── Step 1: Create Virtual TestNet (Sepolia fork) ────────────────────────
  const createRes = await axios.post(
    `https://api.tenderly.co/api/v1/account/${TENDERLY_ACCOUNT}/project/${TENDERLY_PROJECT}/vnets`,
    {
      slug: `attestara-sepolia-${Date.now()}`,
      display_name: "Attestara Sepolia Fork",
      fork_config: {
        network_id: 1,        // Mainnet
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

  const vnet = createRes.data;
  const forkId = vnet.id;
  // The admin RPC is used for privileged ops (setBalance, etc.)
  const adminRpc = vnet.rpcs?.find((r: any) => r.name === "Admin RPC")?.url
    || vnet.rpcs?.[0]?.url;
  const publicRpc = vnet.rpcs?.find((r: any) => r.name === "Public RPC")?.url
    || vnet.rpcs?.[0]?.url;

  console.log(`✅ Sepolia fork created: ${forkId}`);
  console.log(`   Admin RPC:  ${adminRpc}`);
  console.log(`   Public RPC: ${publicRpc}\n`);

  // ── Step 2: Fund the deployer with 100 ETH (VETH) ───────────────────────
  const deployerAddress = process.env.DEPLOYER_ADDRESS!;
  if (deployerAddress) {
    console.log(`💰 Funding deployer ${deployerAddress} with 100 VETH...`);
    await setBalance(adminRpc, deployerAddress, "0x56BC75E2D63100000"); // 100 ETH
    console.log("   ✅ VETH funded\n");
  }

  // ── Step 3: Write env vars ────────────────────────────────────────────────
  updateEnvFile("TENDERLY_VIRTUAL_SEPOLIA_RPC", adminRpc);
  updateEnvFile("TENDERLY_FORK_RPC", adminRpc);    // backward compat for CRE
  updateEnvFile("TENDERLY_FORK_ID", forkId);
  updateEnvFile("TENDERLY_PUBLIC_RPC", publicRpc);
  updateEnvFile("CHAIN_ID", "1");

  console.log("📝 .env updated with Sepolia fork RPC and addresses");
  console.log("\n🎉 Tenderly Sepolia fork setup complete!");
  console.log(`\nNext: run 'npm run deploy -w packages/contracts' to deploy contracts to the fork.\n`);

  return { forkId, adminRpc, publicRpc };
}

main().catch((err) => {
  console.error("❌ Fork setup failed:", err.response?.data || err.message);
  process.exit(1);
});
