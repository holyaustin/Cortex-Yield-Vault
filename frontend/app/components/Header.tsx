'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import ThemeToggle from './ThemeToggle';
import Link from 'next/link';

export default function Header() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  
  // Get STT balance
  const { data: balance } = useBalance({
    address: address,
    chainId: 50312, // Somnia Testnet chain ID
  });
  
  // Check if connected to Somnia Testnet
  const isSomniaNetwork = chainId === 50312;
  const networkName = isSomniaNetwork ? 'Somnia Testnet' : 'Wrong Network';
  const networkColor = isSomniaNetwork ? 'green' : 'red';

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
      <div className="container mx-auto px-4 py-4 max-w-6xl flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-black font-bold text-xl">C</span>
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-gray-900 dark:text-white">
              Cortex Yield Vault
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI-Powered DeFi on Somnia
            </p>
          </div>
        </Link>
        
        <div className="flex items-center space-x-3">
          <ThemeToggle />
          
          {/* Custom network badge with balance when connected */}
          {isConnected && (
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 bg-${networkColor}-500/10 border border-${networkColor}-500/30 rounded-lg transition-all duration-200`}>
              <div className={`w-2 h-2 bg-${networkColor}-500 rounded-full animate-pulse`} />
              <span className={`text-xs font-medium text-${networkColor}-600 dark:text-${networkColor}-400`}>
                {networkName}
              </span>
              {balance && isSomniaNetwork && (
                <>
                  <span className="text-gray-400 dark:text-gray-600">|</span>
                  <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                    {parseFloat(formatEther(balance.value)).toFixed(4)} STT
                  </span>
                </>
              )}
            </div>
          )}
          
          <ConnectButton 
            chainStatus="icon"
            showBalance={false}
            accountStatus="avatar"
          />
        </div>
      </div>
    </header>
  );
}