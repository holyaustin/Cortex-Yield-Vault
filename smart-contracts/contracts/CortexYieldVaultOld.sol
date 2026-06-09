// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAgentRequester.sol";
import "./interfaces/ILLMAgent.sol";
import "./interfaces/IJSONApiAgent.sol";
import "./interfaces/IStrategy.sol";

contract CortexYieldVaultOld is Ownable, ReentrancyGuard {
    // ============ SOMNIA PLATFORM & AGENTS ============
    IAgentRequester public constant PLATFORM = IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant LLM_AGENT_ID        = 12847293847561029384;
    uint256 public constant LLM_PER_AGENT_PRICE = 0.07 ether;

    uint256 public constant JSON_AGENT_ID        = 13174292974160097713;
    uint256 public constant JSON_PER_AGENT_PRICE = 0.03 ether;

    uint256 public constant SUBCOMMITTEE_SIZE = 3;

    // ============ WHITELISTED TOOL SELECTORS ============
    bytes4 private constant SELECTOR_WITHDRAW  = bytes4(keccak256("withdraw(uint256)"));
    bytes4 private constant SELECTOR_REBALANCE = bytes4(keccak256("rebalanceTo(address)"));

    // ============ STATE ============
    IStrategy public currentStrategy;
    uint256 public totalDeposited;
    uint256 public lastRiskCheck;
    uint256 public riskCheckInterval = 3600;

    mapping(address => uint256) public userBalances;

    struct PendingRequest {
        uint256 requestId;
        uint256 requestType;
        int256  lastRiskScore;
        bool    isActive;
    }
    mapping(uint256 => PendingRequest) public pendingRequests;

    // ============ EVENTS ============
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RiskScoreFetched(uint256 requestId, int256 score);
    event RiskAssessmentRequested(uint256 requestId, uint256 requestType);
    event AgentActionExecuted(uint256 requestId, bytes4 selector, bytes action);
    event Rebalanced(address indexed fromStrategy, address indexed toStrategy);
    event MarketDataFetched(uint256 requestId, uint256 data);
    event AutonomousActionFailed(uint256 requestId, string reason);
    event HighRiskDetected(uint256 requestId, int256 score);
    event AgentResponseDebug(uint256 requestId, string finishReason, uint256 pendingCallsCount);

    // ============ CONSTRUCTOR ============
    constructor(address _initialStrategy) Ownable(msg.sender) {
        require(_initialStrategy != address(0), "Invalid strategy");
        currentStrategy = IStrategy(_initialStrategy);
    }

    // ============ USER FUNCTIONS ============
    function deposit() external payable nonReentrant {
        require(msg.value > 0, "Amount must be > 0");
        userBalances[msg.sender] += msg.value;
        totalDeposited           += msg.value;
        currentStrategy.deposit{value: msg.value}();
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0,                         "Amount must be > 0");
        require(amount <= userBalances[msg.sender], "Insufficient user balance");
        userBalances[msg.sender] -= amount;
        totalDeposited           -= amount;
        currentStrategy.withdraw(amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "STT transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function getUserBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    // ============ DEPOSIT HELPERS ============
    function _getDepositForLLM() internal view returns (uint256) {
        uint256 reserve = PLATFORM.getRequestDeposit();
        uint256 reward  = LLM_PER_AGENT_PRICE * SUBCOMMITTEE_SIZE;
        return reserve + reward;
    }

    function _getDepositForJSON() internal view returns (uint256) {
        uint256 reserve = PLATFORM.getRequestDeposit();
        uint256 reward  = JSON_PER_AGENT_PRICE * SUBCOMMITTEE_SIZE;
        return reserve + reward;
    }

    function _isAllowedSelector(bytes4 sel) internal pure returns (bool) {
        return sel == SELECTOR_WITHDRAW || sel == SELECTOR_REBALANCE;
    }

    function _extractSelector(bytes memory data) internal pure returns (bytes4 sel) {
        require(data.length >= 4, "Invalid calldata");
        assembly { sel := mload(add(data, 32)) }
    }

    // ============ AUTONOMOUS ACTION REQUEST ============
    function requestAutonomousAction() external payable onlyOwner returns (uint256 requestId) {
        uint256 depositReq = _getDepositForLLM();
        require(msg.value >= depositReq, "Insufficient deposit for LLM");

        // FIX: assign struct fields individually instead of using a struct literal.
        // Struct literals from interface-defined structs with dynamic (string) fields
        // cause a Panic(0x32) at runtime in some compiler versions — the compiler
        // generates out-of-bounds memory access when packing dynamic types inline.
        ILLMAgent.OnchainTool[] memory tools = new ILLMAgent.OnchainTool[](2);
        tools[0].signature   = "withdraw(uint256 amount)";
        tools[0].description = "Withdraw STT from vault (max 50% of total)";
        tools[1].signature   = "rebalanceTo(address newStrategy)";
        tools[1].description = "Change yield strategy address";

        string[] memory roles    = new string[](2);
        string[] memory messages = new string[](2);
        roles[0]    = "system";
        messages[0] = "You are a DeFi risk manager. Return tool calls to protect funds. Be conservative. ONLY return withdraw() if risk is HIGH (>70). ONLY return rebalanceTo() if risk is EXTREME (>85). If no action needed, return finishReason='stop' with NO tool calls.";
        roles[1]    = "user";
        messages[1] = string(abi.encodePacked(
            "TVL: ", _uintToString(totalDeposited),
            " STT. Strategy: ", _addressToString(address(currentStrategy))
        ));

        string[] memory mcpServers = new string[](0);

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferToolsChat.selector,
            roles, messages, mcpServers, tools, uint256(5), true
        );

        uint256 excess = msg.value - depositReq;
        requestId = PLATFORM.createRequest{value: depositReq}(
            LLM_AGENT_ID,
            address(this),
            this.handleAutonomousActionResponse.selector,
            payload
        );

        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            require(ok, "Refund failed");
        }

        pendingRequests[requestId] = PendingRequest(requestId, 1, 0, true);
        emit RiskAssessmentRequested(requestId, 1);
    }

    // ============ RESPONSE HANDLER ============
    function handleAutonomousActionResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(PLATFORM), "Only platform");

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit AutonomousActionFailed(requestId, "No successful response from agent");
            delete pendingRequests[requestId];
            return;
        }

        if (responses[0].result.length == 0) {
            emit AutonomousActionFailed(requestId, "Empty response data");
            delete pendingRequests[requestId];
            return;
        }

        (
            string memory finishReason,
            string memory agentResponse,
            ,   // updatedRoles       — unused
            ,   // updatedMessages    — unused
            ,   // pendingToolCallIds — unused
            bytes[] memory pendingCalls
        ) = abi.decode(
            responses[0].result,
            (string, string, string[], string[], string[], bytes[])
        );

        emit AgentResponseDebug(requestId, finishReason, pendingCalls.length);

        if (keccak256(bytes(finishReason)) == keccak256("tool_calls")) {
            if (pendingCalls.length > 0) {
                for (uint256 i = 0; i < pendingCalls.length; i++) {
                    if (pendingCalls[i].length >= 4) {
                        bytes4 sel = _extractSelector(pendingCalls[i]);
                        if (!_isAllowedSelector(sel)) {
                            emit AutonomousActionFailed(requestId, "Disallowed tool selector");
                            continue;
                        }
                        (bool ok, ) = address(this).call(pendingCalls[i]);
                        if (ok) {
                            emit AgentActionExecuted(requestId, sel, pendingCalls[i]);
                        } else {
                            emit AutonomousActionFailed(requestId, "Tool call execution failed");
                        }
                    }
                }
            } else {
                emit AutonomousActionFailed(requestId, "tool_calls finish reason but no pending calls");
            }
        } else if (keccak256(bytes(finishReason)) == keccak256("stop")) {
            emit AgentResponseDebug(requestId, string(abi.encodePacked("stop: ", agentResponse)), 0);
        } else if (keccak256(bytes(finishReason)) == keccak256("max_iterations")) {
            emit AutonomousActionFailed(requestId, "Agent reached max iterations");
        } else {
            emit AutonomousActionFailed(requestId, string(abi.encodePacked("Unknown finish reason: ", finishReason)));
        }

        delete pendingRequests[requestId];
    }

    // ============ RISK SCORE REQUEST ============
    function fetchRiskScore() external payable onlyOwner returns (uint256 requestId) {
        uint256 depositReq = _getDepositForLLM();
        require(msg.value >= depositReq, "Insufficient deposit for LLM");

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferNumber.selector,
            string(abi.encodePacked(
                "Current TVL: ", _uintToString(totalDeposited),
                " STT. Return a risk score from 0 (very safe) to 100 (extremely risky)."
            )),
            "You are a conservative DeFi risk analyst.",
            int256(0),
            int256(100),
            true
        );

        uint256 excess = msg.value - depositReq;
        requestId = PLATFORM.createRequest{value: depositReq}(
            LLM_AGENT_ID,
            address(this),
            this.handleRiskScoreResponse.selector,
            payload
        );

        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            require(ok, "Refund failed");
        }

        pendingRequests[requestId] = PendingRequest(requestId, 0, 0, true);
        emit RiskAssessmentRequested(requestId, 0);
    }

    function handleRiskScoreResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(PLATFORM), "Only platform");

        if (status != ResponseStatus.Success || responses.length == 0
            || responses[0].result.length == 0) {
            delete pendingRequests[requestId];
            return;
        }

        int256 score = abi.decode(responses[0].result, (int256));
        pendingRequests[requestId].lastRiskScore = score;
        emit RiskScoreFetched(requestId, score);

        if (score > 80 && totalDeposited > 0) {
            emit HighRiskDetected(requestId, score);
        }

        delete pendingRequests[requestId];
    }

    // ============ MARKET DATA ============
    function fetchVolatilityIndex() external payable onlyOwner returns (uint256 requestId) {
        uint256 depositReq = _getDepositForJSON();
        require(msg.value >= depositReq, "Insufficient deposit for JSON agent");

        bytes memory payload = abi.encodeWithSelector(
            IJSONApiAgent.fetchUint.selector,
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
            "bitcoin.usd",
            uint8(8)
        );

        uint256 excess = msg.value - depositReq;
        requestId = PLATFORM.createRequest{value: depositReq}(
            JSON_AGENT_ID,
            address(this),
            this.handleMarketDataResponse.selector,
            payload
        );

        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            require(ok, "Refund failed");
        }

        pendingRequests[requestId] = PendingRequest(requestId, 2, 0, true);
        emit RiskAssessmentRequested(requestId, 2);
    }

    function handleMarketDataResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(PLATFORM), "Only platform");

        if (status != ResponseStatus.Success || responses.length == 0
            || responses[0].result.length == 0) {
            delete pendingRequests[requestId];
            return;
        }

        uint256 data = abi.decode(responses[0].result, (uint256));
        emit MarketDataFetched(requestId, data);
        delete pendingRequests[requestId];
    }

    // ============ ADMIN ============
    function rebalanceTo(address newStrategy) external onlyOwner {
        require(newStrategy != address(0),               "Invalid strategy");
        require(newStrategy != address(currentStrategy), "Already using this strategy");

        currentStrategy.withdrawAll();

        uint256 bal = address(this).balance;
        if (bal > 0) {
            (bool ok, ) = newStrategy.call{value: bal}("");
            require(ok, "Transfer to new strategy failed");
        }

        address oldStrategy = address(currentStrategy);
        currentStrategy = IStrategy(newStrategy);
        emit Rebalanced(oldStrategy, newStrategy);
    }

    function setRiskCheckInterval(uint256 interval) external onlyOwner {
        require(interval > 0, "Invalid interval");
        riskCheckInterval = interval;
    }

    function getRequiredDeposit() external view returns (uint256) {
        return _getDepositForLLM();
    }

    // ============ HELPERS ============
    function _uintToString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 temp = v;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (v != 0) { buffer[--digits] = bytes1(uint8(48 + (v % 10))); v /= 10; }
        return string(buffer);
    }

    function _addressToString(address a) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0'; str[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(uint160(a) >> (8 * (19 - i)) >> 4)];
            str[3 + i * 2] = alphabet[uint8(uint160(a) >> (8 * (19 - i)) & 0x0f)];
        }
        return string(str);
    }

    receive() external payable {}
}