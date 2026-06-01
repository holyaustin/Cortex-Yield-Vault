import { expect } from "chai";
import { describe, it, beforeEach } from "mocha";

describe("CortexYieldVault", function () {
  let vault: any;
  let strategy: any;
  let owner: any;
  let user: any;
  let ethers: any;

  const LLM_DEPOSIT_AMOUNT = "240000000000000000"; // 0.24 ETH in wei
  const JSON_DEPOSIT_AMOUNT = "120000000000000000"; // 0.12 ETH in wei

  beforeEach(async function () {
    // Get ethers from Hardhat context (injected by hardhat-toolbox-mocha-ethers)
    ethers = this.ethers;
    
    // Deploy SimpleYieldStrategy
    const StrategyFactory = await ethers.getContractFactory("SimpleYieldStrategy");
    strategy = await StrategyFactory.deploy();
    await strategy.waitForDeployment();

    // Deploy CortexYieldVault
    const VaultFactory = await ethers.getContractFactory("CortexYieldVault");
    vault = await VaultFactory.deploy(await strategy.getAddress());
    await vault.waitForDeployment();

    // Get signers
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];
  });

  describe("Deposit and Withdraw", function () {
    it("should accept native STT deposits", async function () {
      const depositAmount = ethers.parseEther("10");
      
      await expect(vault.connect(user).deposit({ value: depositAmount }))
        .to.emit(vault, "Deposited")
        .withArgs(user.address, depositAmount);
      
      expect(await vault.totalDeposited()).to.equal(depositAmount);
    });

    it("should allow withdrawal of STT", async function () {
      const depositAmount = ethers.parseEther("50");
      
      // First deposit
      await vault.connect(user).deposit({ value: depositAmount });
      
      // Withdraw
      const withdrawAmount = ethers.parseEther("20");
      await expect(vault.connect(user).withdraw(withdrawAmount))
        .to.emit(vault, "Withdrawn")
        .withArgs(user.address, withdrawAmount);
      
      expect(await vault.totalDeposited()).to.equal(depositAmount - withdrawAmount);
    });
  });

  describe("Agent Functions (LLM Inference)", function () {
    it("should allow owner to request risk score (inferNumber)", async function () {
      const LLM_DEPOSIT = ethers.parseEther("0.24");
      
      await expect(vault.connect(owner).fetchRiskScore({ value: LLM_DEPOSIT }))
        .to.emit(vault, "RiskAssessmentRequested");
    });

    it("should reject risk score from non-owner", async function () {
      const LLM_DEPOSIT = ethers.parseEther("0.24");
      
      await expect(vault.connect(user).fetchRiskScore({ value: LLM_DEPOSIT }))
        .to.be.reverted;
    });

    it("should require correct deposit for LLM agent", async function () {
      const insufficientDeposit = ethers.parseEther("0.23");
      
      await expect(vault.connect(owner).fetchRiskScore({ value: insufficientDeposit }))
        .to.be.revertedWith("Insufficient deposit for LLM");
    });

    it("should allow autonomous action request (inferToolsChat)", async function () {
      const LLM_DEPOSIT = ethers.parseEther("0.24");
      
      await expect(vault.connect(owner).requestAutonomousAction({ value: LLM_DEPOSIT }))
        .to.emit(vault, "RiskAssessmentRequested");
    });
  });

  describe("JSON API Agent", function () {
    it("should allow JSON data fetch", async function () {
      const JSON_DEPOSIT = ethers.parseEther("0.12");
      
      await expect(vault.connect(owner).fetchVolatilityIndex({ value: JSON_DEPOSIT }))
        .to.emit(vault, "RiskAssessmentRequested");
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to rebalance to new strategy", async function () {
      // Deploy new strategy
      const StrategyFactory = await ethers.getContractFactory("SimpleYieldStrategy");
      const newStrategy = await StrategyFactory.deploy();
      await newStrategy.waitForDeployment();
      
      const currentStrategyAddress = await strategy.getAddress();
      const newStrategyAddress = await newStrategy.getAddress();
      
      await expect(vault.connect(owner).rebalanceTo(newStrategyAddress))
        .to.emit(vault, "Rebalanced")
        .withArgs(currentStrategyAddress, newStrategyAddress);
      
      expect(await vault.currentStrategy()).to.equal(newStrategyAddress);
    });

    it("should allow owner to set risk check interval", async function () {
      const newInterval = 7200;
      
      const tx = await vault.connect(owner).setRiskCheckInterval(newInterval);
      await tx.wait();
      
      expect(await vault.riskCheckInterval()).to.equal(newInterval);
    });

    it("should reject non-owner from setting risk check interval", async function () {
      await expect(vault.connect(user).setRiskCheckInterval(7200))
        .to.be.reverted;
    });
  });
});
