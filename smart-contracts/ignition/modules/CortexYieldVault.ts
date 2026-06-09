// ignition/modules/CortexYieldVault.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CortexYieldVaultModule = buildModule("CortexYieldVaultModule", (m) => {
  // Deploy SimpleYieldStrategy first
  const strategy = m.contract("SimpleYieldStrategy", []);

  // Deploy CortexYieldVault with strategy address as constructor parameter
  const vault = m.contract("CortexYieldVault", [strategy]);

  return { strategy, vault };
});

export default CortexYieldVaultModule;