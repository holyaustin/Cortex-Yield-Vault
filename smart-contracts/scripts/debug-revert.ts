import { network } from "hardhat";

const { ethers, networkName } = await network.connect();

async function main() {
  console.log(`\n🔬 Final revert diagnosis on ${networkName}...`);
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  const vaultAddress    = "0x6b14266b8761f3175F5B41c87fA1Ae05c903A564";
  const platformAddress = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

  const vault    = await ethers.getContractAt("CortexYieldVault", vaultAddress);
  const platform = await ethers.getContractAt("IAgentRequester", platformAddress);

  const requiredDeposit = await vault.getRequiredDeposit();
  const llmAgentId      = await vault.LLM_AGENT_ID();
  const callbackSel     = vault.interface.getFunction("handleAutonomousActionResponse")!.selector;

  console.log(`\n📊 Setup:`);
  console.log(`   vault:            ${vaultAddress}`);
  console.log(`   requiredDeposit:  ${ethers.formatEther(requiredDeposit)} STT`);
  console.log(`   llmAgentId:       ${llmAgentId}`);
  console.log(`   callbackSelector: ${callbackSel}`);

  // Step 1: isolate exactly where inside requestAutonomousAction it reverts
  // by calling each sub-operation individually

  // Step 1a: does _getDepositForLLM work? (getRequiredDeposit calls it)
  console.log(`\n🧪 Step 1a: getRequiredDeposit() view call`);
  try {
    const d = await vault.getRequiredDeposit();
    console.log(`   ✅ ${ethers.formatEther(d)} STT`);
  } catch (e: unknown) { logErr(e); }

  // Step 1b: build the exact payload the vault builds and test it standalone
  console.log(`\n🧪 Step 1b: Reconstruct vault payload and test platform.createRequest from EOA`);
  const iface = new ethers.Interface([
    "function inferToolsChat(string[],string[],string[],tuple(string signature,string description)[],uint256,bool)"
  ]);
  const tools = [
    { signature: "withdraw(uint256 amount)",        description: "Withdraw STT from vault (max 50% of total)" },
    { signature: "rebalanceTo(address newStrategy)", description: "Change yield strategy address" },
  ];
  const payload = iface.encodeFunctionData("inferToolsChat", [
    ["system", "user"],
    [
      "You are a DeFi risk manager. Return tool calls to protect funds. Be conservative. ONLY return withdraw() if risk is HIGH (>70). ONLY return rebalanceTo() if risk is EXTREME (>85). If no action needed, return finishReason='stop' with NO tool calls.",
      "TVL: 0 STT. Strategy: 0x7f8937232BDc40aa8dc19Fc2B845AfF6C7cf0B4F"
    ],
    [],
    tools.map(t => [t.signature, t.description]),
    5, true
  ]);
  console.log(`   Payload length: ${(payload.length - 2) / 2} bytes`);
  console.log(`   Selector: ${payload.slice(0, 10)}`);
  try {
    await platform.createRequest.staticCall(
      llmAgentId, vaultAddress, callbackSel, payload,
      { value: requiredDeposit }
    );
    console.log(`   ✅ Platform accepted from EOA with real payload`);
  } catch (e: unknown) { logErr(e); }

  // Step 1c: same call but from=vault address (contract as caller)
  console.log(`\n🧪 Step 1c: Same platform.createRequest but from=vault (low-level eth_call)`);
  try {
    const platformIface = new ethers.Interface([
      "function createRequest(uint256,address,bytes4,bytes) payable returns (uint256)"
    ]);
    const cd = platformIface.encodeFunctionData("createRequest", [
      llmAgentId, vaultAddress, callbackSel, payload
    ]);
    const result = await ethers.provider.call({
      from: vaultAddress,
      to:   platformAddress,
      data: cd,
      value: requiredDeposit,
    });
    console.log(`   ✅ Accepted from contract caller. Result: ${result.slice(0, 66)}`);
  } catch (e: unknown) {
    console.log(`   ❌ Rejected when contract is msg.sender — THIS IS THE BUG`);
    logErr(e);
  }

  // Step 1d: vault staticCall with extra verbose error extraction
  console.log(`\n🧪 Step 1d: vault.requestAutonomousAction staticCall (verbose)`);
  try {
    await vault.requestAutonomousAction.staticCall({ value: requiredDeposit });
    console.log(`   ✅ Passed!`);
  } catch (e: unknown) {
    const err  = e as Record<string, unknown>;
    const data = String(err.data ?? "");
    console.log(`   ❌ Reverted`);
    console.log(`      error:  ${String(err.message ?? "").slice(0, 200)}`);
    console.log(`      data:   ${data || "null (no revert data returned by node)"}`);
    console.log(`      reason: ${String(err.reason ?? "null")}`);
    // Try nested error
    const inner = (err as Record<string, Record<string, unknown>>).error;
    if (inner) {
      console.log(`      inner error data: ${JSON.stringify(inner).slice(0, 200)}`);
    }
  }

  // Step 2: Check if platform has an allowlist for contract callers
  // Try reading common allowlist/whitelist storage slots
  console.log(`\n🧪 Step 2: Check platform implementation for allowlist`);
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implAddrRaw = await ethers.provider.getStorage(platformAddress, implSlot);
  const implAddr    = "0x" + implAddrRaw.slice(26);
  console.log(`   Platform implementation: ${implAddr}`);

  // Check if vault is in any mapping at slot 0,1,2,3 (common allowlist positions)
  for (let slot = 0; slot < 4; slot++) {
    const mapKey = ethers.solidityPackedKeccak256(
      ["address", "uint256"], [vaultAddress, slot]
    );
    const val = await ethers.provider.getStorage(platformAddress, mapKey);
    if (val !== "0x" + "0".repeat(64)) {
      console.log(`   ⚠️  Non-zero at mapping(address=>*)[vault] slot ${slot}: ${val}`);
    }
  }
  console.log(`   (all allowlist slots checked — zero = not in any mapping)`);

  // Step 3: Try calling with deployer EOA wrapping the vault call
  // i.e. check if the issue is purely msg.sender = contract
  console.log(`\n🧪 Step 3: Deploy a minimal forwarder to test contract→platform call`);
  console.log(`   (skipped — confirms via Step 1c above)`);

  console.log("\n📋 Summary:");
  console.log("   If Step 1c ❌: Platform BLOCKS contract callers → need Somnia to whitelist vault");
  console.log("   If Step 1c ✅ but Step 1d ❌: Bug is still inside vault contract logic");

  console.log("\n✅ Diagnosis complete.");
}

function logErr(e: unknown) {
  const err  = e as Record<string, unknown>;
  const data = String(err.data ?? "");
  console.log(`   ❌ ${String(err.message ?? "").slice(0, 150)}`);
  if (data) console.log(`      data: ${data}`);
  if (data.startsWith("0x4e487b71")) {
    const code = parseInt(data.slice(-2), 16);
    const m: Record<number, string> = { 0x11:"overflow", 0x12:"div/0", 0x31:"empty pop", 0x32:"array OOB", 0x41:"OOM", 0x51:"uninit fn" };
    console.log(`      Panic(0x${code.toString(16)}): ${m[code] ?? "unknown"}`);
  } else if (data.length > 10) {
    try {
      const d = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10));
      console.log(`      revert: "${d[0]}"`);
    } catch { /* not Error(string) */ }
  }
}

main().catch(console.error);