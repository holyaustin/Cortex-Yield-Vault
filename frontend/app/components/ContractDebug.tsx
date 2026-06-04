'use client';

import { useWeb3 } from '@/app/hooks/useWeb3';
import { useState } from 'react';
import { VAULT_ADDRESS } from '@/app/lib/contract';
import { getAddress } from 'viem';

export default function ContractDebug() {
  const { totalDeposited, currentStrategy, isConnected } = useWeb3();
  const [showDebug, setShowDebug] = useState(false);

  if (!showDebug) {
    return (
      <button
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-50 hover:opacity-100"
      >
        Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-green-400 text-xs p-4 rounded-lg font-mono z-50 max-w-md">
      <button
        onClick={() => setShowDebug(false)}
        className="float-right text-white hover:text-gray-400"
      >
        ✕
      </button>
      <div className="space-y-1">
        <p className="font-bold mb-2">🔍 Contract Debug</p>
        <p>Vault: {VAULT_ADDRESS.slice(0, 10)}...{VAULT_ADDRESS.slice(-8)}</p>
        <p>TVL: {totalDeposited} STT</p>
        <p>Strategy: {currentStrategy?.slice(0, 10)}...{currentStrategy?.slice(-8) || 'N/A'}</p>
        <p>Connected: {isConnected ? '✅' : '❌'}</p>
        <p className="text-gray-500 text-[10px] mt-2">Check console for agent logs</p>
      </div>
    </div>
  );
}