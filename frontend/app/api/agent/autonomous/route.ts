import { NextResponse } from 'next/server';
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  webSocket, 
  encodeFunctionData, 
  decodeFunctionResult, 
  decodeEventLog,
  parseEventLogs
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';
import { PLATFORM_ADDRESS, VAULT_ADDRESS } from '@/app/lib/contract';

// Configuration
const RPC_URL = 'https://api.infra.testnet.somnia.network';
const WS_URL = 'wss://api.infra.testnet.somnia.network/ws';
const PER_AGENT_EXECUTION_COST = 70000000000000000n; // 0.07 STT
const SUBCOMMITTEE_SIZE = 3n;
const LLM_AGENT_ID = 12847293847561029384n;

// ResponseStatus enum values (matches Solidity contract)
const ResponseStatus = {
  None: 0,
  Pending: 1,
  Success: 2,
  Failed: 3,
  TimedOut: 4
} as const;

// Platform ABI (subset of IAgentRequester)
const platformAbi = [
  {
    type: 'function',
    name: 'createRequest',
    inputs: [
      { type: 'uint256', name: 'agentId' },
      { type: 'address', name: 'callbackAddress' },
      { type: 'bytes4', name: 'callbackSelector' },
      { type: 'bytes', name: 'payload' }
    ],
    outputs: [{ type: 'uint256', name: 'requestId' }],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'getRequestDeposit',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getRequest',
    inputs: [{ type: 'uint256', name: 'requestId' }],
    outputs: [{
      type: 'tuple',
      components: [
        { type: 'uint256', name: 'id' },
        { type: 'address', name: 'requester' },
        { type: 'address', name: 'callbackAddress' },
        { type: 'bytes4', name: 'callbackSelector' },
        { type: 'address[]', name: 'subcommittee' },
        { type: 'tuple[]', name: 'responses', components: [
          { type: 'address', name: 'validator' },
          { type: 'bytes', name: 'result' },
          { type: 'uint8', name: 'status' },
          { type: 'uint256', name: 'receipt' },
          { type: 'uint256', name: 'timestamp' },
          { type: 'uint256', name: 'executionCost' }
        ]},
        { type: 'uint256', name: 'responseCount' },
        { type: 'uint256', name: 'failureCount' },
        { type: 'uint256', name: 'threshold' },
        { type: 'uint256', name: 'createdAt' },
        { type: 'uint256', name: 'deadline' },
        { type: 'uint8', name: 'status' },
        { type: 'uint8', name: 'consensusType' },
        { type: 'uint256', name: 'remainingBudget' },
        { type: 'uint256', name: 'perAgentBudget' }
      ]
    }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'RequestCreated',
    inputs: [
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint256', name: 'agentId', indexed: true },
      { type: 'uint256', name: 'perAgentBudget', indexed: false },
      { type: 'bytes', name: 'payload', indexed: false },
      { type: 'address[]', name: 'subcommittee', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'RequestFinalized',
    inputs: [
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint8', name: 'status', indexed: false }
    ]
  }
] as const;

// Agent method ABI for inferToolsChat
const agentMethodAbi = [{
  type: 'function',
  name: 'inferToolsChat',
  inputs: [
    { type: 'string[]', name: 'roles' },
    { type: 'string[]', name: 'messages' },
    { type: 'string[]', name: 'mcpServerUrls' },
    { type: 'tuple[]', name: 'onchainTools', components: [
      { type: 'string', name: 'signature' },
      { type: 'string', name: 'description' }
    ]},
    { type: 'uint256', name: 'maxIterations' },
    { type: 'bool', name: 'chainOfThought' }
  ],
  outputs: [
    { type: 'string', name: 'finishReason' },
    { type: 'string', name: 'response' },
    { type: 'string[]', name: 'updatedRoles' },
    { type: 'string[]', name: 'updatedMessages' },
    { type: 'string[]', name: 'pendingToolCallIds' },
    { type: 'bytes[]', name: 'pendingToolCalls' }
  ]
}] as const;

export async function POST(request: Request) {
  console.log('🚀 Autonomous Action API called');
  
  try {
    const { tvl, strategyAddress } = await request.json();
    console.log('📊 Request data:', { tvl, strategyAddress });

    // Get relayer private key from environment
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      console.error('❌ RELAYER_PRIVATE_KEY not configured');
      return NextResponse.json({ error: 'Relayer private key not configured' }, { status: 500 });
    }

    // Format private key
    const formattedPrivateKey = relayerPrivateKey.startsWith('0x') 
      ? relayerPrivateKey as `0x${string}` 
      : `0x${relayerPrivateKey}` as `0x${string}`;
    
    const account = privateKeyToAccount(formattedPrivateKey);
    console.log('🔑 Relayer address:', account.address);
    
    // Create clients with chain parameter to fix the TypeScript errors
    const walletClient = createWalletClient({
      account,
      chain: somniaTestnet,
      transport: http(RPC_URL)
    });

    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: webSocket(WS_URL)
    });

    // 1. Encode the agent function call
    const roles = ["system", "user"];
    const messages = [
      "You are a DeFi risk manager. Return tool calls to protect funds. Be conservative. ONLY return withdraw() if risk is HIGH (>70). ONLY return rebalanceTo() if risk is EXTREME (>85). If no action needed, return finishReason='stop' with NO tool calls.",
      `TVL: ${tvl} STT. Strategy: ${strategyAddress}`
    ];
    const tools = [
      { signature: "withdraw(uint256 amount)", description: "Withdraw STT from vault (max 50% of total)" },
      { signature: "rebalanceTo(address newStrategy)", description: "Change yield strategy address" }
    ];

    const payload = encodeFunctionData({
      abi: agentMethodAbi,
      functionName: 'inferToolsChat',
      args: [roles, messages, [], tools, 5n, true]
    });

    console.log('📝 Payload encoded, length:', payload.length);

    // 2. Get required deposit
    const reserve = await publicClient.readContract({
      address: PLATFORM_ADDRESS,
      abi: platformAbi,
      functionName: 'getRequestDeposit'
    });
    const reward = PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
    const deposit = reserve + reward;

    console.log(`📊 Deposit required: ${Number(deposit) / 1e18} STT`);

    // 3. Send request to platform
    console.log('📝 Sending transaction to platform...');
    const hash = await walletClient.writeContract({
      address: PLATFORM_ADDRESS,
      abi: platformAbi,
      functionName: 'createRequest',
      args: [
        LLM_AGENT_ID,
        '0x0000000000000000000000000000000000000000',
        '0x00000000',
        payload
      ],
      value: deposit
    });

    console.log('📝 Transaction submitted:', hash);

    // 4. Wait for transaction and extract requestId
    console.log('⏳ Waiting for transaction confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
    
    // Parse event logs to get requestId
    let requestId: bigint | null = null;
    
    try {
      const parsedEvents = parseEventLogs({
        abi: platformAbi,
        logs: receipt.logs,
        eventName: 'RequestCreated'
      });
      
      if (parsedEvents.length > 0) {
        requestId = (parsedEvents[0].args as any).requestId;
      }
    } catch {
      // Fallback to manual decoding
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: platformAbi,
            data: log.data,
            topics: log.topics
          });
          if (decoded.eventName === 'RequestCreated') {
            requestId = (decoded.args as any).requestId;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (!requestId) {
      console.error('❌ RequestCreated event not found');
      return NextResponse.json({ 
        error: 'RequestCreated event not found in transaction logs',
        transactionHash: hash
      }, { status: 500 });
    }
    
    console.log('📋 Request ID:', requestId.toString());

    // 5. Poll for request finalization (since WebSocket may have issues)
    console.log('⏳ Waiting for agent response...');
    let finalizedStatus: number | null = null;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    
    while (finalizedStatus === null && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      try {
        const agentRequest = await publicClient.readContract({
          address: PLATFORM_ADDRESS,
          abi: platformAbi,
          functionName: 'getRequest',
          args: [requestId]
        }) as any;
        
        const status = agentRequest.status;
        
        if (status === ResponseStatus.Success) {
          finalizedStatus = ResponseStatus.Success;
        } else if (status === ResponseStatus.Failed) {
          finalizedStatus = ResponseStatus.Failed;
        } else if (status === ResponseStatus.TimedOut) {
          finalizedStatus = ResponseStatus.TimedOut;
        }
        
        if (finalizedStatus !== null) {
          console.log(`📊 Request finalized with status: ${finalizedStatus}`);
        }
      } catch {
        console.log(`⏳ Waiting for request to be available... (${attempts}/${maxAttempts})`);
      }
    }

    if (finalizedStatus !== ResponseStatus.Success) {
      const errorMsg = finalizedStatus === ResponseStatus.Failed ? 'Agent execution failed' : 'Request timed out';
      console.error(`❌ ${errorMsg}`);
      return NextResponse.json({ 
        error: errorMsg,
        requestId: requestId.toString()
      }, { status: 500 });
    }

    // 6. Get the agent response
    console.log('📡 Fetching agent response...');
    const agentRequest = await publicClient.readContract({
      address: PLATFORM_ADDRESS,
      abi: platformAbi,
      functionName: 'getRequest',
      args: [requestId]
    }) as any;

    if (!agentRequest.responses || agentRequest.responses.length === 0) {
      console.error('❌ No responses from agent');
      return NextResponse.json({ error: 'No responses from agent' }, { status: 500 });
    }

    const responseBytes = agentRequest.responses[0].result;
    console.log('📦 Response bytes length:', responseBytes.length);

    const result = decodeFunctionResult({ 
      abi: agentMethodAbi, 
      functionName: 'inferToolsChat', 
      data: responseBytes 
    }) as any;

    const { finishReason, response, pendingToolCalls } = result;
    console.log('🤖 Agent Response:', { 
      finishReason, 
      response: response?.slice(0, 200), 
      pendingCallsCount: pendingToolCalls?.length || 0 
    });

    // 7. Execute any tool calls
    const executedActions: string[] = [];
    
    if (finishReason === 'tool_calls' && pendingToolCalls && pendingToolCalls.length > 0) {
      console.log(`🔧 Executing ${pendingToolCalls.length} tool call(s)...`);
      
      for (let i = 0; i < pendingToolCalls.length; i++) {
        const calldata = pendingToolCalls[i];
        const selector = calldata.slice(0, 10);
        console.log(`🔧 Tool call ${i + 1}: selector = ${selector}`);
        
        try {
          const tx = await walletClient.sendTransaction({
            to: VAULT_ADDRESS,
            data: calldata as `0x${string}`,
            value: 0n
          });
          
          await publicClient.waitForTransactionReceipt({ hash: tx });
          executedActions.push(`Executed: ${selector} - Tx: ${tx.slice(0, 10)}...`);
          console.log(`✅ Tool call ${i + 1} executed: ${tx}`);
        } catch (execError) {
          console.error(`❌ Tool call ${i + 1} failed:`, execError);
          executedActions.push(`Failed: ${selector}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      requestId: requestId.toString(),
      finishReason,
      response: response || '',
      executedActions,
      transactionHash: hash,
      pendingCallsCount: pendingToolCalls?.length || 0
    });

  } catch (error: any) {
    console.error('❌ Autonomous action error:', error);
    return NextResponse.json({ 
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}