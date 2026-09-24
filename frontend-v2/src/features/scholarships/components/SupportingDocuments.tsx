'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { supportingDocumentService, validateSupportingDocument } from '../documents';
import type { SupportingDocument, SupportingDocumentKind } from '../documents';

const documentOptions: Array<{ kind: SupportingDocumentKind; label: string; description: string }> = [
  { kind: 'transcript', label: 'Transcript', description: 'Academic record or grade report.' },
  { kind: 'incomeEvidence', label: 'Income evidence', description: 'Income-band evidence requested by the scholarship.' },
  { kind: 'portfolio', label: 'Portfolio', description: 'A project, work sample, or portfolio archive.' },
  { kind: 'recommendation', label: 'Recommendation', description: 'A recommendation letter or reference.' },
];

const applicationId = 'demo-application';

export function SupportingDocuments() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<SupportingDocumentKind>('transcript');
  const [documents, setDocuments] = useState<SupportingDocument[]>([]);
  const [status, setStatus] = useState<'loading' | 'empty' | 'success' | 'error'>('loading');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    supportingDocumentService.list(applicationId)
      .then((response) => {
        if (!isMounted) return;
        setDocuments(response);
        setStatus(response.length === 0 ? 'empty' : 'success');
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!permissionGranted) {
      setError('Grant permission to securely upload supporting evidence before selecting a file.');
      setUploadStatus('error');
      return;
    }

    const validation = validateSupportingDocument(kind, file);
    if (!validation.valid) {
      setError(validation.error ?? 'This file cannot be uploaded.');
      setUploadStatus('error');
      return;
    }

    setError(null);
    setUploadStatus('uploading');
    try {
      const document = await supportingDocumentService.upload(applicationId, kind, file);
      setDocuments((current) => [...current, document]);
      setStatus('success');
      setUploadStatus('success');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The document upload failed.');
      setUploadStatus('error');
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-10 text-slate-900" aria-labelledby="supporting-documents-title">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Private evidence</p>
          <h2 id="supporting-documents-title" className="text-2xl font-bold tracking-tight">Supporting documents</h2>
          <p className="max-w-2xl text-sm text-slate-600">
            Upload only the evidence needed for this application. Files are sent to private encrypted storage,
            scanned before use, and access is logged. No permanent public file links are created.
          </p>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={permissionGranted}
            onChange={(event) => setPermissionGranted(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            aria-describedby="document-permission-description"
          />
          <span>
            <span className="font-medium text-slate-900">Allow secure document processing</span>
            <span id="document-permission-description" className="mt-1 block text-slate-600">
              Required for private storage, malware scanning, and reviewer access logging.
            </span>
          </span>
        </label>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h3 className="text-lg font-semibold">Choose a document type</h3>
            <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Supporting document type">
              {documentOptions.map((option) => (
                <label key={option.kind} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                  <input
                    type="radio"
                    name="document-kind"
                    value={option.kind}
                    checked={kind === option.kind}
                    onChange={() => setKind(option.kind)}
                    className="mt-1 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <span className="block font-medium text-slate-900">{option.label}</span>
                    <span className="block text-sm text-slate-600">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <h3 className="text-lg font-semibold">Add evidence</h3>
            <p className="mt-1 text-sm text-slate-600">PDF, PNG, and JPEG are accepted. Portfolio archives may also be ZIP files.</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!permissionGranted || uploadStatus === 'uploading'}
              className="mt-4 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {uploadStatus === 'uploading' ? 'Uploading and scanning…' : 'Choose a file'}
            </button>
            <input ref={inputRef} type="file" className="sr-only" onChange={handleFileChange} aria-label="Choose supporting document" />
            <p className="mt-3 text-xs text-slate-500">Maximum size depends on document type. The original file is not exposed in the browser after upload.</p>
          </div>
        </div>

        <div className="mt-5" aria-live="polite">
          {status === 'loading' && <p role="status" className="text-sm text-slate-600">Loading uploaded documents…</p>}
          {status === 'error' && <p role="alert" className="text-sm text-red-700">Uploaded documents could not be loaded. You can try again later.</p>}
          {uploadStatus === 'success' && <p role="status" className="text-sm text-emerald-700">Document uploaded to private storage and queued for scanning.</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>

        {status === 'empty' && <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">No supporting documents have been uploaded.</p>}
        {documents.length > 0 && (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Uploaded supporting documents">
            {documents.map((document) => (
              <li key={document.id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">{document.fileName}</p>
                <p className="mt-1 text-sm text-slate-600">{document.kind} · {document.status}</p>
                <p className="mt-2 text-xs text-slate-500">Security scan: {document.scanStatus}. Access logging: {document.accessLogged ? 'enabled' : 'pending'}.</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
