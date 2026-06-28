'use client';

import { useState } from 'react';
import { Gift, CheckCircle, Clock } from 'lucide-react';
import { useWallet } from '@/src/context/WalletContext';

interface Reward {
  courseId: string;
  courseTitle: string;
  amount: string;
  claimed: boolean;
  claimedAt?: string;
}

// Placeholder data – replace with real contract calls when available
const MOCK_REWARDS: Reward[] = [
  { courseId: 'course-1', courseTitle: 'Intro to Stellar', amount: '50', claimed: false },
  { courseId: 'course-2', courseTitle: 'Smart Contracts 101', amount: '75', claimed: true, claimedAt: '2025-05-10' },
];

function RewardClaimButton({ reward, onClaim }: { reward: Reward; onClaim: (id: string) => void }) {
  const [loading, setLoading] = useState(false);

  const handleClaim = async () => {
    setLoading(true);
    // TODO: call contracts.claimReward(courseId) via Stellar SDK
    await new Promise((r) => setTimeout(r, 1000));
    onClaim(reward.courseId);
    setLoading(false);
  };

  if (reward.claimed) {
    return (
      <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
        <CheckCircle size={14} /> Claimed
      </span>
    );
  }

  return (
    <button
      onClick={handleClaim}
      disabled={loading}
      className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
    >
      {loading ? 'Claiming…' : 'Claim'}
    </button>
  );
}

export default function RewardsPage() {
  const { isConnected, publicKey, connect, chvBalance } = useWallet();
  const [rewards, setRewards] = useState<Reward[]>(MOCK_REWARDS);

  const handleClaim = (courseId: string) => {
    setRewards((prev) =>
      prev.map((r) =>
        r.courseId === courseId
          ? { ...r, claimed: true, claimedAt: new Date().toISOString().slice(0, 10) }
          : r,
      ),
    );
  };

  if (!isConnected || !publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center max-w-sm w-full">
          <Gift className="mx-auto mb-4 text-blue-600" size={40} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Wallet to View Rewards</h2>
          <p className="text-gray-500 text-sm mb-6">You need a connected wallet to claim CHV token rewards.</p>
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

  const claimable = rewards.filter((r) => !r.claimed);
  const claimed = rewards.filter((r) => r.claimed);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">CHV Rewards</h1>
        <p className="text-gray-500 text-sm mb-6">Earn CHV tokens by completing courses.</p>

        {/* Balance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 flex items-center gap-4">
          <Gift className="text-blue-600" size={32} />
          <div>
            <p className="text-sm text-gray-500">Current CHV Balance</p>
            <p className="text-3xl font-bold text-blue-600">{parseFloat(chvBalance).toFixed(2)}</p>
          </div>
        </div>

        {/* Claimable rewards */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Clock size={16} className="text-orange-500" /> Claimable Rewards
          </h2>
          {claimable.length === 0 ? (
            <p className="text-gray-400 text-sm">No claimable rewards at the moment.</p>
          ) : (
            <ul className="space-y-3">
              {claimable.map((r) => (
                <li key={r.courseId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{r.courseTitle}</p>
                    <p className="text-sm text-blue-600 font-semibold">+{r.amount} CHV</p>
                  </div>
                  <RewardClaimButton reward={r} onClaim={handleClaim} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Claimed history */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500" /> Claim History
          </h2>
          {claimed.length === 0 ? (
            <p className="text-gray-400 text-sm">No claimed rewards yet.</p>
          ) : (
            <ul className="space-y-3">
              {claimed.map((r) => (
                <li key={r.courseId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{r.courseTitle}</p>
                    <p className="text-sm text-gray-400">{r.claimedAt}</p>
                  </div>
                  <span className="text-green-600 font-semibold text-sm">+{r.amount} CHV</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
