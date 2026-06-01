// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IJSONApiAgent {
    function fetchUint(string memory url, string memory selector, uint8 decimals) external returns (uint256);
}