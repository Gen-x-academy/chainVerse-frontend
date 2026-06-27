import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Certificates — ChainVerse',
};

export default function CertificatesPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-6xl" aria-hidden="true">🏅</div>
      <h1 className="text-3xl font-bold text-gray-900">Certificates</h1>
      <p className="text-gray-500 max-w-md">
        Your blockchain-verified course completion certificates will be minted and displayed here.
        Complete a course to earn your first certificate!
      </p>
    </div>
  );
}
