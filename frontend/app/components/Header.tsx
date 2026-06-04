'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import ThemeToggle from './ThemeToggle';
import Link from 'next/link';

export default function Header() {
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