import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

const VAULT_ADDRESS = "0x7ebF3ce6b0f3d8ee356c32DA8C79A77A5FBe64F9";

async function main() {
  console.log(`\n🔍 Checking Autonomous Action Status on ${networkName}...`);
  console.log("=".repeat(60));

  const [owner] = await ethers.getSigners();
  const vault = await ethers.getContractAt("CortexYieldVault", VAULT_ADDRESS);

  // Check if there's a pending autonomous action
  const hasPending = await vault.hasPendingAutonomousAction();
  const pendingPayload = await vault.pendingAutonomousPayload();
  const pendingDeposit = await vault.pendingAutonomousDeposit();

  console.log(`\n📊 Pending Autonomous Action Status:`);
  console.log(`   Has pending: ${hasPending}`);
  console.log(`   Payload length: ${(pendingPayload.length - 2) / 2} bytes`);
  console.log(`   Deposit amount: ${ethers.formatEther(pendingDeposit)} STT`);

  // Check recent events
  console.log(`\n📜 Recent AutonomousActionPrepared events:`);
  const prepareFilter = vault.filters.AutonomousActionPrepared();
  const prepareEvents = await vault.queryFilter(prepareFilter, -100);
  
  if (prepareEvents.length > 0) {
    const latest = prepareEvents[prepareEvents.length - 1];
    console.log(`   Latest action ID: ${latest.args?.actionId}`);
    console.log(`   Deposit: ${ethers.formatEther(latest.args?.depositAmount || 0)} STT`);
  } else {
    console.log(`   No prepare events found`);
  }

  console.log(`\n📜 Recent RiskAssessmentRequested events:`);
  const riskFilter = vault.filters.RiskAssessmentRequested();
  const riskEvents = await vault.queryFilter(riskFilter, -100);
  
  if (riskEvents.length > 0) {
    console.log(`   Found ${riskEvents.length} risk assessment requests`);
    const latest = riskEvents[riskEvents.length - 1];
    console.log(`   Latest request ID: ${latest.args?.requestId}`);
    console.log(`   Request type: ${latest.args?.requestType}`);
  }

  console.log(`\n📜 Recent AgentActionExecuted events:`);
  const actionFilter = vault.filters.AgentActionExecuted();
  const actionEvents = await vault.queryFilter(actionFilter, -100);
  
  if (actionEvents.length > 0) {
    console.log(`   Found ${actionEvents.length} agent actions executed`);
    const latest = actionEvents[actionEvents.length - 1];
    console.log(`   Latest request ID: ${latest.args?.requestId}`);
    console.log(`   Selector: ${latest.args?.selector}`);
  } else {
    console.log(`   No agent actions executed yet`);
  }

  console.log("\n✅ Status check complete!");
}

main().catch((error) => {
  console.error("\n❌ Failed:", error);
  process.exitCode = 1;
});