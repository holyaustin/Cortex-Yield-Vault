'use client';

import { useSwitchChain, useAccount } from 'wagmi';

const SOMNIA_CHAIN_ID = 50312;

export default function NetworkSwitcher() {
  const { switchChain } = useSwitchChain();
  const { chainId } = useAccount();

  const isWrongNetwork = chainId && chainId !== SOMNIA_CHAIN_ID;

  if (!isWrongNetwork) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => switchChain({ chainId: SOMNIA_CHAIN_ID })}
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all"
      >
        ⚠️ Switch to Somnia Testnet
      </button>
    </div>
  );
}