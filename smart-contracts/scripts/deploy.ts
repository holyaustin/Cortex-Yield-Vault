import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

async function main() {
  console.log(`\n🧠 Deploying Cortex Yield Vault to ${networkName}...`);
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`\n📡 Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} STT`);

  // --- Deploy SimpleYieldStrategy ---
  console.log("\n📄 Deploying SimpleYieldStrategy...");
  const strategy = await ethers.deployContract("SimpleYieldStrategy");
  console.log("⏳ Waiting for deployment tx to confirm...");
  await strategy.waitForDeployment();
  const strategyAddress = await strategy.getAddress();
  console.log(`✅ SimpleYieldStrategy address: ${strategyAddress}`);

  const strategyTx = strategy.deploymentTransaction();
  console.log(`   Deployment Tx: ${strategyTx?.hash}`);

  // --- Deploy CortexYieldVault ---
  console.log("\n📄 Deploying CortexYieldVault...");
  const vault = await ethers.deployContract("CortexYieldVault", [strategyAddress]);
  console.log("⏳ Waiting for deployment tx to confirm...");
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`✅ CortexYieldVault address: ${vaultAddress}`);

  const vaultTx = vault.deploymentTransaction();
  console.log(`   Deployment Tx: ${vaultTx?.hash}`);

  // --- Display Deployment Summary ---
  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(60));
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
  console.log(`Block: ${await ethers.provider.getBlockNumber()}`);
  console.log(`\n📝 Contract Addresses:`);
  console.log(`   SimpleYieldStrategy: ${strategyAddress}`);
  console.log(`   CortexYieldVault:    ${vaultAddress}`);
  console.log(`\n👤 Owner: ${deployer.address}`);

  // --- Display Agent Configuration ---
  const requiredDeposit = await vault.getRequiredDeposit();
  console.log("\n🤖 Somnia Agent Configuration:");
  console.log("   Platform Contract (Testnet): 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776");
  console.log("   LLM Agent ID:                12847293847561029384");
  console.log("   JSON Agent ID:               13174292974160097713");
  console.log(`   Required Deposit:            ${ethers.formatEther(requiredDeposit)} STT`);
  console.log("   - MIN_DEPOSIT_RESERVE:       0.01 STT");
  console.log("   - LLM_PER_AGENT_PRICE:       0.07 STT");
  console.log("   - JSON_PER_AGENT_PRICE:      0.03 STT");
  console.log("   - SUBCOMMITTEE_SIZE:         3");

  // --- Explorer URLs ---
  console.log("\n🔗 Explorer URLs:");
  console.log(`   Strategy: https://shannon-explorer.somnia.network/address/${strategyAddress}`);
  console.log(`   Vault:    https://shannon-explorer.somnia.network/address/${vaultAddress}`);

  // --- Next Steps ---
  console.log("\n🚀 Next Steps:");
  console.log("=".repeat(60));
  console.log(`1. Fund the vault with STT for agent calls:`);
  console.log(`   > Send ${ethers.formatEther(requiredDeposit)} STT to ${vaultAddress}`);
  console.log(``);
  console.log(`2. Test a deposit:`);
  console.log(`   > await vault.deposit({value: ethers.parseEther("10")})`);
  console.log(``);
  console.log(`3. Request risk assessment:`);
  console.log(`   > await vault.fetchRiskScore({value: ${ethers.formatEther(requiredDeposit)}})`);
  console.log(``);
  console.log(`4. Request autonomous action:`);
  console.log(`   > await vault.requestAutonomousAction({value: ${ethers.formatEther(requiredDeposit)}})`);
  console.log(``);
  console.log(`5. Verify contracts on explorer:`);
  console.log(`   > npx hardhat run scripts/verify.ts --network somniaTestnet`);

  console.log("\n✅ Deployment successful!");
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:", error);
  process.exitCode = 1;
});