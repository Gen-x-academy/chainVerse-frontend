'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  StellarWalletsKit,
  KitEventType,
} from '@creit.tech/stellar-wallets-kit';
import { initStellarWalletsKit, HORIZON_URL, STELLAR_NETWORK, CONTRACT_ADDRESSES } from '@/src/lib/stellar';

interface WalletContextType {
  publicKey: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  xlmBalance: string;
  chvBalance: string;
}

const WalletContext = createContext<WalletContextType>(null!);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [xlmBalance, setXlmBalance] = useState('0');
  const [chvBalance, setChvBalance] = useState('0');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initStellarWalletsKit();

    StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
      setPublicKey(event.payload.address ?? null);
    });

    StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      setPublicKey(null);
      setXlmBalance('0');
      setChvBalance('0');
    });
  }, []);

  const fetchBalances = useCallback(async (address: string) => {
    try {
      const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
      if (!res.ok) return;
      const data = await res.json();

      const native = data.balances?.find(
        (b: { asset_type: string }) => b.asset_type === 'native',
      );
      if (native) setXlmBalance(native.balance);

      if (CONTRACT_ADDRESSES.chvToken) {
        const chv = data.balances?.find(
          (b: { asset_code?: string }) => b.asset_code === 'CHV',
        );
        if (chv) setChvBalance(chv.balance);
      }
    } catch {
      // Horizon unreachable — leave balances at previous values
    }
  }, []);

  useEffect(() => {
    if (publicKey) {
      fetchBalances(publicKey);
    }
  }, [publicKey, fetchBalances]);

  const connect = useCallback(async () => {
    const { address } = await StellarWalletsKit.authModal();
    setPublicKey(address);
  }, []);

  const disconnect = useCallback(() => {
    StellarWalletsKit.disconnect();
    setPublicKey(null);
    setXlmBalance('0');
    setChvBalance('0');
  }, []);

  return (
    <WalletContext.Provider
      value={{ publicKey, isConnected: !!publicKey, connect, disconnect, xlmBalance, chvBalance }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
