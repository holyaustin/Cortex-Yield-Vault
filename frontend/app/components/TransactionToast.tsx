'use client';

import { Toaster } from 'react-hot-toast';

export default function TransactionToast() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--color-surface-light)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-primary)',
        },
        success: { duration: 5000, icon: '✅' },
        error: { duration: 6000, icon: '❌' },
        loading: { duration: Infinity, icon: '⏳' },
      }}
    />
  );
}