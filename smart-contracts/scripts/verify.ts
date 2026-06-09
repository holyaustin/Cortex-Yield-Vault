import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

// Update these addresses after deployment
const STRATEGY_ADDRESS = "0x7f8937232BDc40aa8dc19Fc2B845AfF6C7cf0B4F";
const VAULT_ADDRESS = "0xB4b88D45A0CbB22BcA147E4278965151D57F016E";

async function main() {
  console.log(`\n🔍 Verifying contracts on ${networkName}...`);
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`\n📡 Verifier address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} STT`);

  console.log("\n📝 Contract Addresses to verify:");
  console.log(`   SimpleYieldStrategy: ${STRATEGY_ADDRESS}`);
  console.log(`   CortexYieldVault:    ${VAULT_ADDRESS}`);

  // --- Verify SimpleYieldStrategy ---
  console.log("\n📄 Verifying SimpleYieldStrategy...");
  try {
    await ethers.verify(STRATEGY_ADDRESS, []);
    console.log(`✅ SimpleYieldStrategy verified: ${STRATEGY_ADDRESS}`);
  } catch (error: any) {
    if (error.message?.includes("Already Verified") || error.message?.includes("already verified")) {
      console.log(`⚠️ SimpleYieldStrategy already verified: ${STRATEGY_ADDRESS}`);
    } else {
      console.error("❌ SimpleYieldStrategy verification failed:", error.message || error);
    }
  }

  // --- Verify CortexYieldVault ---
  console.log("\n📄 Verifying CortexYieldVault...");
  try {
    await ethers.verify(VAULT_ADDRESS, [STRATEGY_ADDRESS]);
    console.log(`✅ CortexYieldVault verified: ${VAULT_ADDRESS}`);
  } catch (error: any) {
    if (error.message?.includes("Already Verified") || error.message?.includes("already verified")) {
      console.log(`⚠️ CortexYieldVault already verified: ${VAULT_ADDRESS}`);
    } else {
      console.error("❌ CortexYieldVault verification failed:", error.message || error);
    }
  }

  console.log("\n📋 Verification Summary:");
  console.log("=".repeat(40));
  console.log(`Network: ${networkName}`);
  console.log(`Strategy Verified: ${STRATEGY_ADDRESS}`);
  console.log(`Vault Verified: ${VAULT_ADDRESS}`);
  console.log(`\n🔗 Explorer:`);
  console.log(`   https://shannon-explorer.somnia.network/address/${VAULT_ADDRESS}#code`);

  console.log("\n✅ Verification complete!");
}

main().catch((error) => {
  console.error("\n❌ Verification failed:", error);
  process.exitCode = 1;
});