import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const { ethers, networkName } = await network.connect();

const LLM_AGENT_ID        = 12847293847561029384n;
const LLM_PER_AGENT_PRICE = ethers.parseEther("0.07");
const SUBCOMMITTEE_SIZE   = 3n;
const PLATFORM_ADDRESS    = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

function getVaultAddress(): string {
  const p = path.join(__dirname, "..", "deployments.json");
  if (!fs.existsSync(p)) throw new Error("deployments.json not found. Deploy first.");
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!d[networkName]?.vault) throw new Error(`No vault for network "${networkName}".`);
  return d[networkName].vault;
}

async function main() {
  console.log(`\n⚡ Requesting Autonomous Action on ${networkName}...`);
  console.log("=".repeat(60));
  console.log("ℹ️  EOA → platform directly (vault callback is stateless)");

  const [deployer] = await ethers.getSigners();
  const vaultAddress = '0x875Cfa391e798f3D9B9fD697fc738C40f1eA3a61';

  console.log(`\n📋 Addresses:`);
  console.log(`   EOA (msg.sender): ${deployer.address}`);
  console.log(`   Vault (callback): ${vaultAddress}`);
  console.log(`   Platform:         ${PLATFORM_ADDRESS}`);

  const platform = await ethers.getContractAt("IAgentRequester", PLATFORM_ADDRESS);
  const vault    = await ethers.getContractAt("CortexYieldVault", vaultAddress);

  // Verify caller is vault owner
  const owner = await vault.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("\n❌ You are not the vault owner!");
    return;
  }

  // Deposit calculation
  const reserve         = await platform.getRequestDeposit();
  const requiredDeposit = reserve + LLM_PER_AGENT_PRICE * SUBCOMMITTEE_SIZE;
  const balance         = await ethers.provider.getBalance(deployer.address);

  console.log(`\n💰 Deposit:`);
  console.log(`   Platform reserve: ${ethers.formatEther(reserve)} STT`);
  console.log(`   Agent reward:     ${ethers.formatEther(LLM_PER_AGENT_PRICE * SUBCOMMITTEE_SIZE)} STT`);
  console.log(`   Required total:   ${ethers.formatEther(requiredDeposit)} STT`);
  console.log(`   Your balance:     ${ethers.formatEther(balance)} STT`);

  if (balance < requiredDeposit) {
    console.error("\n❌ Insufficient balance.");
    return;
  }

  // Build payload
  const iface = new ethers.Interface([
    "function inferToolsChat(string[],string[],string[],tuple(string signature,string description)[],uint256,bool)"
  ]);
  const tvl      = await vault.totalDeposited();
  const strategy = await vault.currentStrategy();
  const payload  = iface.encodeFunctionData("inferToolsChat", [
    ["system", "user"],
    [
      "You are a DeFi risk manager. Return tool calls to protect funds. Be conservative. ONLY return withdraw() if risk is HIGH (>70). ONLY return rebalanceTo() if risk is EXTREME (>85). If no action needed, return finishReason='stop' with NO tool calls.",
      `TVL: ${ethers.formatEther(tvl)} STT. Strategy: ${strategy}`
    ],
    [],
    [
      ["withdraw(uint256 amount)",         "Withdraw STT from vault (max 50% of total)"],
      ["rebalanceTo(address newStrategy)", "Change yield strategy address"],
    ],
    5, true
  ]);

  const callbackSelector = vault.interface.getFunction("handleAutonomousActionResponse")!.selector;

  console.log(`\n📦 Payload: ${(payload.length - 2) / 2} bytes, selector ${payload.slice(0, 10)}`);
  console.log(`   Callback selector: ${callbackSelector}`);
  console.log(`   TVL: ${ethers.formatEther(tvl)} STT`);

  // Simulate
  console.log(`\n🔍 Simulating...`);
  try {
    await platform.createRequest.staticCall(
      LLM_AGENT_ID, vaultAddress, callbackSelector, payload,
      { value: requiredDeposit }
    );
    console.log("   ✅ Simulation passed!");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\n❌ Simulation failed: ${msg}`);
    return;
  }

  // Send transaction
  console.log(`\n📤 Sending EOA → platform createRequest...`);
  try {
    const tx = await platform.createRequest(
      LLM_AGENT_ID, vaultAddress, callbackSelector, payload,
      { value: requiredDeposit, gasLimit: 600_000 }
    );

    console.log(`   Tx hash:  ${tx.hash}`);
    console.log(`   Explorer: https://testnet.somnia.exploreme.pro/tx/${tx.hash}`);

    const receipt = await tx.wait();

    if (receipt === null) {
      console.error("\n❌ Receipt is null — tx may have been dropped.");
      return;
    }

    if (receipt.status === 1) {
      // Parse requestId from logs
      let requestId: bigint | null = null;
      const platformIface = new ethers.Interface([
        "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)"
      ]);
      for (const log of receipt.logs) {
        try {
          const parsed = platformIface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === "RequestCreated") requestId = parsed.args.requestId as bigint;
        } catch { /* skip */ }
      }

      console.log(`\n✅ Autonomous action submitted! (block ${receipt.blockNumber})`);
      console.log(`   Gas used:   ${receipt.gasUsed.toString()}`);
      if (requestId !== null) console.log(`   Request ID: ${requestId}`);
      console.log("\n📋 Wait 30–60s then run:");
      console.log("   npx hardhat run scripts/diagnose-agent.ts --network somniaTestnet");
    } else {
      console.error("\n❌ Transaction reverted on-chain.");
      console.error(`   Check: https://testnet.somnia.exploreme.pro/tx/${tx.hash}`);
    }
  } catch (e: unknown) {
    const msg  = e instanceof Error ? e.message : String(e);
    const data = (e as Record<string, unknown>).data;
    console.error(`\n❌ Transaction failed: ${msg}`);
    if (data) console.error(`   Error data: ${data}`);
  }
}

main().catch(console.error);