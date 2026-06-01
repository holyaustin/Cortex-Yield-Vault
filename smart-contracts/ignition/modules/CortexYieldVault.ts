// ignition/modules/CortexYieldVault.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CortexYieldVaultModule = buildModule("CortexYieldVaultModule", (m) => {
  // 1. Deploy the SimpleYieldStrategy contract
  const strategy = m.contract("SimpleYieldStrategy");

  // 2. Deploy the CortexYieldVault contract, passing the strategy's address to the constructor
  const vault = m.contract("CortexYieldVault", [strategy]);

  // Return the deployed contracts so they can be used in tests or other modules
  return { strategy, vault };
});

export default CortexYieldVaultModule;