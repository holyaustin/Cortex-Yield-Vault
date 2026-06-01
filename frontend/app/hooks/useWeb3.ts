'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { vaultABI, VAULT_ADDRESS } from '@/app/lib/contract';

export function useWeb3() {
  const { address, isConnected } = useAccount();

  const { data: totalDeposited } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'totalDeposited',
  });

  const { data: currentStrategy } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'currentStrategy',
  });

  const { data: lastRiskCheck } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'lastRiskCheck',
  });

  const { data: riskCheckInterval } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultABI,
    functionName: 'riskCheckInterval',
  });

  const { writeContractAsync, isPending } = useWriteContract();

  const deposit = async (amountSTT: string) => {
    const amountWei = parseEther(amountSTT);
    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'deposit',
      value: amountWei,
    });
  };

  const withdraw = async (amountSTT: string) => {
    const amountWei = parseEther(amountSTT);
    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'withdraw',
      args: [amountWei],
    });
  };

  const requestRiskScore = async () => {
    const depositAmount = parseEther('0.24');
    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'fetchRiskScore',
      value: depositAmount,
    });
  };

  const requestAutonomousAction = async () => {
    const depositAmount = parseEther('0.24');
    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'requestAutonomousAction',
      value: depositAmount,
    });
  };

  const fetchMarketData = async () => {
    const depositAmount = parseEther('0.12');
    return writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultABI,
      functionName: 'fetchVolatilityIndex',
      value: depositAmount,
    });
  };

  return {
    isConnected,
    address,
    totalDeposited: totalDeposited ? formatEther(totalDeposited as bigint) : '0',
    currentStrategy,
    lastRiskCheck,
    riskCheckInterval,
    deposit,
    withdraw,
    requestRiskScore,
    requestAutonomousAction,
    fetchMarketData,
    isPending,
  };
}