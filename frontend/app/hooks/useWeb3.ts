'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { vaultABI, VAULT_ADDRESS } from '@/app/lib/contract';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export function useWeb3() {
  const { address, isConnected, chainId } = useAccount();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Read contract data - disable ENS resolution by not using useEnsName
  const { data: totalDeposited, refetch: refetchTotalDeposited } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'totalDeposited',
    query: { enabled: isConnected && isMounted },
  });

  const { data: currentStrategy } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'currentStrategy',
    query: { enabled: isConnected && isMounted },
  });

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

  const { writeContractAsync, isPending, data: hash } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const deposit = async (amountSTT: string) => {
    if (!isConnected) throw new Error('Wallet not connected');
    const amountWei = parseEther(amountSTT);
    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'deposit',
      value: amountWei,
    });
  };

  const withdraw = async (amountSTT: string) => {
    if (!isConnected) throw new Error('Wallet not connected');
    const amountWei = parseEther(amountSTT);
    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'withdraw',
      args: [amountWei],
    });
  };

  const requestRiskScore = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet');
      throw new Error('Wallet not connected');
    }
    const depositAmount = parseEther('0.24');
    toast.loading('Requesting risk assessment...', { id: 'risk' })
    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'fetchRiskScore',
      value: depositAmount,
      gas: BigInt(500000),
    });
  };

  const requestAutonomousAction = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet');
      throw new Error('Wallet not connected');
    }

    const depositAmount = parseEther('0.24');
    toast.loading('Requesting autonomous action...', { id: 'auto' });

    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'requestAutonomousAction',
      value: depositAmount,
      gas: BigInt(800000),
    });
    
  };

  const fetchMarketData = async () => {
    if (!isConnected) throw new Error('Wallet not connected');
    const depositAmount = parseEther('0.12');
    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'fetchVolatilityIndex',
      value: depositAmount,
    });
  };

  const isCorrectNetwork = chainId === 50312;

  return {
    isConnected,
    isMounted,
    address: isMounted ? address : null,
    chainId,
    isCorrectNetwork,
    totalDeposited: totalDeposited ? formatEther(totalDeposited as bigint) : '0',
    currentStrategy,
    lastRiskCheck: lastRiskCheck ? Number(lastRiskCheck) : 0,
    riskCheckInterval: riskCheckInterval ? Number(riskCheckInterval) : 0,
    deposit,
    withdraw,
    requestRiskScore,
    requestAutonomousAction,
    fetchMarketData,
    isPending: isPending || isConfirming,
    isConfirmed,
    transactionHash: hash,
    refetchTotalDeposited,
  };
}