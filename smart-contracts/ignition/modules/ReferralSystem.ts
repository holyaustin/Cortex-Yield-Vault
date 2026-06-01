import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Parameters that can be overridden in deployment
const REWARD_POOL_FUNDING = 100_000_000_000_000_000n; // 0.1 ETH

const ReferralSystemModule = buildModule("ReferralSystemModule", (m) => {
  // ─── Parameters ───────────────────────────────────────────────────────────
  const fundRewardPool = m.getParameter("fundRewardPool", REWARD_POOL_FUNDING);
  
  // ─── Step 1: Deploy UserRegistry ─────────────────────────────────────────
  const registry = m.contract("UserRegistry", [], {
    id: "UserRegistry",
  });

  // ─── Step 2: Deploy ReferralBadge ────────────────────────────────────────
  const badge = m.contract("ReferralBadge", [], {
    id: "ReferralBadge",
  });

  // ─── Step 3: Deploy ReferralDynasty with badge address ───────────────────
  const dynasty = m.contract("ReferralDynasty", [badge], {
    id: "ReferralDynasty",
    after: [badge], // Ensure badge deploys first
  });

  // ─── Step 4: Transfer badge ownership to dynasty ─────────────────────────
  m.call(badge, "transferOwnership", [dynasty], {
    id: "TransferBadgeOwnership",
    after: [dynasty],
  });

  // ─── Step 5: Set registry as trusted emitter ─────────────────────────────
  m.call(dynasty, "setTrustedRegistry", [registry, true], {
    id: "SetTrustedRegistry",
    after: [dynasty, registry],
  });

  // ─── Step 6: Fund the reward pool ────────────────────────────────────────
  m.call(dynasty, "fundRewardPool", [], {
    id: "FundRewardPool",
    after: [dynasty],
    value: fundRewardPool,
  });

  return { registry, badge, dynasty };
});

export default ReferralSystemModule;