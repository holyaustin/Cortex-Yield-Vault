import { network } from "hardhat";
import { BaseContract, EventLog, Log } from "ethers";

const { ethers, networkName } = await network.connect();

// Type guard: narrows (EventLog | Log) → EventLog
function isEventLog(e: EventLog | Log): e is EventLog {
  return "args" in e && e.args !== undefined;
}

// Somnia testnet RPC rejects ranges > 999 blocks.
// This helper splits any range into ≤ 999-block chunks and merges results.
async function queryFilterPaginated(
  contract: BaseContract,                     // ✅ BaseContract accepts any typed contract
  filter: Parameters<BaseContract["queryFilter"]>[0],
  fromBlock: number,
  toBlock: number,
  chunkSize = 999
): Promise<(EventLog | Log)[]> {
  const results: (EventLog | Log)[] = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(start + chunkSize - 1, toBlock);
    console.log(`   ...querying blocks ${start} – ${end}`);
    const chunk = await contract.queryFilter(filter, start, end);
    results.push(...chunk);
    start = end + 1;
  }
  return results;
}

async function main() {
  console.log(`\n🔍 Diagnosing Agent Response Format on ${networkName}...`);
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`\n📡 Diagnostician address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} STT`);

  // Contract addresses
  const vaultAddress    = "0x39917DA7Cc87A733E154A681363F950d1ed2C487";
  const platformAddress = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

  console.log(`\n📝 Contract Addresses:`);
  console.log(`   Vault:     ${vaultAddress}`);
  console.log(`   Platform:  ${platformAddress}`);

  // Get vault contract
  const vault = await ethers.getContractAt("CortexYieldVault", vaultAddress);

  // Get platform contract with minimal ABI for getRequest
  const platform = new ethers.Contract(
    platformAddress,
    [
      "function getRequest(uint256 requestId) view returns (uint256 id, address requester, address callbackAddress, bytes4 callbackSelector, address[] subcommittee, (address validator, bytes result, uint8 status, uint256 receipt, uint256 timestamp, uint256 executionCost)[] responses, uint256 responseCount, uint256 failureCount, uint256 threshold, uint256 createdAt, uint256 deadline, uint8 status, uint8 consensusType, uint256 remainingBudget, uint256 perAgentBudget)"
    ],
    deployer
  );

  // Get the RiskAssessmentRequested events from your vault
  console.log(`\n📋 Fetching RiskAssessmentRequested events from vault...`);

  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`   Current block: ${currentBlock}`);

  // Somnia testnet hard-limits eth_getLogs to 999 blocks per request.
  // queryFilterPaginated chunks the range automatically.
  const LOOK_BACK = 5000; // total blocks to search
  const fromBlock = currentBlock - LOOK_BACK;
  console.log(`   Searching last ${LOOK_BACK} blocks (from ${fromBlock}), paginated in 999-block chunks...`);

  // Fetch ALL RiskAssessmentRequested events — requestType is not indexed
  // so it cannot be used as an on-chain topic filter; we filter in JS below.
  const filter    = vault.filters.RiskAssessmentRequested();
  const allEvents = await queryFilterPaginated(vault, filter, fromBlock, currentBlock);

  const events = allEvents
    .filter(isEventLog)
    .filter(e => Number(e.args.requestType) === 1);

  console.log(`   Found ${allEvents.length} total RiskAssessmentRequested events`);
  console.log(`   Found ${events.length} autonomous action (type=1) events`);

  if (events.length === 0) {
    console.log("\n⚠️  No autonomous action requests found in last 5000 blocks.");
    console.log("\n💡 Please trigger requestAutonomousAction from the frontend first, then run this script again.");
    return;
  }

  // Get the most recent event
  const latestEvent = events[events.length - 1];
  const requestId = latestEvent.args.requestId as bigint;
  console.log(`\n📋 Most recent autonomous action request ID: ${requestId}`);

  // Get the request details from platform
  console.log("\n📋 Fetching request details from platform...");

  try {
    const request = await platform.getRequest(requestId);

    console.log(`\n📋 Request Details:`);
    console.log(`   Status:         ${request.status}`);
    console.log(`   Response count: ${request.responses.length}`);
    console.log(`   Created at:     ${new Date(Number(request.createdAt) * 1000).toLocaleString()}`);
    console.log(`   Deadline:       ${new Date(Number(request.deadline) * 1000).toLocaleString()}`);

    if (request.responses.length === 0) {
      console.log("\n⚠️  No responses yet. The agent may still be processing or timed out.");
      console.log("   Wait a few minutes and run the script again.");
      return;
    }

    const response = request.responses[0];
    console.log(`\n📋 Response Details:`);
    console.log(`   Validator:        ${response.validator}`);
    console.log(`   Status:           ${response.status}`);
    console.log(`   Timestamp:        ${new Date(Number(response.timestamp) * 1000).toLocaleString()}`);
    console.log(`   Result length:    ${response.result.length} bytes`);
    console.log(`   Raw result (hex): ${(response.result as string).slice(0, 200)}...`);

    // Try to decode with different formats
    console.log(`\n📋 Attempting to decode response with various formats...`);
    console.log("=".repeat(60));

    const coder = ethers.AbiCoder.defaultAbiCoder();

    const formats: Array<{ name: string; types: string[] }> = [
      { name: "(string, bytes[])",                                       types: ["string", "bytes[]"] },
      { name: "(string, string, bytes[])",                               types: ["string", "string", "bytes[]"] },
      { name: "(string, string, string[], string[], string[], bytes[])", types: ["string", "string", "string[]", "string[]", "string[]", "bytes[]"] },
      { name: "(string)",                                                types: ["string"] },
      { name: "(string, bytes)",                                         types: ["string", "bytes"] },
    ];

    let foundFormat = false;

    for (const format of formats) {
      console.log(`\n🔸 Trying ${format.name}...`);
      try {
        const decoded = coder.decode(format.types, response.result);
        console.log(`   ✅ SUCCESS!`);
        decoded.forEach((val: unknown, i: number) => {
          if (Array.isArray(val)) {
            console.log(`   [${i}] [${val.length} items]`);
            if (val.length > 0) {
              console.log(`       First item: ${String(val[0]).slice(0, 100)}`);
            }
          } else {
            console.log(`   [${i}] ${String(val).slice(0, 200)}`);
          }
        });
        foundFormat = true;
        console.log(`\n✅ Recommended decode format: ${format.name}`);
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`   ❌ Failed: ${msg.slice(0, 100)}`);
      }
    }

    if (!foundFormat) {
      console.log("\n❌ Could not decode response with any known format");
      console.log("\n📋 Raw result (full):");
      console.log(response.result);
    }

    // Status interpretation
    console.log("\n📋 Status Codes:");
    console.log("   2 = Success");
    console.log("   3 = Failed");
    console.log("   4 = Timed Out");

    const statusMessages: Record<number, string> = {
      2: "✅ Agent request succeeded!",
      3: "❌ Agent request failed",
      4: "⏰ Agent request timed out",
    };
    const statusNum = Number(response.status);
    console.log(`\n${statusMessages[statusNum] ?? `⏳ Agent request status: ${response.status} (Pending or other)`}`);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Error getting request details:", msg);
  }

  console.log("\n✅ Diagnosis complete!");
}

main().catch((error) => {
  console.error("\n❌ Diagnosis failed:", error);
  process.exitCode = 1;
});