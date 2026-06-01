// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/CortexYieldVault.sol";
import "../contracts/strategies/SimpleYieldStrategy.sol";

// Declare events locally so we can use them with vm.expectEmit
interface ICortexYieldVaultEvents {
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RiskScoreFetched(uint256 requestId, int256 score);
    event RiskAssessmentRequested(uint256 requestId, uint256 requestType);
    event AgentActionExecuted(uint256 requestId, bytes action);
    event Rebalanced(address indexed fromStrategy, address indexed toStrategy);
    event MarketDataFetched(uint256 requestId, uint256 data);
}

contract CortexYieldVaultTest is Test, ICortexYieldVaultEvents {
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
        vm.expectEmit(true, true, false, true, address(vault));
        emit Deposited(user, 10 ether);
        vault.deposit{value: 10 ether}();
        assertEq(vault.totalDeposited(), 10 ether);
    }

    function testWithdraw() public {
        vm.prank(user);
        vault.deposit{value: 50 ether}();
        uint256 before = user.balance;
        vm.prank(user);
        vm.expectEmit(true, true, false, true, address(vault));
        emit Withdrawn(user, 20 ether);
        vault.withdraw(20 ether);
        assertEq(vault.totalDeposited(), 30 ether);
        assertEq(user.balance, before + 20 ether);
    }

    function testRiskScoreRequest() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(vault));
        emit RiskAssessmentRequested(0, 0);
        vault.fetchRiskScore{value: LLM_DEPOSIT}();
    }

    function testAutonomousActionRequest() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(vault));
        emit RiskAssessmentRequested(0, 1);
        vault.requestAutonomousAction{value: LLM_DEPOSIT}();
    }

    function testJsonDataRequest() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(vault));
        emit RiskAssessmentRequested(0, 2);
        vault.fetchVolatilityIndex{value: JSON_DEPOSIT}();
    }

    function testRebalance() public {
        SimpleYieldStrategy newStrategy = new SimpleYieldStrategy();
        vm.prank(owner);
        vm.expectEmit(true, true, false, true, address(vault));
        emit Rebalanced(address(strategy), address(newStrategy));
        vault.rebalanceTo(address(newStrategy));
        assertEq(vault.currentStrategy(), address(newStrategy));
    }
}