'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { vaultABI, VAULT_ADDRESS } from '@/app/lib/contract';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Define the return type for autonomous action
export interface AutonomousResult {
  success: boolean;
  requestId: string;
  finishReason: string;
  response: string;
  userMessage: string;
  executedActions: string[];
  transactionHash: string;
  pendingCallsCount: number;
}

export function useWeb3() {
  const { address, isConnected, chainId, status } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autonomousActionLoading, setAutonomousActionLoading] = useState(false);

  // Log connection status
  useEffect(() => {
    console.log('🔍 useWeb3 Debug:', {
      isConnected,
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
      chainId,
      status,
      isMounted,
      VAULT_ADDRESS
    });
  }, [isConnected, address, chainId, status, isMounted]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Read totalDeposited with logging
  const { 
    data: totalDeposited, 
    refetch: refetchTotalDeposited,
    isLoading: isLoadingTotal,
    error: totalError
  } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'totalDeposited',
    query: { 
      enabled: isConnected && isMounted,
      retry: 3,
      retryDelay: 1000,
    },
  });

  useEffect(() => {
    if (totalError) {
      console.error('❌ totalDeposited read error:', totalError);
      setError(totalError.message);
    } else if (totalDeposited !== undefined) {
      console.log('✅ totalDeposited:', formatEther(totalDeposited as bigint), 'STT');
    }
  }, [totalDeposited, totalError]);

  const { data: currentStrategy, error: strategyError } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'currentStrategy',
    query: { enabled: isConnected && isMounted },
  });

  useEffect(() => {
    if (strategyError) {
      console.error('❌ currentStrategy read error:', strategyError);
    } else if (currentStrategy) {
      console.log('✅ currentStrategy:', currentStrategy);
    }
  }, [currentStrategy, strategyError]);

  const { data: lastRiskCheck } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'lastRiskCheck',
    query: { enabled: isConnected && isMounted },
  });

  const { data: riskCheckInterval } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'riskCheckInterval',
    query: { enabled: isConnected && isMounted },
  });

  const { data: userBalance, refetch: refetchUserBalance, error: balanceError } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'getUserBalance',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && isMounted && !!address },
  });

  useEffect(() => {
    if (balanceError) {
      console.error('❌ getUserBalance read error:', balanceError);
    } else if (userBalance !== undefined && userBalance !== null) {
      console.log('✅ getUserBalance:', formatEther(userBalance as bigint), 'STT');
    }
  }, [userBalance, balanceError]);

  const { writeContractAsync, isPending, error: writeError, data: hash } = useWriteContract();

  useEffect(() => {
    if (writeError) {
      console.error('❌ Write contract error:', writeError);
      toast.error(`Transaction failed: ${writeError.message?.slice(0, 100) || 'Unknown error'}`);
    }
  }, [writeError]);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (hash) {
      console.log('📝 Transaction submitted:', hash);
      toast.loading(`Transaction submitted: ${hash.slice(0, 10)}...`, { id: 'tx' });
    }
    if (isConfirmed) {
      console.log('✅ Transaction confirmed:', hash);
      toast.success('Transaction confirmed!', { id: 'tx' });
      setTimeout(() => {
        refetchTotalDeposited();
        refetchUserBalance();
      }, 2000);
    }
  }, [hash, isConfirmed, refetchTotalDeposited, refetchUserBalance]);

  const getRequiredLLMDeposit = () => parseEther('0.24');
  const getRequiredJSONDeposit = () => parseEther('0.12');

  const deposit = async (amountSTT: string) => {
    console.log('💰 deposit called with amount:', amountSTT);
    
    if (!isConnected) {
      console.error('❌ Deposit failed: Wallet not connected');
      toast.error('Please connect your wallet first');
      throw new Error('Wallet not connected');
    }
    if (!isCorrectNetwork) {
      console.error('❌ Deposit failed: Wrong network', chainId);
      toast.error('Please switch to Somnia Testnet');
      throw new Error('Wrong network');
    }
    
    const amountWei = parseEther(amountSTT);
    console.log('💰 Deposit amount in wei:', amountWei.toString());
    
    toast.loading('Processing deposit...', { id: 'deposit' });
    try {
      const tx = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: vaultABI,
        functionName: 'deposit',
        value: amountWei,
      });
      console.log('✅ Deposit transaction sent:', tx);
      toast.success('Deposit submitted! Waiting for confirmation...', { id: 'deposit' });
      return tx;
    } catch (err) {
      console.error('❌ Deposit error:', err);
      toast.error('Deposit failed', { id: 'deposit' });
      throw err;
    }
  };

  const withdraw = async (amountSTT: string) => {
    console.log('💸 withdraw called with amount:', amountSTT);
    
    if (!isConnected) {
      console.error('❌ Withdraw failed: Wallet not connected');
      toast.error('Please connect your wallet first');
      throw new Error('Wallet not connected');
    }
    
    const amountWei = parseEther(amountSTT);
    console.log('💸 Withdraw amount in wei:', amountWei.toString());
    
    toast.loading('Processing withdrawal...', { id: 'withdraw' });
    try {
      const tx = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: vaultABI,
        functionName: 'withdraw',
        args: [amountWei],
      });
      console.log('✅ Withdraw transaction sent:', tx);
      toast.success('Withdrawal submitted!', { id: 'withdraw' });
      return tx;
    } catch (err) {
      console.error('❌ Withdraw error:', err);
      toast.error('Withdrawal failed', { id: 'withdraw' });
      throw err;
    }
  };

  const requestRiskScore = async () => {
    console.log('📊 requestRiskScore called');
    
    if (!isConnected) {
      console.error('❌ Risk score failed: Wallet not connected');
      toast.error('Please connect your wallet');
      throw new Error('Wallet not connected');
    }
    
    const depositAmount = getRequiredLLMDeposit();
    console.log('📊 Agent deposit amount:', depositAmount.toString());
    
    toast.loading('Requesting risk assessment from AI...', { id: 'risk' });
    
    try {
      const tx = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: vaultABI,
        functionName: 'fetchRiskScore',
        value: depositAmount,
      });
      console.log('✅ Risk score transaction sent:', tx);
      toast.success('Risk assessment requested! Waiting for agent response...', { id: 'risk' });
      return tx;
    } catch (err: any) {
      console.error('❌ Risk assessment error:', err);
      toast.error(`Risk assessment failed: ${err.message?.slice(0, 100) || 'Unknown error'}`, { id: 'risk' });
      throw err;
    }
  };

  // ============================================================
  // AUTONOMOUS ACTION - WITH STREAMING SUPPORT
  // ============================================================
  const triggerAutonomousAction = async (signal?: AbortSignal): Promise<AutonomousResult> => {
    console.log('⚡ triggerAutonomousAction called (via API)');
    
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }
    
    setAutonomousActionLoading(true);
    
    try {
      const tvl = formattedTotalDeposited;
      const strategy = currentStrategy;
      
      const response = await fetch('/api/agent/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tvl,
          strategyAddress: strategy,
          userAddress: address
        }),
        signal: signal // Pass the abort signal to fetch
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Autonomous action failed');
      }
      
      // Check if this is a fallback response (after timeout)
      if (data.isFallback) {
        console.log('📢 Received fallback response after timeout');
      }
      
      return data as AutonomousResult;
      
    } catch (err: any) {
      // Don't treat abort errors as real errors
      if (err.name === 'AbortError') {
        console.log('🛑 Autonomous action request was aborted');
        throw err;
      }
      console.error('❌ Autonomous action error:', err);
      toast.error(`Failed: ${err.message?.slice(0, 100)}`, { id: 'auto' });
      throw err;
    } finally {
      setAutonomousActionLoading(false);
    }
  };

  const fetchMarketData = async () => {
    console.log('📈 fetchMarketData called');
    
    if (!isConnected) {
      console.error('❌ Market data failed: Wallet not connected');
      toast.error('Please connect your wallet');
      throw new Error('Wallet not connected');
    }
    const depositAmount = getRequiredJSONDeposit();
    console.log('📈 JSON agent deposit:', depositAmount.toString());
    
    toast.loading('Fetching market data from API...', { id: 'market' });
    try {
      const tx = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: vaultABI,
        functionName: 'fetchVolatilityIndex',
        value: depositAmount,
      });
      console.log('✅ Market data transaction sent:', tx);
      toast.success('Market data requested!', { id: 'market' });
      return tx;
    } catch (err) {
      console.error('❌ Market data error:', err);
      toast.error('Market data fetch failed', { id: 'market' });
      throw err;
    }
  };

  const isCorrectNetwork = chainId === 50312;

  const formattedUserBalance = userBalance ? formatEther(userBalance as bigint) : '0';
  const formattedTotalDeposited = totalDeposited ? formatEther(totalDeposited as bigint) : '0';

  // Log final state
  useEffect(() => {
    console.log('📊 useWeb3 State Summary:', {
      isConnected,
      isCorrectNetwork,
      totalDeposited: formattedTotalDeposited,
      userBalance: formattedUserBalance,
      currentStrategy: currentStrategy ? `${currentStrategy.slice(0, 10)}...` : null,
      isLoading: isLoadingTotal,
      error
    });
  }, [isConnected, isCorrectNetwork, formattedTotalDeposited, formattedUserBalance, currentStrategy, isLoadingTotal, error]);

  return {
    isConnected,
    isMounted,
    isLoading: isLoadingTotal,
    address: isMounted ? address : null,
    chainId,
    isCorrectNetwork,
    totalDeposited: formattedTotalDeposited,
    userBalance: formattedUserBalance,
    currentStrategy,
    lastRiskCheck: lastRiskCheck ? Number(lastRiskCheck) : 0,
    riskCheckInterval: riskCheckInterval ? Number(riskCheckInterval) : 0,
    deposit,
    withdraw,
    requestRiskScore,
    triggerAutonomousAction,
    fetchMarketData,
    isPending: isPending || isConfirming || autonomousActionLoading,
    isConfirmed,
    transactionHash: hash,
    refetchTotalDeposited,
    refetchUserBalance,
    getRequiredLLMDeposit,
    getRequiredJSONDeposit,
    error,
  };
}