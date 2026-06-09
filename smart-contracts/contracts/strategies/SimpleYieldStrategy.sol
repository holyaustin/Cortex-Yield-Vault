// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IStrategy.sol";

contract SimpleYieldStrategy is IStrategy {
    uint256 public totalDeposited;
    address public owner;
    
    mapping(address => uint256) public userDeposits;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    // Fallback for direct STT transfers
    receive() external payable {
        totalDeposited += msg.value;
        userDeposits[tx.origin] += msg.value;
        emit Deposited(tx.origin, msg.value);
    }

    // deposit() - from IStrategy interface
    function deposit() external payable override {
        require(msg.value > 0, "Amount must be > 0");
        totalDeposited += msg.value;
        userDeposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external override {
        require(amount <= userDeposits[msg.sender], "Insufficient user balance");
        require(amount <= totalDeposited, "Insufficient total balance");
        
        userDeposits[msg.sender] -= amount;
        totalDeposited -= amount;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawAll() external override {
        uint256 amount = userDeposits[msg.sender];
        require(amount > 0, "No balance");
        
        userDeposits[msg.sender] = 0;
        totalDeposited -= amount;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, amount);
    }

    function getBalance() external view override returns (uint256) {
        return totalDeposited;
    }
    
    function getUserBalance(address user) external view returns (uint256) {
        return userDeposits[user];
    }
}