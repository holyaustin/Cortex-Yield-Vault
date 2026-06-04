'use client';

import VaultStats from './components/VaultStats';
import DepositWithdraw from './components/DepositWithdraw';
import AgentControls from './components/AgentControls';
import TransactionToast from './components/TransactionToast';
import { useAccount } from 'wagmi';
import ContractDebug from './components/ContractDebug';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <>
      <TransactionToast />
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold">
            <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
              Cortex Yield Vault
            </span>
          </h1>
          <p className="text-gray-500 dark:text-gray-500 max-w-2xl mx-auto">
            Autonomous yield management powered by Somnia Agentic L1 infrastructure.
            AI-driven risk assessment and automatic rebalancing.
          </p>
          {!isConnected && (
            <div className="mt-4 p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/50">
              <p className="text-sm">🔌 Connect your wallet to interact with the vault</p>
            </div>
          )}
        </div>

        {/* Vault Statistics */}
        <VaultStats />

        {/* Deposit/Withdraw Section */}
        <DepositWithdraw />

        {/* Agent Controls */}
        <AgentControls />

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

        
        <ContractDebug />
      </div>
    </>
  );
}