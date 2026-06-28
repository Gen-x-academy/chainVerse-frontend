'use client';

import { useWallet } from '@/src/context/WalletContext';

export function ConnectWalletButton() {
  const { isConnected, publicKey, connect, disconnect } = useWallet();

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {isConnected && publicKey
          ? `Wallet connected: ${publicKey.slice(0, 8)}...`
          : 'Wallet disconnected'}
      </div>
      {isConnected && publicKey ? (
        <button
          onClick={disconnect}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
        </button>
      ) : (
        <button
          onClick={connect}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Connect Wallet
        </button>
      )}
    </>
  );
}
