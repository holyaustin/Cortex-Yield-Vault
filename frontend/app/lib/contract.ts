import { getAddress } from 'viem';

// Contract Addresses (Somnia Testnet - Updated after redeploy)
export const PLATFORM_ADDRESS = '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776' as const;
export const VAULT_ADDRESS = '0xf3B11f845933DB462daf111337AbE7890305Ea51' as const;
export const STRATEGY_ADDRESS = '0x7f8937232BDc40aa8dc19Fc2B845AfF6C7cf0B4F' as const;

// Verify addresses are checksummed
export const VAULT_ADDRESS_CHECKSUMMED = getAddress(VAULT_ADDRESS);
export const PLATFORM_ADDRESS_CHECKSUMMED = getAddress(PLATFORM_ADDRESS);

// Updated ABI with all functions from the new contract
export const vaultABI = [
  // ============ USER FUNCTIONS ============
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // ============ VIEW FUNCTIONS ============
  {
    inputs: [],
    name: 'totalDeposited',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'currentStrategy',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lastRiskCheck',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'riskCheckInterval',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getRequiredDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'userBalances',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // ============ AGENT FUNCTIONS ============
  {
    inputs: [],
    name: 'fetchRiskScore',
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'requestAutonomousAction',
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'fetchVolatilityIndex',
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  
  // ============ ADMIN FUNCTIONS ============
  {
    inputs: [{ name: 'newStrategy', type: 'address' }],
    name: 'rebalanceTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'interval', type: 'uint256' }],
    name: 'setRiskCheckInterval',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  
  // ============ EVENTS ============
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' }
    ],
    name: 'Deposited',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' }
    ],
    name: 'Withdrawn',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: false, name: 'score', type: 'int256' }
    ],
    name: 'RiskScoreFetched',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: false, name: 'requestType', type: 'uint256' }
    ],
    name: 'RiskAssessmentRequested',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: false, name: 'selector', type: 'bytes4' },
      { indexed: false, name: 'action', type: 'bytes' }
    ],
    name: 'AgentActionExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'fromStrategy', type: 'address' },
      { indexed: true, name: 'toStrategy', type: 'address' }
    ],
    name: 'Rebalanced',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: false, name: 'data', type: 'uint256' }
    ],
    name: 'MarketDataFetched',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: false, name: 'reason', type: 'string' }
    ],
    name: 'AutonomousActionFailed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: false, name: 'score', type: 'int256' }
    ],
    name: 'HighRiskDetected',
    type: 'event',
  },
] as const;