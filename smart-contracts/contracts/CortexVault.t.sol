// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "hardhat/console.sol";
import "../contracts/CortexYieldVault.sol";
import "../contracts/strategies/SimpleYieldStrategy.sol";

contract CortexYieldVaultTest {
    CortexYieldVault public vault;
    SimpleYieldStrategy public strategy;
    address public owner;
    address public user;
    address public user2;

    uint256 constant LLM_DEPOSIT = 0.24 ether;
    uint256 constant JSON_DEPOSIT = 0.12 ether;

    function setUp() public {
        owner = address(this);
        user = address(0x1234);
        user2 = address(0x5678);
        strategy = new SimpleYieldStrategy();
        vault = new CortexYieldVault(address(strategy));
        vm.deal(user, 1000 ether);
        vm.deal(user2, 500 ether);
        vm.deal(owner, 100 ether);
    }

    function testDeposit() public {
        vm.prank(user);
        vm.expectEmit(true, true, false, true);
        emit Deposited(user, 10 ether);
        vault.deposit{value: 10 ether}();
        assertEq(vault.totalDeposited(), 10 ether);
    }

    function testWithdraw() public {
        vm.prank(user);
        vault.deposit{value: 50 ether}();
        uint256 before = user.balance;
        vm.prank(user);
        vault.withdraw(20 ether);
        assertEq(vault.totalDeposited(), 30 ether);
        assertEq(user.balance, before + 20 ether);
    }

    function testRiskScoreRequest() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit RiskAssessmentRequested(0, 0);
        vault.fetchRiskScore{value: LLM_DEPOSIT}();
    }

    function testAutonomousActionRequest() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit RiskAssessmentRequested(0, 1);
        vault.requestAutonomousAction{value: LLM_DEPOSIT}();
    }

    function testJsonDataRequest() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit RiskAssessmentRequested(0, 2);
        vault.fetchVolatilityIndex{value: JSON_DEPOSIT}();
    }

    function testRebalance() public {
        SimpleYieldStrategy newStrategy = new SimpleYieldStrategy();
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit Rebalanced(address(strategy), address(newStrategy));
        vault.rebalanceTo(address(newStrategy));
        assertEq(vault.currentStrategy(), address(newStrategy));
    }
}