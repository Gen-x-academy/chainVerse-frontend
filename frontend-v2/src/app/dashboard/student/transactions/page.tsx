
'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/src/context/WalletContext';
import { HORIZON_URL } from '@/src/lib/stellar';

const TransactionHistoryPage = () => {
  const { publicKey } = useWallet();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setIsLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      try {
        const response = await fetch(`${HORIZON_URL}/accounts/${publicKey}/transactions`);
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }
        const data = await response.json();
        setTransactions(data._embedded.records);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [publicKey]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!publicKey) {
    return <div>Please connect your wallet to view your transaction history.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Transaction History</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Date</th>
              <th className="py-2 px-4 border-b">Type</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Transaction Hash</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx: any) => (
              <tr key={tx.id}>
                <td className="py-2 px-4 border-b">{new Date(tx.created_at).toLocaleDateString()}</td>
                <td className="py-2 px-4 border-b">{tx.operation_count}</td>
                <td className="py-2 px-4 border-b">{tx.successful ? 'Success' : 'Failed'}</td>
                <td className="py-2 px-4 border-b">
                  <a
                    href={`https://stellar.expert/explorer/public/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    {tx.hash.substring(0, 10)}...
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionHistoryPage;