import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard — ChainVerse',
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-6xl" aria-hidden="true">🏆</div>
      <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
      <p className="text-gray-500 max-w-md">
        See the top learners on ChainVerse ranked by XP, courses completed, and contribution streak.
        Leaderboard launching soon!
      </p>
    </div>
  );
}
