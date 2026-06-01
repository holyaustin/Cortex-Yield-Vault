// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockStrategy {
    IERC20 public immutable token;
    uint256 public totalDeposited;
    
    constructor(address _token) {
        token = IERC20(_token);
    }
    
    function deposit(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        totalDeposited += amount;
    }
    
    function withdraw(uint256 amount) external {
        require(amount <= totalDeposited, "Insufficient balance");
        require(token.transfer(msg.sender, amount), "Transfer failed");
        totalDeposited -= amount;
    }
    
    function withdrawAll() external {
        uint256 amount = totalDeposited;
        totalDeposited = 0;
        require(token.transfer(msg.sender, amount), "Transfer failed");
    }
    
    function depositAll() external {
        uint256 balance = token.balanceOf(msg.sender);
        require(token.transferFrom(msg.sender, address(this), balance), "Transfer failed");
        totalDeposited += balance;
    }
}