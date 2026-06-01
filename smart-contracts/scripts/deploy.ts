import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

async function main() {
  console.log(`Deploying CortexYieldVault to ${networkName}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "STT");

  // --- Deploy SimpleYieldStrategy ---
  console.log("\n📄 Deploying SimpleYieldStrategy...");
  const strategy = await ethers.deployContract("SimpleYieldStrategy");
  console.log("Waiting for the deployment tx to confirm");
  await strategy.waitForDeployment();
  const strategyAddress = await strategy.getAddress();
  console.log("✅ SimpleYieldStrategy address:", strategyAddress);

  // --- Deploy CortexYieldVault ---
  console.log("\n📄 Deploying CortexYieldVault...");
  const vault = await ethers.deployContract("CortexYieldVault", [strategyAddress]);
  console.log("Waiting for the deployment tx to confirm");
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ CortexYieldVault address:", vaultAddress);
  
  const deploymentTx = vault.deploymentTransaction();
  console.log("Deployment Tx:", deploymentTx?.hash);

  console.log("\n📋 Deployment Summary:");
  console.log("======================");
  console.log("Network:", networkName);
  console.log("Strategy Contract:", strategyAddress);
  console.log("Vault Contract:", vaultAddress);
  console.log("Owner:", deployer.address);
  console.log("Block:", await ethers.provider.getBlockNumber());
  
  console.log("\n🔗 Explorer URL for Vault:", `https://testnet-explorer.somnia.network/address/${vaultAddress}`);
  console.log("\nDeployment successful!");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});