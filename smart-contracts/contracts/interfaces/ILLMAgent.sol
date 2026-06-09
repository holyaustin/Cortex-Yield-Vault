// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ILLMAgent {
    // ✅ Must match the Somnia template exactly.
    // The platform decodes the payload using "tuple[]" — using a named struct
    // (OnchainTool[]) produces a different ABI selector and causes a 0x32 panic.
    struct OnchainTool {
        string signature;
        string description;
    }

    // inferToolsChat: the onchainTools param ABI-encodes as tuple[] — confirmed
    // by the Somnia template. The selector must match what the platform expects.
    function inferToolsChat(
        string[] memory roles,
        string[] memory messages,
        string[] memory mcpServerUrls,
        OnchainTool[] memory onchainTools,  // encodes as tuple(string,string)[]
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

    function inferNumber(
        string memory prompt,
        string memory system,
        int256 minValue,
        int256 maxValue,
        bool chainOfThought
    ) external returns (int256 response);

    function inferString(
        string memory prompt,
        string memory system,
        bool chainOfThought,
        string[] memory allowedValues
    ) external returns (string memory response);

    function inferChat(
        string[] memory roles,
        string[] memory messages,
        bool chainOfThought
    ) external returns (string memory response);
}