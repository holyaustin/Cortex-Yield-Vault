// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SimpleYieldStrategy {
    uint256 public totalDeposited;
    address public owner;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    function deposit() external payable {
        require(msg.value > 0, "Amount must be > 0");
        totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function depositAll() external payable {
        if (msg.value > 0) {
            totalDeposited += msg.value;
            emit Deposited(msg.sender, msg.value);
        }
    }

    function withdraw(uint256 amount) external {
        require(amount <= totalDeposited, "Insufficient balance");
        totalDeposited -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawAll() external {
        uint256 amount = totalDeposited;
        totalDeposited = 0;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }
}