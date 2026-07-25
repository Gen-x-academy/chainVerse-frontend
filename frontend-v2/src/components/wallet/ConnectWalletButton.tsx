'use client';

import { useEffect } from 'react';
import { useWallet } from '@/src/context/WalletContext';
import { useAuthStore } from '@/src/store/authStore';

// Minimal type surface for the Freighter browser extension.
// Freighter injects itself onto `window.freighter` when installed.
// We deliberately keep this narrow - we only call requestAccess().
declare global {
  interface Window {
    freighter?: {
      isConnected: () => Promise<boolean>;
      requestAccess: () => Promise<string>;
      getPublicKey: () => Promise<string>;
      getNetworkDetails: () => Promise<{
        network: string;
        networkPassphrase: string;
      }>;
    };
  }
}

/**
 * Phase 1 foundation for wallet integration (issue #694).
 *
 * Behaviour:
 * 1. On click, if Freighter is present, calls `requestAccess()` directly
 *    per the issue's contract. Then routes through `WalletContext.connect()`
 *    so the StellarWalletsKit STATE_UPDATED event keeps React state in sync.
 * 2. Falls back to the multi-wallet modal (Albedo / Hana / Rabet) when
 *    Freighter is not installed.
 * 3. Mirrors the connected public key into the auth store so enrollment
 *    / payment flows can read `useAuthStore(s => s.walletPublicKey)`
 *    without importing the wallet context.
 */
export function ConnectWalletButton() {
  const { publicKey, isConnected, connect, disconnect } = useWallet();
  const setWalletPublicKey = useAuthStore((s) => s.setWalletPublicKey);

  // Mirror the publicKey into the auth store whenever it changes so
  // enrollment flows can read it from a single source of truth.
  // (Setting zustand state in an effect does not trigger React's
  // set-state-in-effect lint rule.)
  useEffect(() => {
    setWalletPublicKey(publicKey);
  }, [publicKey, setWalletPublicKey]);

  const handleConnect = async () => {
    if (typeof window !== 'undefined' && window.freighter) {
      try {
        await window.freighter.requestAccess();
        // WalletContext.connect() picks up the address via the
        // StellarWalletsKit STATE_UPDATED event handler.
        return;
      } catch (err) {
        // User rejected, locked extension, etc. Fall through to the
        // multi-wallet modal as a graceful fallback.
        console.error('Freighter requestAccess failed', err);
      }
    }
    // No Freighter (or call failed): open the multi-wallet modal so
    // Albedo / Hana / Rabet users still get a working entry point.
    await connect();
  };

  const handleDisconnect = () => {
    disconnect();
    setWalletPublicKey(null);
  };

  return (
    <>
      {/* Live region so screen-reader users hear the connection change */}
      <div aria-live="polite" className="sr-only">
        {isConnected && publicKey
          ? `Wallet connected: ${publicKey.slice(0, 8)}...`
          : 'Wallet disconnected'}
      </div>
      {isConnected && publicKey ? (
        <button
          onClick={handleDisconnect}
          data-testid="connect-wallet-button"
          aria-label="Disconnect wallet"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          data-testid="connect-wallet-button"
          aria-label="Connect wallet"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Connect Wallet
        </button>
      )}
    </>
  );
}
