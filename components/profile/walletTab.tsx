import { WalletData } from '@/types';
import { useState } from 'react';

const WalletTab: React.FC<{ walletData: WalletData }> = ({ walletData }) => {
  const [connectedWallets, setConnectedWallets] = useState([
    {
      id: 1,
      name: 'Stellar Wallet',
      address: 'stella...x8j2',
    },
  ]);

  const handleDisconnect = (walletId: number) => {
    setConnectedWallets((prev) =>
      prev.filter((wallet) => wallet.id !== walletId)
    );
  };

  const handleViewTransactions = () => {
    console.log('View transactions clicked');
  };

  const handleConnectWallet = () => {
    console.log('Connect wallet clicked');
  };

  return (
    <div className="w-full">
      {/* Wallet Information */}
      <div className="bg-white rounded-xl shadow-sm border p-8">
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Wallet Information
          </h3>
          <p className="text-gray-500">
            Manage your connected blockchain wallets
          </p>
        </div>

        <div className="space-y-6">
          {/* Connected Wallets */}
          {connectedWallets.map((wallet) => (
            <div
              key={wallet.id}
              className="flex items-center justify-between p-6 border rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-1">
                  {wallet.name}
                </h4>
                <p className="text-sm text-gray-500">{wallet.address}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleDisconnect(wallet.id)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Disconnect
                </button>
                <button
                  onClick={handleViewTransactions}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>View transaction</span>
                </button>
              </div>
            </div>
          ))}

          {/* Connect Another Wallet Section */}
          <div className="text-center py-12">
            <p className="text-gray-600 mb-6 text-lg">Connect another wallet</p>
            <button
              onClick={handleConnectWallet}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletTab;
