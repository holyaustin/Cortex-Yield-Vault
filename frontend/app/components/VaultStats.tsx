'use client';

import { useWeb3 } from '@/app/hooks/useWeb3';

export default function VaultStats() {
  const { totalDeposited, currentStrategy, lastRiskCheck, riskCheckInterval } = useWeb3();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card">
        <p className="text-sm text-gray-500 dark:text-gray-400">Total Value Locked</p>
        <p className="text-2xl font-bold text-primary">{parseFloat(totalDeposited).toFixed(4)} STT</p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-500 dark:text-gray-400">Current Strategy</p>
        <p className="text-sm font-mono truncate">{currentStrategy as string || '—'}</p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-500 dark:text-gray-400">Last Risk Check</p>
        <p className="text-lg font-medium">{lastRiskCheck ? new Date(Number(lastRiskCheck) * 1000).toLocaleString() : '—'}</p>
      </div>
      <div className="card">
        <p className="text-sm text-gray-500 dark:text-gray-400">Risk Check Interval</p>
        <p className="text-lg font-medium">{riskCheckInterval ? `${Number(riskCheckInterval) / 3600} hours` : '—'}</p>
      </div>
    </div>
  );
}