'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Filter } from 'lucide-react';
import { useWallet } from '@/src/context/WalletContext';
import { HORIZON_URL } from '@/src/lib/stellar';

interface Transaction {
  id: string;
  created_at: string;
  source_account: string;
  fee_charged: string;
  successful: boolean;
  memo?: string;
}

interface HorizonResponse {
  _embedded: { records: Transaction[] };
  _links: { next?: { href: string } };
}

type FilterType = 'all' | 'sent' | 'received';

const PAGE_LIMIT = 10;

export default function TransactionsPage() {
  const { isConnected, publicKey, connect } = useWallet();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchTxns = useCallback(
    async (nextCursor?: string) => {
      if (!publicKey) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_LIMIT), order: 'desc' });
        if (nextCursor) params.set('cursor', nextCursor);

        const res = await fetch(
          `${HORIZON_URL}/accounts/${publicKey}/transactions?${params}`,
        );
        if (!res.ok) throw new Error(`Horizon error: ${res.status}`);
        const data: HorizonResponse = await res.json();
        const records = data._embedded?.records ?? [];
        setTxns((prev) => (nextCursor ? [...prev, ...records] : records));
        const nextHref = data._links?.next?.href;
        if (nextHref && records.length === PAGE_LIMIT) {
          const url = new URL(nextHref);
          setCursor(url.searchParams.get('cursor'));
          setHasMore(true);
        } else {
          setCursor(null);
          setHasMore(false);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [publicKey],
  );

  useEffect(() => {
    if (publicKey) {
      setTxns([]);
      fetchTxns();
    }
  }, [publicKey, fetchTxns]);

  const filtered = txns.filter((tx) => {
    if (filter === 'sent') return tx.source_account === publicKey;
    if (filter === 'received') return tx.source_account !== publicKey;
    return true;
  });

  if (!isConnected || !publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center max-w-sm w-full">
          <ArrowDownLeft className="mx-auto mb-4 text-blue-600" size={40} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Wallet to View Transactions</h2>
          <p className="text-gray-500 text-sm mb-6">Connect your Stellar wallet to see your transaction history.</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
          <button
            onClick={() => { setTxns([]); fetchTxns(); }}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-6">
          <Filter size={14} className="text-gray-400" />
          {(['all', 'sent', 'received'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">{error}</div>
        )}

        {/* Transactions list */}
        {loading && txns.length === 0 ? (
          <ul className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-16">No transactions found.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((tx) => {
              const isSent = tx.source_account === publicKey;
              return (
                <li key={tx.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSent ? 'bg-red-100' : 'bg-green-100'
                    }`}
                  >
                    {isSent ? (
                      <ArrowUpRight size={16} className="text-red-600" />
                    ) : (
                      <ArrowDownLeft size={16} className="text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {isSent ? 'Sent' : 'Received'}
                      {tx.memo ? ` · ${tx.memo}` : ''}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">Fee: {tx.fee_charged} stroops</p>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        tx.successful ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {tx.successful ? 'Success' : 'Failed'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => cursor && fetchTxns(cursor)}
              disabled={loading}
              className="bg-white border border-gray-200 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
