'use client';

import { useState } from 'react';
import { Copy, Check, RefreshCw, ExternalLink, Wallet } from 'lucide-react';
import { useWallet } from '@/src/context/WalletContext';
import { HORIZON_URL } from '@/src/lib/stellar';

export default function WalletPage() {
  const { publicKey, isConnected, connect, disconnect, xlmBalance, chvBalance } = useWallet();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCopy = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Re-trigger balance fetch by briefly disconnecting/reconnecting is not ideal;
    // instead we reload the page to re-run the WalletContext effect.
    window.location.reload();
  };

  if (!isConnected || !publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center max-w-sm w-full">
          <Wallet className="mx-auto mb-4 text-blue-600" size={40} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Wallet Connected</h2>
          <p className="text-gray-500 text-sm mb-6">Connect your Stellar wallet to manage balances and transactions.</p>
          <button
            onClick={connect}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const truncated = `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`;
  const expertUrl = `https://stellar.expert/explorer/testnet/account/${publicKey}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Wallet</h1>

        {/* Wallet address card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <p className="text-sm text-gray-500 mb-1">Connected Wallet</p>
          <div className="flex items-center gap-3">
            <span className="font-mono text-gray-800 text-sm break-all">{truncated}</span>
            <button
              onClick={handleCopy}
              aria-label="Copy public key"
              className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
            <a
              href={expertUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on Stellar Expert"
              className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-500 mb-1">XLM Balance</p>
            <p className="text-3xl font-bold text-gray-900">{parseFloat(xlmBalance).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">Stellar Lumens</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-500 mb-1">CHV Balance</p>
            <p className="text-3xl font-bold text-blue-600">{parseFloat(chvBalance).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">ChainVerse Token</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={disconnect}
            className="flex items-center gap-2 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Change Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
