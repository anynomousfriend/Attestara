/**
 * setupDepositor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-shot script that prepares the deployer wallet for end-to-end deposits:
 *   1. Funds deployer with USDC by impersonating a known USDC whale on the fork
 *   2. Registers the deployer's DID on-chain via DIDRegistry
 *
 * Run: npx hardhat run scripts/setupDepositor.ts --network tenderly
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Known USDC whale on mainnet (Circle's treasury / large holder)
const USDC_WHALE      = "0x55FE002aefF02F77364de339a1292923A15844B8"; // Circle
const USDC_ADDRESS    = process.env.USDC_ADDRESS || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_AMOUNT     = ethers.parseUnits("1000000", 6); // 1M USDC
const DID_REGISTRY    = process.env.DID_REGISTRY_ADDRESS!;
const DEPLOYER_KEY    = process.env.DEPLOYER_PRIVATE_KEY!;
const RPC_URL         = process.env.TENDERLY_FORK_RPC!;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const DID_REGISTRY_ABI = [
  "function register(string did, bytes32 documentHash, string serviceEndpoint) external",
  "function isRegistered(address owner) view returns (bool)",
  "function resolve(address owner) view returns (tuple(string did, bytes32 documentHash, string serviceEndpoint, uint256 registeredAt, uint256 updatedAt, bool active))",
];

async function main() {
  const provider  = new ethers.JsonRpcProvider(RPC_URL);
  const deployer  = new ethers.Wallet(DEPLOYER_KEY, provider);

  console.log("\n🚀 Setting up depositor wallet...");
  console.log(`   Deployer: ${deployer.address}`);

  // ── Step 1: Fund with USDC via impersonation ────────────────────────────────
  console.log("\n📦 Step 1: Funding with USDC via whale impersonation...");

  // Use Tenderly's native ERC20 balance setter — no impersonation needed
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, deployer);

  await provider.send("tenderly_setErc20Balance", [
    USDC_ADDRESS,
    deployer.address,
    ethers.toQuantity(USDC_AMOUNT),
  ]);

  const deployerBal = await usdc.balanceOf(deployer.address);
  console.log(`   ✅ Deployer USDC balance: ${ethers.formatUnits(deployerBal, 6)} USDC`);

  // ── Step 2: Register DID ────────────────────────────────────────────────────
  console.log("\n🪪  Step 2: Registering DID on-chain...");

  const registry = new ethers.Contract(DID_REGISTRY, DID_REGISTRY_ABI, deployer);

  const alreadyRegistered = await registry.isRegistered(deployer.address);
  if (alreadyRegistered) {
    const doc = await registry.resolve(deployer.address);
    console.log(`   ℹ️  Already registered: ${doc.did}`);
  } else {
    const did             = `did:ethr:${deployer.address.toLowerCase()}`;
    const documentHash    = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ did, controller: deployer.address })));
    const serviceEndpoint = "https://cre.example.com/did";

    const tx2 = await registry.register(did, documentHash, serviceEndpoint);
    await tx2.wait();

    const doc = await registry.resolve(deployer.address);
    console.log(`   ✅ DID registered: ${doc.did}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const finalUSDC = await usdc.balanceOf(deployer.address);
  const finalETH  = await provider.getBalance(deployer.address);

  console.log("\n✅ Depositor ready!");
  console.log(`   Address:      ${deployer.address}`);
  console.log(`   ETH balance:  ${ethers.formatEther(finalETH)} ETH`);
  console.log(`   USDC balance: ${ethers.formatUnits(finalUSDC, 6)} USDC`);
  console.log(`   Private key:  ${DEPLOYER_KEY}`);
  console.log("\n   Use the deployer private key in the UI to execute on-chain deposits.\n");
}

main().catch((err) => {
  console.error("❌ Setup failed:", err.message);
  process.exit(1);
});
