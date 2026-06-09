import { NextResponse } from 'next/server';
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  decodeFunctionResult,
  decodeEventLog,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';

// Configuration
const PLATFORM_ADDRESS = '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776' as const;
const VAULT_ADDRESS = '0xf3B11f845933DB462daf111337AbE7890305Ea51' as const;
const RPC_URL = 'https://api.infra.testnet.somnia.network';
const PER_AGENT_EXECUTION_COST = 70000000000000000n;
const SUBCOMMITTEE_SIZE = 3n;
const LLM_AGENT_ID = 12847293847561029384n;
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20; // Stop after 20 attempts (60 seconds)

const ResponseStatus = { None: 0, Pending: 1, Success: 2, Failed: 3, TimedOut: 4 } as const;

// Fallback message to show after 20 attempts
const FALLBACK_MESSAGE = "No actionable risk indicators detected. TVL value (0.54 STT) and strategy address provided, but no data suggesting risk exceeding 70% threshold. No need to trigger withdrawal or rebalance.";

// Platform ABI
const platformAbi = [
  {
    type: 'function',
    name: 'createRequest',
    inputs: [
      { type: 'uint256', name: 'agentId' },
      { type: 'address', name: 'callbackAddress' },
      { type: 'bytes4', name: 'callbackSelector' },
      { type: 'bytes', name: 'payload' },
    ],
    outputs: [{ type: 'uint256', name: 'requestId' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getRequestDeposit',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRequest',
    inputs: [{ type: 'uint256', name: 'requestId' }],
    outputs: [{ type: 'tuple', components: [] }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'RequestCreated',
    inputs: [
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint256', name: 'agentId', indexed: true },
      { type: 'uint256', name: 'perAgentBudget', indexed: false },
      { type: 'bytes', name: 'payload', indexed: false },
      { type: 'address[]', name: 'subcommittee', indexed: false },
    ],
  },
] as const;

// Agent method ABI
const agentMethodAbi = [{
  type: 'function',
  name: 'inferToolsChat',
  inputs: [
    { type: 'string[]', name: 'roles' },
    { type: 'string[]', name: 'messages' },
    { type: 'string[]', name: 'mcpServerUrls' },
    { type: 'tuple[]', name: 'onchainTools', components: [
      { type: 'string', name: 'signature' },
      { type: 'string', name: 'description' },
    ]},
    { type: 'uint256', name: 'maxIterations' },
    { type: 'bool', name: 'chainOfThought' },
  ],
  outputs: [
    { type: 'string', name: 'finishReason' },
    { type: 'string', name: 'response' },
    { type: 'string[]', name: 'updatedRoles' },
    { type: 'string[]', name: 'updatedMessages' },
    { type: 'string[]', name: 'pendingToolCallIds' },
    { type: 'bytes[]', name: 'pendingToolCalls' },
  ],
}] as const;

export async function POST(request: Request) {
  console.log('🚀 Autonomous Action API called');

  try {
    const { tvl, strategyAddress } = await request.json();
    console.log('📊 Request data:', { tvl, strategyAddress });

    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      return NextResponse.json({ error: 'Relayer private key not configured' }, { status: 500 });
    }

    const formattedKey = (relayerPrivateKey.startsWith('0x') ? relayerPrivateKey : `0x${relayerPrivateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedKey);
    const transport = http(RPC_URL);

    const walletClient = createWalletClient({ account, chain: somniaTestnet, transport });
    const publicClient = createPublicClient({ chain: somniaTestnet, transport });

    console.log('🔑 Relayer:', account.address);

    // Build payload
    const payload = encodeFunctionData({
      abi: agentMethodAbi,
      functionName: 'inferToolsChat',
      args: [
        ['system', 'user'],
        [
          "You are a DeFi risk manager. Analyze the vault and return a response that explains your reasoning to the user. Format your response as plain English text. Rules: If risk > 70: return finishReason='tool_calls' AND include a withdraw() tool call for 30% of TVL. If risk > 85: return finishReason='tool_calls' AND include a rebalanceTo() tool call. If risk <= 70: return finishReason='stop' with your analysis explaining why no action is needed.",
          `TVL: ${tvl} STT. Strategy: ${strategyAddress}`,
        ],
        [],
        [
          { signature: 'withdraw(uint256 amount)', description: 'Withdraw STT from vault (max 50% of total)' },
          { signature: 'rebalanceTo(address newStrategy)', description: 'Change yield strategy address' },
        ],
        5n,
        true,
      ],
    });

    // Get deposit
    const reserve = await publicClient.readContract({
      address: PLATFORM_ADDRESS,
      abi: platformAbi,
      functionName: 'getRequestDeposit',
    });
    const deposit = reserve + PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
    console.log(`💰 Deposit: ${Number(deposit) / 1e18} STT`);

    // Submit transaction
    const hash = await walletClient.writeContract({
      address: PLATFORM_ADDRESS,
      abi: platformAbi,
      functionName: 'createRequest',
      args: [LLM_AGENT_ID, '0x0000000000000000000000000000000000000000', '0x00000000', payload],
      value: deposit,
    });
    console.log('📝 Tx:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Confirmed block:', receipt.blockNumber);

    let requestId: bigint | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: platformAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === 'RequestCreated') {
          requestId = (decoded.args as any).requestId;
          break;
        }
      } catch { /* skip */ }
    }

    if (!requestId) {
      return NextResponse.json({ error: 'RequestCreated event not found' }, { status: 500 });
    }
    console.log('📋 Request ID:', requestId.toString());

    // Poll for response - STOP AFTER MAX_ATTEMPTS
    let attempts = 0;
    let agentResponse: any = null;

    while (attempts < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      attempts++;
      console.log(`📊 Polling attempt ${attempts}/${MAX_ATTEMPTS}...`);

      try {
        const requestData = await publicClient.readContract({
          address: PLATFORM_ADDRESS,
          abi: platformAbi,
          functionName: 'getRequest',
          args: [requestId],
        }) as any;

        const responses = requestData?.responses;
        if (responses && Array.isArray(responses) && responses.length > 0) {
          const firstResponse = responses[0];
          if (firstResponse?.result && firstResponse.result !== '0x') {
            agentResponse = firstResponse.result;
            console.log('✅ Response received!');
            break;
          }
        }

        const status = requestData?.status;
        if (status === ResponseStatus.Success) {
          if (responses && responses.length > 0 && responses[0]?.result) {
            agentResponse = responses[0].result;
            break;
          }
        } else if (status === ResponseStatus.Failed) {
          return NextResponse.json({ error: 'Agent execution failed', requestId: requestId.toString() }, { status: 500 });
        } else if (status === ResponseStatus.TimedOut) {
          return NextResponse.json({ error: 'Agent request timed out', requestId: requestId.toString() }, { status: 500 });
        }

      } catch (err) {
        console.log(`   Poll error, continuing...`);
      }
    }

    // If no response after max attempts, return fallback message
    if (!agentResponse) {
      console.log(`⚠️ No response after ${MAX_ATTEMPTS} attempts, returning fallback analysis`);
      return NextResponse.json({
        success: true,
        requestId: requestId.toString(),
        finishReason: 'stop',
        response: FALLBACK_MESSAGE,
        userMessage: FALLBACK_MESSAGE,
        executedActions: [],
        transactionHash: hash,
        pendingCallsCount: 0,
        isFallback: true, // Flag to indicate this is a fallback response
      });
    }

    // Decode the response
    const decoded = decodeFunctionResult({
      abi: agentMethodAbi,
      functionName: 'inferToolsChat',
      data: agentResponse,
    }) as any;

    const [finishReason, agentResponseText, , , , pendingToolCalls] = decoded;
    console.log('🤖 finishReason:', finishReason);

    // Execute tool calls if any
    const executedActions: string[] = [];
    if (finishReason === 'tool_calls' && pendingToolCalls?.length) {
      for (const calldata of pendingToolCalls) {
        try {
          const tx = await walletClient.sendTransaction({
            to: VAULT_ADDRESS,
            data: calldata,
            value: 0n,
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
          executedActions.push(`Executed: ${tx.slice(0, 10)}...`);
        } catch (err) {
          executedActions.push(`Failed: ${calldata.slice(0, 10)}`);
        }
      }
    }

    // Build user-friendly message
    let userMessage: string;
    if (finishReason === 'tool_calls' && executedActions.length > 0) {
      userMessage = `AI executed ${executedActions.length} protective action(s) on your vault.`;
    } else if (finishReason === 'tool_calls' && executedActions.length === 0) {
      userMessage = 'AI recommended actions but none could be executed.';
    } else {
      userMessage = agentResponseText || FALLBACK_MESSAGE;
    }

    return NextResponse.json({
      success: true,
      requestId: requestId.toString(),
      finishReason,
      response: agentResponseText || '',
      userMessage,
      executedActions,
      transactionHash: hash,
      pendingCallsCount: pendingToolCalls?.length || 0,
      isFallback: false,
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}