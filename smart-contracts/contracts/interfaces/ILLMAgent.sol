// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ILLMAgent {
    struct OnchainTool {
        string signature;
        string description;
    }

    function inferNumber(
        string memory prompt,
        string memory system,
        int256 minValue,
        int256 maxValue,
        bool chainOfThought
    ) external returns (int256);

    function inferToolsChat(
        string[] memory roles,
        string[] memory messages,
        string[] memory mcpServerUrls,
        OnchainTool[] memory onchainTools,
        uint256 maxIterations,
        bool chainOfThought
    ) external returns (
        string memory finishReason,
        string memory response,
        string[] memory updatedRoles,
        string[] memory updatedMessages,
        string[] memory pendingToolCallIds,
        bytes[] memory pendingToolCalls
    );
}