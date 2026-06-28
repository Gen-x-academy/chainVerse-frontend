'use client';

import { useEffect, useState } from 'react';
import { Award, Download, Share2, Loader2 } from 'lucide-react';
import { useWallet } from '@/src/context/WalletContext';
import { useSession } from '@/src/features/auth/hooks/useSession';

interface Certificate {
  courseId: string;
  courseTitle: string;
  issuedAt: string;
  txHash?: string;
}

// Placeholder data – replace with real contract.getCertificate() calls
const MOCK_CERTIFICATES: Certificate[] = [
  { courseId: 'course-1', courseTitle: 'Intro to Stellar', issuedAt: '2025-04-15', txHash: 'abc123' },
  { courseId: 'course-2', courseTitle: 'Smart Contracts 101', issuedAt: '2025-05-20', txHash: 'def456' },
];

function CertificateViewer({
  cert,
  publicKey,
}: {
  cert: Certificate;
  publicKey: string;
}) {
  const shareUrl = `${window.location.origin}/certificate/${cert.courseId}?address=${publicKey}`;

  const handleDownload = () => {
    // TODO: generate PDF via html2pdf or server-side endpoint
    alert('PDF download coming soon!');
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch {
      alert(`Share link: ${shareUrl}`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      {/* Certificate visual */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-8 text-center mb-4">
        <Award className="mx-auto mb-3 text-blue-600" size={40} />
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Certificate of Completion</p>
        <h3 className="text-xl font-bold text-gray-900">{cert.courseTitle}</h3>
        <p className="text-sm text-gray-500 mt-2">
          {publicKey.slice(0, 6)}...{publicKey.slice(-6)}
        </p>
        <p className="text-xs text-gray-400 mt-1">Issued {cert.issuedAt}</p>
        {cert.txHash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${cert.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 underline mt-1 inline-block"
          >
            View on chain
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Download size={14} /> Download PDF
        </button>
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 border border-blue-200 text-blue-600 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
        >
          <Share2 size={14} /> Share
        </button>
      </div>
    </div>
  );
}

export default function CertificatesPage() {
  const { isConnected, publicKey, connect } = useWallet();
  const { token } = useSession();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey || !token) return;
    setLoading(true);
    // TODO: fetch completed courses from backend, then call contracts.getCertificate() for each
    // Using mock data until contract integration is ready
    setTimeout(() => {
      setCerts(MOCK_CERTIFICATES);
      setLoading(false);
    }, 500);
  }, [publicKey, token]);

  if (!isConnected || !publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center max-w-sm w-full">
          <Award className="mx-auto mb-4 text-blue-600" size={40} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Wallet to View Certificates</h2>
          <p className="text-gray-500 text-sm mb-6">Your certificates are stored on-chain and require a connected wallet.</p>
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Certificates</h1>
        <p className="text-gray-500 text-sm mb-8">On-chain certificates earned by completing courses.</p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-600" size={28} />
          </div>
        ) : certs.length === 0 ? (
          <div className="text-center py-20">
            <Award className="mx-auto mb-3 text-gray-300" size={40} />
            <p className="text-gray-400">No certificates yet. Complete a course to earn one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {certs.map((cert) => (
              <CertificateViewer key={cert.courseId} cert={cert} publicKey={publicKey} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
