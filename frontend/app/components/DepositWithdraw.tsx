'use client';

import { useState } from 'react';
import { useWeb3 } from '@/app/hooks/useWeb3';
import toast from 'react-hot-toast';

export default function DepositWithdraw() {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const { deposit, withdraw, isPending, isConnected } = useWeb3();

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    try {
      await deposit(depositAmount);
      toast.success(`Deposited ${depositAmount} STT successfully!`);
      setDepositAmount('');
    } catch (error) {
      toast.error('Deposit failed. Check console for details.');
      console.error(error);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    try {
      await withdraw(withdrawAmount);
      toast.success(`Withdrawn ${withdrawAmount} STT successfully!`);
      setWithdrawAmount('');
    } catch (error) {
      toast.error('Withdrawal failed. Check console for details.');
      console.error(error);
    }
  };

  if (!isConnected) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Connect your wallet to deposit or withdraw</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="card">
        <h3 className="text-xl font-bold mb-4">Deposit STT</h3>
        <div className="space-y-4">
          <input
            type="number"
            step="0.01"
            placeholder="Amount in STT"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="input"
          />
          <button onClick={handleDeposit} disabled={isPending} className="btn-primary w-full">
            {isPending ? 'Processing...' : 'Deposit'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-xl font-bold mb-4">Withdraw STT</h3>
        <div className="space-y-4">
          <input
            type="number"
            step="0.01"
            placeholder="Amount in STT"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="input"
          />
          <button onClick={handleWithdraw} disabled={isPending} className="btn-outline w-full">
            {isPending ? 'Processing...' : 'Withdraw'}
          </button>
        </div>
      </div>
    </div>
  );
}