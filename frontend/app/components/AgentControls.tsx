'use client';

import { useState } from 'react';
import { useWeb3 } from '@/app/hooks/useWeb3';
import toast from 'react-hot-toast';

export default function AgentControls() {
  const [loading, setLoading] = useState<string | null>(null);
  const { requestRiskScore, requestAutonomousAction, fetchMarketData, isConnected } = useWeb3();

  const handleAction = async (action: 'risk' | 'autonomous' | 'market', method: () => Promise<any>, name: string) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }
    setLoading(action);
    try {
      await method();
      toast.success(`${name} request submitted! Check transaction status.`);
    } catch (error) {
      toast.error(`${name} failed. Check console for details.`);
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">🤖 AI Agent Controls</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Powered by Somnia LLM Inference Agent (0.24 STT per request) and JSON API Agent (0.12 STT)
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleAction('risk', requestRiskScore, 'Risk Score')}
          disabled={loading !== null}
          className="btn-outline flex flex-col items-center p-4"
        >
          <span className="text-2xl mb-2">📊</span>
          <span className="font-semibold">Fetch Risk Score</span>
          <span className="text-xs text-gray-500 mt-1">LLM Agent • 0.24 STT</span>
          {loading === 'risk' && <span className="text-xs mt-2 animate-pulse">Processing...</span>}
        </button>

        <button
          onClick={() => handleAction('autonomous', requestAutonomousAction, 'Autonomous Action')}
          disabled={loading !== null}
          className="btn-outline flex flex-col items-center p-4"
        >
          <span className="text-2xl mb-2">⚡</span>
          <span className="font-semibold">Autonomous Action</span>
          <span className="text-xs text-gray-500 mt-1">LLM Tools • 0.24 STT</span>
          {loading === 'autonomous' && <span className="text-xs mt-2 animate-pulse">Processing...</span>}
        </button>

        <button
          onClick={() => handleAction('market', fetchMarketData, 'Market Data')}
          disabled={loading !== null}
          className="btn-outline flex flex-col items-center p-4"
        >
          <span className="text-2xl mb-2">📈</span>
          <span className="font-semibold">Fetch Market Data</span>
          <span className="text-xs text-gray-500 mt-1">JSON API • 0.12 STT</span>
          {loading === 'market' && <span className="text-xs mt-2 animate-pulse">Processing...</span>}
        </button>
      </div>

      <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <p className="text-xs text-center text-gray-600 dark:text-gray-400">
          💡 Agent requests require STT for gas. Your wallet must have sufficient balance.
          Each request is processed by 3 independent runners for consensus.
        </p>
      </div>
    </div>
  );
}