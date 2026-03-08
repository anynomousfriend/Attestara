import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    virtual_sepolia: {
      url: process.env.TENDERLY_VIRTUAL_SEPOLIA_RPC || "https://virtual.sepolia.eu.rpc.tenderly.co/40d1fc66-93b4-4a0e-9331-df906ca3cf6f",
      // chainId: 11155111,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    my_fork: {
      url: process.env.TENDERLY_VIRTUAL_SEPOLIA_RPC || "https://virtual.sepolia.eu.rpc.tenderly.co/40d1fc66-93b4-4a0e-9331-df906ca3cf6f",
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  tenderly: {
    // https://docs.tenderly.co/account/projects/account-project-slug
    project: process.env.TENDERLY_PROJECT_SLUG || "project",
    username: process.env.TENDERLY_ACCOUNT_SLUG || "subhankar",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
