import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

const PLATFORM_ADDRESS = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
const LLM_AGENT_ID = 12847293847561029384n;

async function main() {
  console.log(`\n🔍 Checking LLM Agent Status on ${networkName}...`);
  console.log("=".repeat(60));

  const platform = await ethers.getContractAt("IAgentRequester", PLATFORM_ADDRESS);
  
  // Check if we can get the reserve deposit (proves platform is working)
  try {
    const reserve = await platform.getRequestDeposit();
    console.log(`\n✅ Platform is reachable`);
    console.log(`   Reserve deposit: ${ethers.formatEther(reserve)} STT`);
  } catch (err) {
    console.log(`\n❌ Platform not reachable:`, err);
    return;
  }
  
  console.log(`\n📊 Agent ID: ${LLM_AGENT_ID}`);
  
  // Use a smaller block range (last 100 blocks instead of 1000)
  const currentBlock = await ethers.provider.getBlockNumber();
  const fromBlock = currentBlock - 100; // Last 100 blocks only
  console.log(`\n📡 Checking events from block ${fromBlock} to ${currentBlock}`);
  
  const filter = {
    address: PLATFORM_ADDRESS,
    fromBlock: fromBlock,
    toBlock: 'latest'
  };
  
  try {
    const events = await ethers.provider.getLogs(filter);
    const requestCreatedTopic = ethers.id("RequestCreated(uint256,uint256,uint256,bytes,address[])");
    const requestFinalizedTopic = ethers.id("RequestFinalized(uint256,uint8)");
    
    const createdEvents = events.filter(log => log.topics[0] === requestCreatedTopic);
    const finalizedEvents = events.filter(log => log.topics[0] === requestFinalizedTopic);
    
    console.log(`\n📈 Recent Activity (last 100 blocks):`);
    console.log(`   RequestCreated events: ${createdEvents.length}`);
    console.log(`   RequestFinalized events: ${finalizedEvents.length}`);
    
    // Check if any requests for our agent completed recently
    const ourAgentRequests = createdEvents.filter(log => {
      // topics[1] is requestId, topics[2] is agentId (indexed)
      const agentIdFromLog = BigInt(log.topics[2]);
      return agentIdFromLog === LLM_AGENT_ID;
    });
    
    console.log(`\n🤖 Requests for your agent ID: ${ourAgentRequests.length}`);
    
    if (ourAgentRequests.length === 0) {
      console.log(`\n⚠️ No recent requests found for agent ID ${LLM_AGENT_ID}`);
      console.log(`   This agent may not be active on testnet.`);
      console.log(`\n💡 Try using a different agent ID or check Somnia Agent Explorer:`);
      console.log(`   https://agents.testnet.somnia.network/agent/${LLM_AGENT_ID}`);
      
      // Check if there are ANY RequestCreated events at all
      if (createdEvents.length > 0) {
        console.log(`\n📋 Other agent IDs active in recent blocks:`);
        const uniqueAgents = new Set();
        for (const log of createdEvents.slice(0, 10)) {
          uniqueAgents.add(log.topics[2]);
        }
        for (const agent of uniqueAgents) {
          console.log(`   - ${agent}`);
        }
      }
    } else {
      // Check if any finalized
      const latestRequest = ourAgentRequests[ourAgentRequests.length - 1];
      const requestId = BigInt(latestRequest.topics[1]);
      const finalized = finalizedEvents.some(log => BigInt(log.topics[1]) === requestId);
      console.log(`   Latest request ${requestId}: ${finalized ? '✅ Finalized' : '⏳ Pending'}`);
      
      if (!finalized) {
        console.log(`\n⚠️ Your request (${requestId}) is still pending.`);
        console.log(`   This may take several minutes for the LLM to process.`);
      }
    }
    
  } catch (err: any) {
    console.log(`\n⚠️ Could not fetch logs: ${err.message}`);
    console.log(`   This is normal if the RPC has log limitations.`);
    console.log(`\n💡 Alternative: Check the explorer directly:`);
    console.log(`   https://shannon-explorer.somnia.network/address/${PLATFORM_ADDRESS}#events`);
  }
  
  // Also check your vault's recent activity
  console.log(`\n🔍 Checking your vault's recent activity...`);
  try {
    const vault = await ethers.getContractAt("CortexYieldVault", "0xf3B11f845933DB462daf111337AbE7890305Ea51");
    const tvl = await vault.totalDeposited();
    const lastRiskCheck = await vault.lastRiskCheck();
    console.log(`   TVL: ${ethers.formatEther(tvl)} STT`);
    console.log(`   Last risk check: ${lastRiskCheck > 0 ? new Date(Number(lastRiskCheck) * 1000).toLocaleString() : 'Never'}`);
  } catch (err) {
    console.log(`   Could not read vault:`, err);
  }
  
  console.log("\n✅ Check complete!");
}

main().catch(console.error);