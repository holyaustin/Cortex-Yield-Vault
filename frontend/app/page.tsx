'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConfig } from 'wagmi';  // Add useConfig
import { getPublicClient } from 'wagmi/actions';
import VaultStats from './components/VaultStats';
import DepositWithdraw from './components/DepositWithdraw';
import AgentControls from './components/AgentControls';
// import TransactionToast from './components/TransactionToast';
import ContractDebug from './components/ContractDebug';
import { useWeb3 } from './hooks/useWeb3';
import { VAULT_ADDRESS, vaultABI } from './lib/contract';

export default function Home() {
  const { isConnected } = useAccount();
  const wagmiConfig = useConfig(); // Get config from wagmi hook
  const { totalDeposited, refetchTotalDeposited, refetchUserBalance } = useWeb3();
  const [lastRiskScore, setLastRiskScore] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [highRiskDetected, setHighRiskDetected] = useState<number | null>(null);
  // NEW: State for market data
  const [marketData, setMarketData] = useState<{ requestId: number; data: number } | null>(null);
  const [isMarketDataLoading, setIsMarketDataLoading] = useState(false);

  // Set up event listeners
  useEffect(() => {
    if (!isConnected) return;

    const setupListeners = async () => {
      const publicClient = getPublicClient(wagmiConfig);
      
      if (!publicClient) return;

      // Watch for RiskScoreFetched events
      const unwatchRisk = publicClient.watchContractEvent({
        address: VAULT_ADDRESS,
        abi: vaultABI,
        eventName: 'RiskScoreFetched',
        onLogs: (logs) => {
          logs.forEach((log) => {
            const { requestId, score } = log.args;
            console.log(`Risk Score ${score} for request ${requestId}`);
            setLastRiskScore(Number(score));
            refetchTotalDeposited();
            refetchUserBalance();
          });
        },
      });

      // Watch for HighRiskDetected events
      const unwatchHighRisk = publicClient.watchContractEvent({
        address: VAULT_ADDRESS,
        abi: vaultABI,
        eventName: 'HighRiskDetected',
        onLogs: (logs) => {
          logs.forEach((log) => {
            const { requestId, score } = log.args;
            console.log(`⚠️ High Risk Detected: ${score} for request ${requestId}`);
            setHighRiskDetected(Number(score));
            setTimeout(() => setHighRiskDetected(null), 10000);
          });
        },
      });

      // Watch for AgentActionExecuted events
      const unwatchAction = publicClient.watchContractEvent({
        address: VAULT_ADDRESS,
        abi: vaultABI,
        eventName: 'AgentActionExecuted',
        onLogs: (logs) => {
          logs.forEach((log) => {
            const { requestId, selector, action } = log.args;
            console.log(`Agent action executed: ${selector} for request ${requestId}`);
            setLastAction(selector === '0x2e1a7d4d' ? 'withdraw' : 'rebalance');
            setTimeout(() => setLastAction(null), 5000);
            setTimeout(() => {
              refetchTotalDeposited();
              refetchUserBalance();
            }, 3000);
          });
        },
      });

      // NEW: Watch for MarketDataFetched events
      const unwatchMarketData = publicClient.watchContractEvent({
        address: VAULT_ADDRESS,
        abi: vaultABI,
        eventName: 'MarketDataFetched',
        onLogs: (logs) => {
          logs.forEach((log) => {
            const { requestId, data } = log.args;
            console.log(`📈 Market Data: requestId=${requestId}, data=${data}`);
            setMarketData({ requestId: Number(requestId), data: Number(data) });
            setIsMarketDataLoading(false);
            // Auto-hide after 15 seconds
            setTimeout(() => setMarketData(null), 15000);
          });
        },
      });

      return () => {
        unwatchRisk();
        unwatchHighRisk();
        unwatchAction();
        unwatchMarketData(); // NEW
      };
    };

    setupListeners();
  }, [isConnected, refetchTotalDeposited, refetchUserBalance, wagmiConfig]);

  // NEW: Handler for market data loading state from AgentControls
  const handleMarketDataRequest = () => {
    setIsMarketDataLoading(true);
  };

  return (
    <>
      
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold">
            <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
              Cortex Yield Vault
            </span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Autonomous yield management powered by Somnia Agentic L1 infrastructure.
            AI-driven risk assessment and automatic rebalancing.
          </p>
          {!isConnected && (
            <div className="mt-4 p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/50">
              <p className="text-sm">🔌 Connect your wallet to interact with the vault</p>
            </div>
          )}
        </div>

        {/* High Risk Alert */}
        {highRiskDetected && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-red-600 dark:text-red-400">High Risk Detected!</p>
                <p className="text-sm">Risk Score: {highRiskDetected}/100. Consider withdrawing funds.</p>
              </div>
            </div>
          </div>
        )}

        {/* NEW: Market Data Loading Indicator */}
        {isMarketDataLoading && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
              <p className="text-sm">Fetching market data from API...</p>
            </div>
          </div>
        )}

        {/* NEW: Market Data Display */}
        {marketData && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">📈 Bitcoin Price (USD)</span>
              <button 
                onClick={() => setMarketData(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold text-primary">
                ${(marketData.data / 100000000).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Request ID: {marketData.requestId} | Source: CoinGecko API
              </p>
            </div>
          </div>
        )}

        {/* Last Risk Score Display */}
        {lastRiskScore !== null && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Latest Risk Score</span>
              <span className={`text-2xl font-bold ${
                lastRiskScore > 80 ? 'text-red-500' : 
                lastRiskScore > 50 ? 'text-yellow-500' : 
                'text-green-500'
              }`}>
                {lastRiskScore}/100
              </span>
            </div>
            <div className="w-full bg-gray-300 rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  lastRiskScore > 80 ? 'bg-red-500' : 
                  lastRiskScore > 50 ? 'bg-yellow-500' : 
                  'bg-green-500'
                }`}
                style={{ width: `${lastRiskScore}%` }}
              />
            </div>
          </div>
        )}

        {/* Last Action Display */}
        {lastAction && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm">
              {lastAction === 'withdraw' 
                ? '🤖 Agent withdrew funds to protect the vault' 
                : '🤖 Agent rebalanced the strategy'}
            </p>
          </div>
        )}

        {/* Vault Statistics */}
        <VaultStats />

        {/* Deposit/Withdraw Section */}
        <DepositWithdraw />

        {/* Agent Controls - Pass market data handler */}
        <AgentControls onMarketDataRequest={handleMarketDataRequest} />

        {/* Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-bold mb-2">📖 How It Works</h3>
            <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-400">
              <li>• Deposit STT into the vault</li>
              <li>• LLM Agent analyzes market conditions</li>
              <li>• Agent returns calldata for actions (withdraw/rebalance)</li>
              <li>• Vault executes autonomously</li>
              <li>• JSON API Agent fetches external market data</li>
            </ul>
          </div>
          <div className="card">
            <h3 className="font-bold mb-2">🔗 Somnia Agent Details</h3>
            <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-400">
              <li>• LLM Inference Agent ID: <code className="text-primary">12847293847561029384</code></li>
              <li>• JSON API Agent ID: <code className="text-primary">13174292974160097713</code></li>
              <li>• Platform Address: <code className="text-primary">0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776</code></li>
              <li>• Required Deposit (LLM): 0.24 STT</li>
              <li>• Required Deposit (JSON): 0.12 STT</li>
            </ul>
          </div>
        </div>

        {/* Contract Address Display */}
        <div className="text-center text-xs text-gray-400">
          <p>Vault Contract: <code className="text-primary">{VAULT_ADDRESS}</code></p>
        </div>
      </div>

    </>
  );
}