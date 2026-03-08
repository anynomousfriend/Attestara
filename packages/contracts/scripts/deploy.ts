/**
 * deploy.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Deploys DIDRegistry, ComplianceAttestationVerifier, and PermissionedVault
 * to the Tenderly fork (or local hardhat network).
 * Writes all deployed addresses to ../../.env and ../../deployed.json.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

const ENV_PATH      = path.resolve(__dirname, "../../../.env");
const DEPLOYED_PATH = path.resolve(__dirname, "../../../deployed.json");

dotenv.config({ path: ENV_PATH, override: true });

function updateEnvFile(key: string, value: string) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, content);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n🚀 Deploying contracts with: ${deployer.address}`);
  console.log(`   Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // ── CRE Signer address ────────────────────────────────────────────────────
  // If not set, use the deployer as the CRE signer (dev mode)
  const creSignerAddress = process.env.CRE_SIGNER_ADDRESS || deployer.address;
  console.log(`   CRE Signer: ${creSignerAddress}`);

  // ── 1. Deploy DIDRegistry ─────────────────────────────────────────────────
  console.log("\n📋 Deploying DIDRegistry...");
  const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy();
  await didRegistry.waitForDeployment();
  const didRegistryAddress = await didRegistry.getAddress();
  console.log(`   ✅ DIDRegistry: ${didRegistryAddress}`);

  // ── 2. Deploy ComplianceAttestationVerifier ───────────────────────────────
  console.log("\n🔐 Deploying ComplianceAttestationVerifier...");
  const Verifier = await ethers.getContractFactory("ComplianceAttestationVerifier");
  const verifier = await Verifier.deploy(creSignerAddress);
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`   ✅ ComplianceAttestationVerifier: ${verifierAddress}`);

  // ── 3. Deploy PermissionedVault ───────────────────────────────────────────
  // Use USDC on mainnet fork, fallback to a mock ERC20 address for local
  const usdcAddress = process.env.USDC_ADDRESS || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  console.log(`\n🏦 Deploying PermissionedVault (asset: USDC ${usdcAddress})...`);
  const Vault = await ethers.getContractFactory("PermissionedVault");
  const vault = await Vault.deploy(usdcAddress, verifierAddress, didRegistryAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`   ✅ PermissionedVault: ${vaultAddress}`);

  // ── 4. Persist addresses ───────────────────────────────────────────────────
  const deployed = {
    network:        (await ethers.provider.getNetwork()).name,
    chainId:        (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt:     new Date().toISOString(),
    deployer:       deployer.address,
    creSignerAddress,
    contracts: {
      DIDRegistry:                   didRegistryAddress,
      ComplianceAttestationVerifier: verifierAddress,
      PermissionedVault:             vaultAddress,
    },
    external: {
      USDC:          usdcAddress,
      AaveArcPool:   process.env.AAVE_ARC_LENDING_POOL || "",
      AaveArcPermMgr: process.env.AAVE_ARC_PERMISSION_MANAGER || "",
    },
  };

  fs.writeFileSync(DEPLOYED_PATH, JSON.stringify(deployed, null, 2));
  console.log(`\n📄 Deployed addresses saved to deployed.json`);

  updateEnvFile("DID_REGISTRY_ADDRESS", didRegistryAddress);
  updateEnvFile("VERIFIER_ADDRESS", verifierAddress);
  updateEnvFile("VAULT_ADDRESS", vaultAddress);

  console.log("\n✅ All contracts deployed successfully!\n");
  console.log("Addresses:");
  console.log(`  DIDRegistry:                   ${didRegistryAddress}`);
  console.log(`  ComplianceAttestationVerifier: ${verifierAddress}`);
  console.log(`  PermissionedVault:             ${vaultAddress}`);
  console.log(`\nNext: start the CRE — 'npm run dev -w packages/cre'\n`);
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
