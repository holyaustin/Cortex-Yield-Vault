import { expect } from "chai";
import { ethers } from "hardhat";
import { CortexYieldVault, SimpleYieldStrategy } from "../typechain-types";

describe("CortexYieldVault", function () {
  let vault: CortexYieldVault;
  let strategy: SimpleYieldStrategy;
  let owner: any, user: any;

  const LLM_DEPOSIT = ethers.parseEther("0.24");
  const JSON_DEPOSIT = ethers.parseEther("0.12");

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const StrategyFactory = await ethers.getContractFactory("SimpleYieldStrategy");
    strategy = await StrategyFactory.deploy();
    await strategy.waitForDeployment();
    const VaultFactory = await ethers.getContractFactory("CortexYieldVault");
    vault = await VaultFactory.deploy(await strategy.getAddress());
    await vault.waitForDeployment();
  });

  it("should accept native STT deposits", async () => {
    await expect(vault.connect(user).deposit({ value: ethers.parseEther("10") }))
      .to.emit(vault, "Deposited")
      .withArgs(user.address, ethers.parseEther("10"));
    expect(await vault.totalDeposited()).to.equal(ethers.parseEther("10"));
  });

  it("should allow owner to request risk score", async () => {
    await expect(vault.connect(owner).fetchRiskScore({ value: LLM_DEPOSIT }))
      .to.emit(vault, "RiskAssessmentRequested");
  });

  it("should reject risk score from non-owner", async () => {
    await expect(vault.connect(user).fetchRiskScore({ value: LLM_DEPOSIT }))
      .to.be.reverted;
  });

  it("should require correct deposit for LLM", async () => {
    await expect(vault.connect(owner).fetchRiskScore({ value: LLM_DEPOSIT - 1n }))
      .to.be.revertedWith("Insufficient deposit for LLM");
  });

  it("should allow autonomous action request", async () => {
    await expect(vault.connect(owner).requestAutonomousAction({ value: LLM_DEPOSIT }))
      .to.emit(vault, "RiskAssessmentRequested");
  });

  it("should allow JSON data fetch", async () => {
    await expect(vault.connect(owner).fetchVolatilityIndex({ value: JSON_DEPOSIT }))
      .to.emit(vault, "RiskAssessmentRequested");
  });
});