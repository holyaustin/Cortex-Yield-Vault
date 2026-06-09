import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

// Update these addresses after deployment
const VAULT_ADDRESS = "0x7ebF3ce6b0f3d8ee356c32DA8C79A77A5FBe64F9";
const PLATFORM_ADDRESS = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

async function main() {
  console.log(`\n🔵 Triggering Autonomous Action on ${networkName}...`);
  console.log("=".repeat(60));

  const [owner] = await ethers.getSigners();
  console.log(`\n📡 Owner address: ${owner.address}`);

  const balance = await ethers.provider.getBalance(owner.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} STT`);

  // Get contract instances
  const vault = await ethers.getContractAt("CortexYieldVault", VAULT_ADDRESS);
  const platform = await ethers.getContractAt(
    "IAgentRequester",
    PLATFORM_ADDRESS
  );

  // Check ownership
  const vaultOwner = await vault.owner();
  if (vaultOwner.toLowerCase() !== owner.address.toLowerCase()) {
    console.log(`\n⚠️ Warning: You are not the vault owner!`);
    console.log(`   Vault owner: ${vaultOwner}`);
    console.log(`   Your address: ${owner.address}`);
    console.log(`   Only the owner can trigger autonomous actions.`);
    return;
  }
  console.log(`\n✅ Ownership confirmed`);

  // Step 1: Prepare the autonomous action from the vault
  console.log(`\n📦 Step 1: Preparing autonomous action from vault...`);
  const prepareTx = await vault.prepareAutonomousAction();
  console.log(`   Transaction submitted: ${prepareTx.hash}`);
  await prepareTx.wait();
  console.log(`   ✅ Prepared!`);

  // Step 2: Get the prepared payload and deposit amount
  const payload = await vault.pendingAutonomousPayload();
  const depositAmount = await vault.pendingAutonomousDeposit();
  const agentId = await vault.LLM_AGENT_ID();
  
  // Get the callback selector
  const callbackSelector = vault.interface.getFunction("handleAutonomousActionResponse")!.selector;

  console.log(`\n📊 Step 2: Autonomous action details:`);
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Deposit required: ${ethers.formatEther(depositAmount)} STT`);
  console.log(`   Callback selector: ${callbackSelector}`);
  console.log(`   Payload length: ${(payload.length - 2) / 2} bytes`);

  // Step 3: Call platform directly from EOA
  console.log(`\n🚀 Step 3: Calling platform directly from EOA...`);
  console.log(`   Sending ${ethers.formatEther(depositAmount)} STT to platform...`);
  
  const platformTx = await platform.createRequest(
    agentId,
    VAULT_ADDRESS,
    callbackSelector,
    payload,
    { value: depositAmount, gasLimit: 2000000 }
  );
  console.log(`   Transaction submitted: ${platformTx.hash}`);
  await platformTx.wait();
  console.log(`   ✅ Platform call confirmed!`);

  // Step 4: Find the RequestCreated event and register with vault
  console.log(`\n📝 Step 4: Extracting requestId from platform...`);
  
  // Get the transaction receipt
  const receipt = await ethers.provider.getTransactionReceipt(platformTx.hash);
  
  // Look for RequestCreated event
  const requestCreatedTopic = ethers.id("RequestCreated(uint256,uint256,uint256,bytes,address[])");
  const eventLog = receipt?.logs.find(
    (log: any) => log.topics[0] === requestCreatedTopic
  );

  if (eventLog) {
    // Decode the requestId from topics[1]
    const requestId = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], eventLog.topics[1])[0];
    console.log(`   Request ID: ${requestId}`);
    
    // Register the request with the vault
    console.log(`\n📝 Step 5: Registering request with vault...`);
    const registerTx = await vault.registerAutonomousRequest(requestId);
    console.log(`   Transaction submitted: ${registerTx.hash}`);
    await registerTx.wait();
    console.log(`   ✅ Registered!`);
    
    console.log(`\n✅ Autonomous action triggered successfully!`);
    console.log(`   Request ID: ${requestId}`);
    console.log(`   Platform will call back to vault with response.`);
  } else {
    console.log(`\n⚠️ Could not find RequestCreated event in logs`);
    console.log(`   Transaction hash: ${platformTx.hash}`);
    console.log(`   Check explorer for request details.`);
  }

  // Step 6: Check pending requests
  const pendingRequestId = await vault.pendingRequests(requestId || 0);
  console.log(`\n📋 Pending request status:`);
  console.log(`   Request ID: ${requestId || "Unknown"}`);
  console.log(`   Active: ${pendingRequestId.isActive}`);

  console.log("\n🔗 Explorer Links:");
  console.log(`   Prepare tx: https://shannon-explorer.somnia.network/tx/${prepareTx.hash}`);
  console.log(`   Platform tx: https://shannon-explorer.somnia.network/tx/${platformTx.hash}`);
  console.log(`   Register tx: https://shannon-explorer.somnia.network/tx/${registerTx?.hash || "pending"}`);
  
  console.log("\n✅ Done!");
}

main().catch((error) => {
  console.error("\n❌ Failed:", error);
  process.exitCode = 1;
});