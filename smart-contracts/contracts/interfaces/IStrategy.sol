// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IStrategy {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function withdrawAll() external;
    function getBalance() external view returns (uint256);
}