// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/CortexYieldVault.sol";
import "../contracts/strategies/SimpleYieldStrategy.sol";

contract CortexYieldVaultTest is Test {
    CortexYieldVault public vault;
    SimpleYieldStrategy public strategy;
    address public owner;
    address public user1;
    address public user2;

    uint256 constant LLM_DEPOSIT = 0.24 ether;
    uint256 constant JSON_DEPOSIT = 0.12 ether;

    // Events for testing - matching the ones in CortexYieldVault
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RiskAssessmentRequested(uint256 requestId, uint256 requestType);
    event Rebalanced(address indexed fromStrategy, address indexed toStrategy);
    event RiskScoreFetched(uint256 requestId, int256 score);
    event MarketDataFetched(uint256 requestId, uint256 data);

    function setUp() public {
        owner = address(this);
        user1 = address(0x1234);
        user2 = address(0x5678);
        
        strategy = new SimpleYieldStrategy();
        vault = new CortexYieldVault(address(strategy));
        
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(owner, 100 ether);
    }

    // ============ DEPOSIT TESTS ============
    function testDeposit() public {
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit Deposited(user1, 10 ether);
        vault.deposit{value: 10 ether}();
        
        assertEq(vault.totalDeposited(), 10 ether);
        assertEq(vault.userBalances(user1), 10 ether);
    }

    function testMultipleUserDeposits() public {
        vm.prank(user1);
        vault.deposit{value: 10 ether}();
        
        vm.prank(user2);
        vault.deposit{value: 20 ether}();
        
        assertEq(vault.totalDeposited(), 30 ether);
        assertEq(vault.userBalances(user1), 10 ether);
        assertEq(vault.userBalances(user2), 20 ether);
    }

    // ============ WITHDRAWAL TESTS ============
    function testWithdraw() public {
        vm.prank(user1);
        vault.deposit{value: 50 ether}();
        
        uint256 beforeBalance = user1.balance;
        
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit Withdrawn(user1, 20 ether);
        vault.withdraw(20 ether);
        
        assertEq(vault.totalDeposited(), 30 ether);
        assertEq(vault.userBalances(user1), 30 ether);
        assertEq(user1.balance, beforeBalance + 20 ether);
    }

    function testCannotWithdrawMoreThanBalance() public {
        vm.prank(user1);
        vault.deposit{value: 10 ether}();
        
        vm.prank(user1);
        vm.expectRevert("Insufficient user balance");
        vault.withdraw(20 ether);
    }

    // ============ RISK SCORE TESTS ============
    function testGetRequiredDeposit() public view {
        assertEq(vault.getRequiredDeposit(), 0.24 ether);
    }

    function testFetchRiskScoreRequiresCorrectDeposit() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit RiskAssessmentRequested(0, 0);
        vault.fetchRiskScore{value: LLM_DEPOSIT}();
    }

    function testFetchRiskScoreFailsWithInsufficientDeposit() public {
        vm.prank(owner);
        vm.expectRevert("Insufficient deposit for LLM");
        vault.fetchRiskScore{value: LLM_DEPOSIT - 0.01 ether}();
    }

    // ============ AUTONOMOUS ACTION TESTS ============
    function testRequestAutonomousActionRequiresCorrectDeposit() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit RiskAssessmentRequested(0, 1);
        vault.requestAutonomousAction{value: LLM_DEPOSIT}();
    }

    function testRequestAutonomousActionFailsWithInsufficientDeposit() public {
        vm.prank(owner);
        vm.expectRevert("Insufficient deposit for LLM");
        vault.requestAutonomousAction{value: LLM_DEPOSIT - 0.01 ether}();
    }

    // ============ MARKET DATA TESTS ============
    function testFetchVolatilityIndexRequiresCorrectDeposit() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit RiskAssessmentRequested(0, 2);
        vault.fetchVolatilityIndex{value: JSON_DEPOSIT}();
    }

    function testFetchVolatilityIndexFailsWithInsufficientDeposit() public {
        vm.prank(owner);
        vm.expectRevert("Insufficient deposit for JSON agent");
        vault.fetchVolatilityIndex{value: JSON_DEPOSIT - 0.01 ether}();
    }

    // ============ OWNER ONLY TESTS ============
    function testOnlyOwnerCanFetchRiskScore() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.fetchRiskScore{value: LLM_DEPOSIT}();
    }

    function testOnlyOwnerCanRequestAutonomousAction() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.requestAutonomousAction{value: LLM_DEPOSIT}();
    }

    function testOnlyOwnerCanFetchVolatilityIndex() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.fetchVolatilityIndex{value: JSON_DEPOSIT}();
    }

    // ============ ADMIN TESTS ============
    function testRebalanceTo() public {
        SimpleYieldStrategy newStrategy = new SimpleYieldStrategy();
        
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit Rebalanced(address(strategy), address(newStrategy));
        vault.rebalanceTo(address(newStrategy));
        
        assertEq(address(vault.currentStrategy()), address(newStrategy));
    }

    function testRebalanceToFailsWithZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid strategy");
        vault.rebalanceTo(address(0));
    }

    function testRebalanceToFailsWithSameStrategy() public {
        vm.prank(owner);
        vm.expectRevert("Already using this strategy");
        vault.rebalanceTo(address(strategy));
    }

    function testSetRiskCheckInterval() public {
        vm.prank(owner);
        vault.setRiskCheckInterval(7200);
        assertEq(vault.riskCheckInterval(), 7200);
    }

    function testSetRiskCheckIntervalFailsWithZero() public {
        vm.prank(owner);
        vm.expectRevert("Invalid interval");
        vault.setRiskCheckInterval(0);
    }

    function testNonOwnerCannotSetRiskCheckInterval() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setRiskCheckInterval(7200);
    }

    // ============ USER BALANCE TESTS ============
    function testGetUserBalance() public {
        vm.prank(user1);
        vault.deposit{value: 15 ether}();
        
        assertEq(vault.getUserBalance(user1), 15 ether);
        assertEq(vault.getUserBalance(user2), 0);
    }

}