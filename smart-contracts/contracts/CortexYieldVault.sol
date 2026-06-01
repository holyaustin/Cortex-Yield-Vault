// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAgentRequester.sol";
import "./interfaces/ILLMAgent.sol";
import "./interfaces/IJSONApiAgent.sol";

contract CortexYieldVault is Ownable, ReentrancyGuard {
    // ============ SOMMIA PLATFORM & AGENTS ============
    IAgentRequester public constant PLATFORM = IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    // LLM Inference Agent (ID from docs)
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant LLM_PER_AGENT_PRICE = 0.07 ether;   // 0.07 STT per runner
    // JSON API Agent (ID from docs)
    uint256 public constant JSON_AGENT_ID = 13174292974160097713;
    uint256 public constant JSON_PER_AGENT_PRICE = 0.03 ether;   // 0.03 STT per runner

    uint256 public constant SUBCOMMITTEE_SIZE = 3;
    uint256 public constant MIN_DEPOSIT_RESERVE = 0.01 ether;    // per agent, floor

    // ============ STATE ============
    address public currentStrategy;
    uint256 public totalDeposited;          // native STT in vault (not including strategy yield)
    uint256 public lastRiskCheck;
    uint256 public riskCheckInterval = 3600; // 1 hour

    struct PendingRequest {
        uint256 requestId;
        uint256 requestType;   // 0 = risk score, 1 = tool call, 2 = data fetch
        int256 lastRiskScore;
        bytes32 extra;          // for future use
    }
    mapping(uint256 => PendingRequest) public pendingRequests;

    // ============ EVENTS ============
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RiskScoreFetched(uint256 requestId, int256 score);
    event RiskAssessmentRequested(uint256 requestId, uint256 requestType);
    event AgentActionExecuted(uint256 requestId, bytes action);
    event Rebalanced(address indexed fromStrategy, address indexed toStrategy);
    event MarketDataFetched(uint256 requestId, uint256 data);

    // ============ CONSTRUCTOR ============
    constructor(address _initialStrategy) Ownable(msg.sender) {
        require(_initialStrategy != address(0), "Invalid strategy");
        currentStrategy = _initialStrategy;
    }

    // ============ USER FUNCTIONS (native STT) ============
    function deposit() external payable nonReentrant {
        require(msg.value > 0, "Amount must be > 0");
        // Forward STT to strategy
        (bool success, ) = currentStrategy.call{value: msg.value}(abi.encodeWithSignature("deposit()"));
        require(success, "Strategy deposit failed");
        totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= totalDeposited, "Invalid amount");
        (bool success, ) = currentStrategy.call{value: 0}(abi.encodeWithSignature("withdraw(uint256)", amount));
        require(success, "Strategy withdraw failed");
        payable(msg.sender).transfer(amount);
        totalDeposited -= amount;
        emit Withdrawn(msg.sender, amount);
    }

    // ============ AGENT HELPERS ============
    function _getDepositForLLM() internal pure returns (uint256) {
        uint256 floor = MIN_DEPOSIT_RESERVE * SUBCOMMITTEE_SIZE;          // 0.03 STT
        uint256 reward = LLM_PER_AGENT_PRICE * SUBCOMMITTEE_SIZE;        // 0.21 STT
        return floor + reward;                                            // 0.24 STT
    }

    function _getDepositForJSON() internal pure returns (uint256) {
        uint256 floor = MIN_DEPOSIT_RESERVE * SUBCOMMITTEE_SIZE;          // 0.03 STT
        uint256 reward = JSON_PER_AGENT_PRICE * SUBCOMMITTEE_SIZE;       // 0.09 STT
        return floor + reward;                                            // 0.12 STT
    }

    // ============ 1. RISK SCORE (LLM inferNumber) ============
    function fetchRiskScore() external payable onlyOwner returns (uint256 requestId) {
        uint256 depositReq = _getDepositForLLM();
        require(msg.value >= depositReq, "Insufficient deposit for LLM");
        string memory prompt = string(abi.encodePacked(
            "Current STT deposited in vault: ", _uintToString(totalDeposited),
            ". Return a risk score from 0 (very safe) to 100 (extremely risky)."
        ));
        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferNumber.selector,
            prompt,
            "You are a conservative DeFi risk analyst. Consider market volatility and protocol risk.",
            int256(0), int256(100), true
        );
        requestId = PLATFORM.createRequest{value: depositReq}(
            LLM_AGENT_ID,
            address(this),
            this.handleRiskScoreResponse.selector,
            payload
        );
        pendingRequests[requestId] = PendingRequest(requestId, 0, 0, bytes32(0));
        emit RiskAssessmentRequested(requestId, 0);
        if (msg.value > depositReq) payable(msg.sender).transfer(msg.value - depositReq);
    }

    function handleRiskScoreResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(PLATFORM), "Only platform");
        require(status == ResponseStatus.Success && responses.length > 0, "Agent failed");
        int256 score = abi.decode(responses[0].result, (int256));
        pendingRequests[requestId].lastRiskScore = score;
        emit RiskScoreFetched(requestId, score);
        // Auto‑withdraw if score > 80
        if (score > 80 && totalDeposited > 0) {
            uint256 withdrawAmount = (totalDeposited * 30) / 100;
            (bool success, ) = address(this).call(abi.encodeWithSignature("withdraw(uint256)", withdrawAmount));
            if (success) emit AgentActionExecuted(requestId, abi.encodeWithSignature("withdraw(uint256)", withdrawAmount));
        }
    }

    // ============ 2. AUTONOMOUS ACTION (LLM inferToolsChat) ============
    function requestAutonomousAction() external payable onlyOwner returns (uint256 requestId) {
        uint256 depositReq = _getDepositForLLM();
        require(msg.value >= depositReq, "Insufficient deposit for LLM");

        ILLMAgent.OnchainTool[] memory tools = new ILLMAgent.OnchainTool[](2);
        tools[0] = ILLMAgent.OnchainTool("withdraw(uint256 amount)", "Withdraw STT from vault (max 50% of total)");
        tools[1] = ILLMAgent.OnchainTool("rebalanceTo(address newStrategy)", "Change yield strategy address");

        string[] memory roles = new string[](2);
        string[] memory messages = new string[](2);
        roles[0] = "system";
        messages[0] = "You are a DeFi risk manager. Return tool calls to protect funds. Be conservative.";
        roles[1] = "user";
        messages[1] = string(abi.encodePacked(
            "TVL: ", _uintToString(totalDeposited), " STT. Current strategy: ", _addressToString(currentStrategy)
        ));

        string[] memory mcpServers = new string[](1);
        mcpServers[0] = "https://mcp.somnia.network/defi-news"; // optional

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferToolsChat.selector,
            roles, messages, mcpServers, tools, uint256(3), true
        );

        requestId = PLATFORM.createRequest{value: depositReq}(
            LLM_AGENT_ID,
            address(this),
            this.handleAutonomousActionResponse.selector,
            payload
        );
        pendingRequests[requestId] = PendingRequest(requestId, 1, 0, bytes32(0));
        emit RiskAssessmentRequested(requestId, 1);
        if (msg.value > depositReq) payable(msg.sender).transfer(msg.value - depositReq);
    }

    function handleAutonomousActionResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(PLATFORM), "Only platform");
        require(status == ResponseStatus.Success && responses.length > 0, "Agent failed");

        (string memory finishReason, , , , , bytes[] memory calls) =
            abi.decode(responses[0].result, (string, string, string[], string[], string[], bytes[]));

        if (keccak256(bytes(finishReason)) == keccak256("tool_calls") && calls.length > 0) {
            for (uint i = 0; i < calls.length; i++) {
                (bool success, ) = address(this).call(calls[i]);
                require(success, "Tool call failed");
                emit AgentActionExecuted(requestId, calls[i]);
            }
        }
        delete pendingRequests[requestId];
    }

    // ============ 3. EXTERNAL DATA (JSON API) ============
    function fetchVolatilityIndex() external payable onlyOwner returns (uint256 requestId) {
        uint256 depositReq = _getDepositForJSON();
        require(msg.value >= depositReq, "Insufficient deposit for JSON agent");
        // Example: CoinGecko's BTC volatility index (mock URL, replace with real one)
        string memory url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
        string memory selector = "bitcoin.usd";
        bytes memory payload = abi.encodeWithSelector(
            IJSONApiAgent.fetchUint.selector,
            url,
            selector,
            uint8(8)   // decimals: 8
        );
        requestId = PLATFORM.createRequest{value: depositReq}(
            JSON_AGENT_ID,
            address(this),
            this.handleMarketDataResponse.selector,
            payload
        );
        pendingRequests[requestId] = PendingRequest(requestId, 2, 0, bytes32(0));
        emit RiskAssessmentRequested(requestId, 2);
        if (msg.value > depositReq) payable(msg.sender).transfer(msg.value - depositReq);
    }

    function handleMarketDataResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(PLATFORM), "Only platform");
        require(status == ResponseStatus.Success && responses.length > 0, "JSON agent failed");
        uint256 data = abi.decode(responses[0].result, (uint256));
        emit MarketDataFetched(requestId, data);
        delete pendingRequests[requestId];
    }

    // ============ ADMIN ============
    function rebalanceTo(address newStrategy) external onlyOwner {
        require(newStrategy != address(0) && newStrategy != currentStrategy, "Invalid");
        // Withdraw all from old strategy
        (bool withdrawOk, ) = currentStrategy.call(abi.encodeWithSignature("withdrawAll()"));
        require(withdrawOk, "Withdraw failed");
        // Deposit into new strategy
        (bool depositOk, ) = newStrategy.call{value: address(this).balance}(abi.encodeWithSignature("depositAll()"));
        require(depositOk, "Deposit failed");
        address old = currentStrategy;
        currentStrategy = newStrategy;
        emit Rebalanced(old, newStrategy);
    }

    function setRiskCheckInterval(uint256 interval) external onlyOwner {
        require(interval > 0, "Invalid interval");
        riskCheckInterval = interval;
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
            str[2 + i*2] = alphabet[uint8(uint160(a) >> (8*(19-i)) >> 4)];
            str[3 + i*2] = alphabet[uint8(uint160(a) >> (8*(19-i)) & 0x0f)];
        }
        return string(str);
    }

    receive() external payable {}
}