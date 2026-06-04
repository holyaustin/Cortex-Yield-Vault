'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { useTheme } from './components/ThemeProvider';

// Somnia Testnet Chain Configuration
const somniaTestnet = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: {
    name: 'Somnia Token',
    symbol: 'STT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://api.infra.testnet.somnia.network'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://api.infra.testnet.somnia.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://shannon-explorer.somnia.network/',
    },
  },
  testnet: true,
} as const;

const config = getDefaultConfig({
  appName: 'Cortex Yield Vault',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [somniaTestnet],
  transports: {
    [somniaTestnet.id]: http(process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://api.infra.testnet.somnia.network'),
  },
  ssr: true,
});

const queryClient = new QueryClient();

// Custom theme with green colors
const customLightTheme = lightTheme({
  accentColor: '#00ff88',      // Primary green
  accentColorForeground: '#000000', // Black text on green button
  borderRadius: 'medium',
  fontStack: 'system',
});

const customDarkTheme = darkTheme({
  accentColor: '#00ff88',      // Primary green
  accentColorForeground: '#000000', // Black text on green button
  borderRadius: 'medium',
  fontStack: 'system',
});

function RainbowKitThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  
  return (
    <RainbowKitProvider
      theme={theme === 'dark' ? customDarkTheme : customLightTheme}
      modalSize="compact"
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitThemeWrapper>
          {children}
        </RainbowKitThemeWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  );
}