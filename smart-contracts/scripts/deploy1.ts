import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

async function main() {
  console.log(`Deploying ReferralDynasty to ${networkName}...`);

  // Get the deployer address for logging
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "STT");

  // Deploy contract using the helper
  console.log("\n📄 Deploying contract...");
  const referralDynasty = await ethers.deployContract("ReferralDynasty");

  console.log("Waiting for the deployment tx to confirm");
  await referralDynasty.waitForDeployment();

  const address = await referralDynasty.getAddress();
  console.log("✅ ReferralDynasty address:", address);
  
  // Get deployment transaction
  const deploymentTx = referralDynasty.deploymentTransaction();
  console.log("Deployment Tx:", deploymentTx?.hash);
  
  // Set contract as trusted emitter for itself
  console.log("\n🔧 Configuring contract...");
  const setEmitterTx = await referralDynasty.setTrustedEmitter(address, true);
  await setEmitterTx.wait();
  console.log("✅ Contract set as trusted emitter");

  console.log("\n📋 Deployment Summary:");
  console.log("======================");
  console.log("Network:", networkName);
  console.log("Contract:", address);
  console.log("Owner:", deployer.address);
  console.log("Block:", await ethers.provider.getBlockNumber());
  
  console.log("\n🔗 Explorer URL:", `https://testnet-explorer.somnia.network/address/${address}`);
  console.log("\nDeployment successful!");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});