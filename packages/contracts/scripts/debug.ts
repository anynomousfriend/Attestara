import { ethers, network } from "hardhat";
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Address:", deployer.address);
  console.log("URL:", (network.config as any).url);
  console.log("Balance:", await ethers.provider.getBalance(deployer.address));
}
main();
