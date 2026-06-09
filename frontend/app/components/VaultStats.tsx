'use client';

import { useWeb3 } from '@/app/hooks/useWeb3';

export default function VaultStats() {
  const { totalDeposited, userBalance, currentStrategy, lastRiskCheck, riskCheckInterval, isConnected } = useWeb3();

  if (!isConnected) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card">
        <p className="text-sm text-gray-500 dark:text-gray-400">Your Balance</p>
        <p className="text-2xl font-bold text-primary">
          {parseFloat(userBalance).toFixed(4)} <span className="text-sm">STT</span>
        </p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-500 dark:text-gray-400">Total Value Locked</p>
        <p className="text-2xl font-bold text-primary">
          {parseFloat(totalDeposited).toFixed(4)} <span className="text-sm">STT</span>
        </p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-500 dark:text-gray-400">Current Strategy</p>
        <p className="text-sm font-mono truncate" title={currentStrategy as string}>
          {currentStrategy ? `${(currentStrategy as string).slice(0, 6)}...${(currentStrategy as string).slice(-4)}` : '—'}
        </p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-500 dark:text-gray-400">Risk Check Interval</p>
        <p className="text-lg font-medium">{riskCheckInterval ? `${Number(riskCheckInterval) / 3600} hour(s)` : '—'}</p>
        {lastRiskCheck > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Last: {new Date(lastRiskCheck * 1000).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}