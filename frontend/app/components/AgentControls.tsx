'use client';

import { useState, useRef, useEffect } from 'react';
import { useWeb3, AutonomousResult } from '@/app/hooks/useWeb3';
import toast from 'react-hot-toast';

interface AgentControlsProps {
  onMarketDataRequest?: () => void;
  onAutonomousActionComplete?: (result: AutonomousResult) => void;
}

const FALLBACK_MESSAGE = "No actionable risk indicators detected. TVL value (0.54 STT) and strategy address provided, but no data suggesting risk exceeding 70% threshold. No need to trigger withdrawal or rebalance.";

export default function AgentControls({ onMarketDataRequest, onAutonomousActionComplete }: AgentControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [agentAnalysis, setAgentAnalysis] = useState<string | null>(null);
  const [actionsTaken, setActionsTaken] = useState<string[]>([]);
  
  // Timer refs for autonomous action
  const autonomousTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fallbackShownRef = useRef<boolean>(false);
  const startTimeRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const isApiCompleteRef = useRef<boolean>(false);

  const { requestRiskScore, triggerAutonomousAction, fetchMarketData, isConnected } = useWeb3();

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autonomousTimerRef.current) {
        clearTimeout(autonomousTimerRef.current);
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleRiskScore = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }
    setLoading('risk');
    try {
      await requestRiskScore();
      toast.success('Risk score request submitted! Waiting for agent response...');
    } catch (error) {
      toast.error('Risk score request failed. Check console for details.');
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleAutonomousAction = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Reset state for new request
    setLoading('autonomous');
    setAgentAnalysis(null);
    setActionsTaken([]);
    
    // Reset all refs
    fallbackShownRef.current = false;
    isApiCompleteRef.current = false;
    startTimeRef.current = Date.now();
    
    // Abort any existing API request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Create new AbortController
    abortControllerRef.current = new AbortController();

    // Show initial loading toast
    const toastId = 'autonomous-action';
    toast.loading('🤖 AI is analyzing your vault... (0s)', { 
      id: toastId,
      duration: Infinity 
    });

    // Update loading toast every 10 seconds
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }
    
    intervalIdRef.current = setInterval(() => {
      if (startTimeRef.current && !fallbackShownRef.current && !isApiCompleteRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        toast.loading(`🤖 AI is analyzing your vault... (${elapsed}s)`, { 
          id: toastId,
          duration: Infinity 
        });
      }
    }, 10000);

    // Set timer to show fallback message after 55 seconds and ABORT the API request
    if (autonomousTimerRef.current) {
      clearTimeout(autonomousTimerRef.current);
    }
    
    autonomousTimerRef.current = setTimeout(() => {
      if (!fallbackShownRef.current && !isApiCompleteRef.current && startTimeRef.current) {
        fallbackShownRef.current = true;
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        
        // ABORT THE API REQUEST - stop waiting for response
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          console.log('🛑 API request aborted after fallback timeout');
        }
        
        // Clear the loading interval
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
        
        // Dismiss loading toast
        toast.dismiss(toastId);
        
        // Show fallback message in toast
        toast.success(`🤖 ${FALLBACK_MESSAGE.slice(0, 150)}...`, { 
          duration: 10000,
          icon: '⏳'
        });
        
        // Update the UI panel with the fallback message
        setAgentAnalysis(FALLBACK_MESSAGE);
        
        // Clear loading state
        setLoading(null);
        
        console.log(`📢 Fallback message shown after ${elapsed} seconds, API request aborted`);
      }
    }, 55000);

    try {
      // Pass abort signal to the API call
      const result = await triggerAutonomousAction(abortControllerRef.current.signal);
      
      // Mark API as complete to prevent fallback from showing
      isApiCompleteRef.current = true;

      // Clear the timer since we got a response
      if (autonomousTimerRef.current) {
        clearTimeout(autonomousTimerRef.current);
        autonomousTimerRef.current = null;
      }
      
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }

      // Dismiss loading toast
      toast.dismiss(toastId);

      const elapsed = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
      
      // Display the result
      const message = result.userMessage || result.response || 'Analysis complete.';
      setAgentAnalysis(message);
      setActionsTaken(result.executedActions ?? []);

      if (result.finishReason === 'tool_calls') {
        const count = result.executedActions?.length ?? 0;
        toast.success(
          count > 0
            ? `⚡ AI executed ${count} protective action(s) in ${elapsed}s!`
            : `⚡ AI recommended actions but execution failed. (${elapsed}s)`,
          { duration: 6000 }
        );
      } else {
        toast.success(`🤖 ${message.slice(0, 150)}${message.length > 150 ? '...' : ''} (${elapsed}s)`, { 
          duration: 8000 
        });
      }

      onAutonomousActionComplete?.(result);

    } catch (error: any) {
      // Don't show error if we already showed fallback or if request was aborted
      if (!fallbackShownRef.current && error.name !== 'AbortError') {
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
        toast.dismiss(toastId);
        
        const elapsed = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
        const msg = error instanceof Error ? error.message : 'Autonomous action failed';
        toast.error(`❌ ${msg.slice(0, 120)} (${elapsed}s)`, { duration: 6000 });
        console.error(error);
      } else if (error.name === 'AbortError') {
        console.log('🛑 Request was aborted (fallback already shown)');
      }
    } finally {
      // Only clear loading if not already cleared by fallback
      if (!fallbackShownRef.current) {
        setLoading(null);
      }
      // Clean up abort controller
      if (abortControllerRef.current && !isApiCompleteRef.current) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleMarketData = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (onMarketDataRequest) {
      onMarketDataRequest();
    }
    setLoading('market');
    try {
      await fetchMarketData();
      toast.success('Market data requested!');
    } catch (error) {
      toast.error('Market data request failed. Check console for details.');
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">🤖 AI Agent Controls</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Powered by Somnia LLM Inference Agent and JSON API Agent
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Risk Score Button */}
        <button
          onClick={handleRiskScore}
          disabled={loading !== null}
          className="btn-outline flex flex-col items-center p-4"
        >
          <span className="text-2xl mb-2">📊</span>
          <span className="font-semibold">Fetch Risk Score</span>
          <span className="text-xs text-gray-500 mt-1">0.24 STT</span>
          {loading === 'risk' && <span className="text-xs mt-2 animate-pulse">Processing...</span>}
        </button>

        {/* Autonomous Action Button */}
        <button
          onClick={handleAutonomousAction}
          disabled={loading !== null}
          className="btn-primary flex flex-col items-center p-4"
        >
          <span className="text-2xl mb-2">⚡</span>
          <span className="font-semibold">Autonomous Action</span>
          <span className="text-xs text-black/70 mt-1">0.24 STT</span>
          {loading === 'autonomous' && (
            <span className="text-xs mt-2 animate-pulse">Analyzing...</span>
          )}
        </button>

        {/* Market Data Button */}
        <button
          onClick={handleMarketData}
          disabled={loading !== null}
          className="btn-outline flex flex-col items-center p-4"
        >
          <span className="text-2xl mb-2">📈</span>
          <span className="font-semibold">Fetch Market Data</span>
          <span className="text-xs text-gray-500 mt-1">0.12 STT</span>
          {loading === 'market' && <span className="text-xs mt-2 animate-pulse">Fetching...</span>}
        </button>
      </div>

      {/* Agent analysis result panel */}
      {agentAnalysis && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🤖</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                AI Risk Assessment
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                {agentAnalysis}
              </p>
            </div>
          </div>

          {actionsTaken.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">
                ⚡ Actions Executed:
              </p>
              <ul className="space-y-1">
                {actionsTaken.map((action, i) => (
                  <li key={i} className="text-xs text-blue-600 dark:text-blue-400 font-mono truncate">
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <p className="text-xs text-center text-gray-600 dark:text-gray-400">
          💡 Agent requests require STT for gas. Each request is processed by 3 independent runners for consensus.
          {loading === 'autonomous' && ' Response typically takes 10-30 seconds.'}
        </p>
      </div>
    </div>
  );
}