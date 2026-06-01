'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { mainnet } from 'wagmi/chains';

const somniaTestnet = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'Somnia Token', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_SOMNIA_RPC_URL!] } },
  blockExplorers: { default: { name: 'Somnia Explorer', url: 'https://testnet-explorer.somnia.network' } },
};

const config = getDefaultConfig({
  appName: 'Cortex Yield Vault',
  projectId: 'YOUR_WALLET_CONNECT_PROJECT_ID',
  chains: [somniaTestnet],
  transports: { [somniaTestnet.id]: http() },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}