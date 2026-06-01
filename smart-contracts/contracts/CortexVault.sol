// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAgentRequester.sol";
import "./interfaces/ILLMAgent.sol";

contract CortexVault is Ownable {
    // Somnia Agent Platform (testnet address - VERIFY THIS)
    IAgentRequester public constant PLATFORM = IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);
    
    // Agent IDs from Somnia docs
    uint256 public constant LLM_AGENT_ID = 12875401142070969085;
    uint256 public constant JSON_API_AGENT_ID = 12345678901234567890; // Replace with actual
    
    // Gas configuration (from docs: LLM Inference = 0.07 SOMI per agent)
    uint256 public constant PER_AGENT_PRICE = 0.07 ether;
    uint256 public constant SUBCOMMITTEE_SIZE = 3;
    uint256 public constant RESERVE_FLOOR = 0.03 ether;
    
    // Yield strategy config
    IERC20 public immutable usdc;
    address public currentStrategy;
    uint256 public totalDeposited;
    uint256 public lastRiskCheck;
    uint256 public riskCheckInterval = 3600; // 1 hour
    
    // State for agent resume pattern
    struct PendingAgentRequest {
        uint256 requestId;
        string[] roles;
        string[] messages;
        uint256 stage; // 0: initial, 1: awaiting execution, 2: awaiting resume
    }
    mapping(uint256 => PendingAgentRequest) public pendingRequests;
    
    // Events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RiskAssessmentRequested(uint256 requestId);
    event RiskAssessmentCompleted(uint256 requestId, int256 riskScore, string action);
    event Rebalanced(address indexed fromStrategy, address indexed toStrategy);
    event AgentActionExecuted(uint256 requestId, bytes action);
    
    constructor(address _usdc, address _initialStrategy) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        currentStrategy = _initialStrategy;
    }
    
    // ============ USER FUNCTIONS ============
    
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // Approve and deposit into strategy
        usdc.approve(currentStrategy, amount);
        (bool success, ) = currentStrategy.call(abi.encodeWithSignature("deposit(uint256)", amount));
        require(success, "Strategy deposit failed");
        
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) external {
        require(amount > 0 && amount <= totalDeposited, "Invalid amount");
        
        (bool success, ) = currentStrategy.call(abi.encodeWithSignature("withdraw(uint256)", amount));
        require(success, "Strategy withdraw failed");
        
        require(usdc.transfer(msg.sender, amount), "Transfer failed");
        totalDeposited -= amount;
        emit Withdrawn(msg.sender, amount);
    }
    
    // ============ AGENT FUNCTIONS ============
    
    function requestRiskAssessment() external payable onlyOwner returns (uint256 requestId) {
        // Calculate deposit: reserve floor + (per_agent_price * subcommittee_size)
        uint256 deposit = RESERVE_FLOOR + (PER_AGENT_PRICE * SUBCOMMITTEE_SIZE);
        require(msg.value >= deposit, "Insufficient deposit");
        
        // Prepare tools for the agent
        ILLMAgent.OnchainTool[] memory tools = new ILLMAgent.OnchainTool[](2);
        tools[0] = ILLMAgent.OnchainTool(
            "withdraw(uint256 amount)",
            "Withdraw USDC from the yield strategy when risk is high"
        );
        tools[1] = ILLMAgent.OnchainTool(
            "rebalanceTo(address newStrategy)",
            "Switch to a different yield strategy based on market conditions"
        );
        
        // Build conversation
        string[] memory roles = new string[](2);
        string[] memory messages = new string[](2);
        roles[0] = "system";
        messages[0] = "You are a DeFi risk manager. Analyze market conditions and return tool calls to protect the vault. Be conservative.";
        roles[1] = "user";
        messages[1] = string(abi.encodePacked(
            "Current TVL: ", _uintToString(totalDeposited),
            " USDC. Last risk check: ", _uintToString(lastRiskCheck),
            ". Return rebalanceTo() if risk is high, otherwise return nothing."
        ));
        
        string[] memory mcpServers = new string[](1);
        mcpServers[0] = "https://mcp.somnia.network/defi-news"; // For market sentiment
        
        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferToolsChat.selector,
            roles, messages, mcpServers, tools, uint256(3), false
        );
        
        requestId = PLATFORM.createRequest{value: deposit}(
            LLM_AGENT_ID,
            address(this),
            this.handleAgentResponse.selector,
            payload
        );
        
        pendingRequests[requestId] = PendingAgentRequest({
            requestId: requestId,
            roles: roles,
            messages: messages,
            stage: 0
        });
        
        lastRiskCheck = block.timestamp;
        emit RiskAssessmentRequested(requestId);
    }
    
    function handleAgentResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(PLATFORM), "Only platform");
        require(status == ResponseStatus.Success, "Agent request failed");
        require(responses.length > 0, "No responses");
        
        PendingAgentRequest storage pending = pendingRequests[requestId];
        
        if (pending.stage == 0) {
            // First response - agent returned tool calls
            (string memory finishReason, , , , string[] memory pendingCallIds, bytes[] memory pendingCalls) = 
                abi.decode(responses[0].result, (string, string, string[], string[], string[], bytes[]));
            
            if (keccak256(bytes(finishReason)) == keccak256("tool_calls")) {
                // Execute the agent's tool calls
                for (uint i = 0; i < pendingCalls.length; i++) {
                    (bool success, ) = address(this).call(pendingCalls[i]);
                    require(success, "Agent action failed");
                    emit AgentActionExecuted(requestId, pendingCalls[i]);
                }
                
                // Resume agent with results
                pending.stage = 1;
                _resumeAgent(requestId, pendingCallIds);
            } else {
                // Agent finished
                emit RiskAssessmentCompleted(requestId, 0, finishReason);
                delete pendingRequests[requestId];
            }
        }
    }
    
    function _resumeAgent(uint256 requestId, string[] memory completedCallIds) internal {
        PendingAgentRequest storage pending = pendingRequests[requestId];
        
        // Append tool results to conversation
        string[] memory newRoles = new string[](pending.roles.length + completedCallIds.length);
        string[] memory newMessages = new string[](pending.messages.length + completedCallIds.length);
        
        // Copy existing
        for (uint i = 0; i < pending.roles.length; i++) {
            newRoles[i] = pending.roles[i];
            newMessages[i] = pending.messages[i];
        }
        
        // Add tool results
        for (uint i = 0; i < completedCallIds.length; i++) {
            newRoles[pending.roles.length + i] = "tool";
            newMessages[pending.roles.length + i] = string(abi.encodePacked(
                '{"tool_call_id":"', completedCallIds[i], '","content":"success"}'
            ));
        }
        
        // Resume with updated conversation
        ILLMAgent.OnchainTool[] memory emptyTools = new ILLMAgent.OnchainTool[](0);
        string[] memory emptyMcp = new string[](0);
        
        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferToolsChat.selector,
            newRoles, newMessages, emptyMcp, emptyTools, uint256(3), false
        );
        
        uint256 deposit = RESERVE_FLOOR + (PER_AGENT_PRICE * SUBCOMMITTEE_SIZE);
        uint256 newRequestId = PLATFORM.createRequest{value: deposit}(
            LLM_AGENT_ID,
            address(this),
            this.handleAgentResponse.selector,
            payload
        );
        
        pending.requestId = newRequestId;
        pending.roles = newRoles;
        pending.messages = newMessages;
        pending.stage = 2;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function setRiskCheckInterval(uint256 interval) external onlyOwner {
        riskCheckInterval = interval;
    }
    
    function rebalanceTo(address newStrategy) external onlyOwner {
        // First withdraw all from current strategy
        (bool withdrawSuccess, ) = currentStrategy.call(abi.encodeWithSignature("withdrawAll()"));
        require(withdrawSuccess, "Withdraw failed");
        
        // Then approve and deposit into new strategy
        usdc.approve(newStrategy, totalDeposited);
        (bool depositSuccess, ) = newStrategy.call(abi.encodeWithSignature("depositAll()"));
        require(depositSuccess, "Deposit failed");
        
        address oldStrategy = currentStrategy;
        currentStrategy = newStrategy;
        emit Rebalanced(oldStrategy, newStrategy);
    }
    
    // ============ HELPER FUNCTIONS ============
    
    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    receive() external payable {}
}