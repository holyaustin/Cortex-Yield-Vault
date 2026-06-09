import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

async function main() {
  console.log(`\n🧠 Deploying Cortex Yield Vault to ${networkName}...`);
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`\n📡 Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} STT`);

  // Use existing strategy address
  const strategyAddress = "0x7f8937232BDc40aa8dc19Fc2B845AfF6C7cf0B4F";
  console.log(`\n🏦 Using existing strategy: ${strategyAddress}`);

  // Deploy CortexYieldVault
  console.log("\n📄 Deploying CortexYieldVault...");
  const Vault = await ethers.getContractFactory("CortexYieldVault");
  const vault = await Vault.deploy(strategyAddress);
  console.log("⏳ Waiting for deployment tx to confirm...");
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`✅ CortexYieldVault address: ${vaultAddress}`);

  const deploymentTx = vault.deploymentTransaction();
  console.log(`\n🔗 Deployment Tx: ${deploymentTx?.hash}`);

  // Get platform's reserve to verify
  const platform = await ethers.getContractAt("IAgentRequester", "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776");
  const reserve = await platform.getRequestDeposit();
  const requiredDeposit = await vault.getRequiredDeposit();
  
  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(60));
  console.log(`Network: ${networkName}`);
  console.log(`Vault:   ${vaultAddress}`);
  console.log(`Owner:   ${deployer.address}`);
  console.log(`\n🔧 Deposit Calculation:`);
  console.log(`   Platform reserve:     ${ethers.formatEther(reserve)} STT`);
  console.log(`   LLM per-agent price:  0.07 STT`);
  console.log(`   Subcommittee size:    3`);
  console.log(`   Required deposit:     ${ethers.formatEther(requiredDeposit)} STT`);
  console.log(`   Formula: reserve + (0.07 * 3) = ${ethers.formatEther(reserve)} + 0.21 = ${ethers.formatEther(requiredDeposit)}`);

  console.log("\n✅ Deployment successful!");
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:", error);
  process.exitCode = 1;
});