'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Plus,
  Shield,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import type { ComplianceDocument, UploadComplianceDocPayload } from '../types';

export interface ComplianceDocumentsPanelProps {
  documents?: ComplianceDocument[];
  isAuthorized: boolean;
  onUploadDocument?: (payload: UploadComplianceDocPayload) => Promise<boolean>;
  isMutating?: boolean;
  className?: string;
}

const DOC_TYPE_LABELS: Record<ComplianceDocument['type'], string> = {
  certificate_of_incorporation: 'Certificate of Incorporation',
  tax_exemption_proof: 'Tax Exemption / 501(c)(3) Proof',
  proof_of_address: 'Proof of Registered Address',
  bank_statement: 'Corporate Bank Verification',
  authorized_signatory: 'Authorized Signatory Resolution',
};

export function ComplianceDocumentsPanel({
  documents = [],
  isAuthorized,
  onUploadDocument,
  isMutating = false,
  className = '',
}: ComplianceDocumentsPanelProps) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [docType, setDocType] =
    useState<ComplianceDocument['type']>('certificate_of_incorporation');
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileName.trim()) return;

    if (onUploadDocument) {
      const ok = await onUploadDocument({
        type: docType,
        title: title.trim(),
        fileName: fileName.trim(),
        fileSizeBytes: 1024 * 1024 * 2, // 2MB simulated
        mimeType: 'application/pdf',
      });
      if (ok) {
        setTitle('');
        setFileName('');
        setShowUploadForm(false);
      }
    }
  };

  return (
    <div
      role="region"
      aria-label="Compliance credentials and documents"
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-indigo-600 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Compliance Credentials</h3>
            <p className="text-[11px] text-slate-500">
              Auditable legal entity documentation submitted for verification.
            </p>
          </div>
        </div>

        {isAuthorized && !showUploadForm && onUploadDocument && (
          <button
            type="button"
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload Credential</span>
          </button>
        )}
      </div>

      {/* Upload Form Modal/Inline Drawer */}
      {showUploadForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-indigo-950">Submit Verification Document</h4>
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="doc-type-select" className="block font-semibold text-slate-800 mb-1">
                Document Type
              </label>
              <select
                id="doc-type-select"
                value={docType}
                onChange={(e) => setDocType(e.target.value as ComplianceDocument['type'])}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="certificate_of_incorporation">Certificate of Incorporation</option>
                <option value="tax_exemption_proof">Tax Exemption / 501(c)(3) Proof</option>
                <option value="proof_of_address">Proof of Registered Address</option>
                <option value="bank_statement">Corporate Bank Verification</option>
                <option value="authorized_signatory">Authorized Signatory Resolution</option>
              </select>
            </div>

            <div>
              <label htmlFor="doc-title-input" className="block font-semibold text-slate-800 mb-1">
                Document Title
              </label>
              <input
                id="doc-title-input"
                type="text"
                placeholder="e.g. Delaware 2026 Certificate"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              />
            </div>
          </div>

          <div>
            <label htmlFor="doc-file-input" className="block font-semibold text-slate-800 mb-1">
              File Name / Upload Reference
            </label>
            <input
              id="doc-file-input"
              type="text"
              placeholder="e.g. corporate_charter_delaware.pdf"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMutating || !title.trim() || !fileName.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              {isMutating ? 'Submitting...' : 'Upload & Encrypt'}
            </button>
          </div>
        </form>
      )}

      {/* Documents List */}
      <div className="space-y-2.5">
        {documents.length === 0 ? (
          <div
            role="status"
            className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center"
          >
            <FileText className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
            <p className="mt-1 text-xs text-slate-600">No compliance documents submitted yet.</p>
          </div>
        ) : (
          documents.map((doc) => {
            const isApproved = doc.status === 'approved';
            const isRejected = doc.status === 'rejected';

            return (
              <div
                key={doc.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{doc.title}</h4>
                    <p className="text-[11px] text-slate-500">
                      {DOC_TYPE_LABELS[doc.type]} &bull; {doc.fileName} &bull;{' '}
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                    {doc.rejectionReason && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">
                        Rejection reason: {doc.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  {isApproved && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                      <span>Approved</span>
                    </span>
                  )}
                  {isRejected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                      <XCircle className="h-3 w-3 text-rose-600" aria-hidden="true" />
                      <span>Rejected</span>
                    </span>
                  )}
                  {!isApproved && !isRejected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                      <Clock className="h-3 w-3 text-amber-600" aria-hidden="true" />
                      <span>Pending Review</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
