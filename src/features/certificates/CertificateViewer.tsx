import { useWallet } from "@stellar/freighter-api";
import { contracts } from "../../shared/contracts";
import { useEffect, useState } from "react";

export function CertificateViewer({ courseId }: { courseId: string }) {
  const { publicKey } = useWallet();
  const [certificate, setCertificate] = useState(null);

  useEffect(() => {
    const fetchCertificate = async () => {
      if (publicKey) {
        const cert = await contracts.getCertificate(publicKey, courseId);
        setCertificate(cert);
      }
    };
    fetchCertificate();
  }, [publicKey, courseId]);

  const handleDownloadPdf = () => {
    // PDF generation logic will be added here
    alert("PDF download functionality is not yet implemented.");
  };

  if (!certificate) {
    return <div>Loading certificate...</div>;
  }

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Certificate of Completion</h2>
      <p><strong>Student:</strong> {certificate.studentName}</p>
      <p><strong>Course:</strong> {certificate.courseName}</p>
      <p><strong>Issue Date:</strong> {new Date(certificate.issueDate).toLocaleDateString()}</p>
      <p>
        <strong>Transaction Hash:</strong>
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${certificate.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline ml-2"
        >
          {certificate.txHash}
        </a>
      </p>
      <button
        onClick={handleDownloadPdf}
        className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Download as PDF
      </button>
    </div>
  );
}