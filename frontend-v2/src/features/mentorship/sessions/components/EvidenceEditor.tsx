'use client';

import { useId, useRef, useState } from 'react';
import type { NoShowPolicy } from '../no-show-reports';
import { isSafePlainText, type NoShowEvidence } from '../session-core';

type Attachment = Extract<NoShowEvidence, { kind: 'attachment' }>;

export interface EvidenceEditorProps {
  value: readonly NoShowEvidence[];
  onChange: (next: NoShowEvidence[]) => void;
  policy: Pick<NoShowPolicy, 'maxEvidenceItems' | 'maxNoteLength' | 'maxAttachmentBytes' | 'allowedMimeTypes'>;
  /** Uploads a file and returns its opaque reference. When absent, only notes can be added. */
  onUploadAttachment?: (file: File) => Promise<Attachment>;
  disabled?: boolean;
}

const MIME_LABEL: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'application/pdf': 'PDF',
};

function describeSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Limited evidence: a few short notes and a few attachments held by reference. */
export function EvidenceEditor({ value, onChange, policy, onUploadAttachment, disabled = false }: EvidenceEditorProps) {
  const baseId = useId();
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const full = value.length >= policy.maxEvidenceItems;
  const busy = disabled || uploading;
  const accept = policy.allowedMimeTypes.join(',');

  const addNote = () => {
    const text = draft.trim();
    if (full) return setMessage(`You can attach at most ${policy.maxEvidenceItems} pieces of evidence.`);
    if (text.length === 0) return setMessage('Write a note before adding it.');
    if (text.length > policy.maxNoteLength) return setMessage(`Keep a note to ${policy.maxNoteLength} characters or fewer.`);
    if (!isSafePlainText(text)) return setMessage('Use plain text without markup.');
    setMessage(null);
    setDraft('');
    onChange([...value, { kind: 'note', text }]);
  };

  const addFile = async (file: File | undefined) => {
    if (!file || !onUploadAttachment) return;
    if (full) return setMessage(`You can attach at most ${policy.maxEvidenceItems} pieces of evidence.`);
    if (!policy.allowedMimeTypes.includes(file.type)) {
      return setMessage(`Attach a ${policy.allowedMimeTypes.map((type) => MIME_LABEL[type] ?? type).join(', ')} file.`);
    }
    if (file.size < 1 || file.size > policy.maxAttachmentBytes) {
      return setMessage(`A file must be under ${Math.floor(policy.maxAttachmentBytes / 1024 / 1024)} MB.`);
    }
    setUploading(true);
    setMessage(null);
    try {
      const attachment = await onUploadAttachment(file);
      onChange([...value, attachment]);
    } catch {
      setMessage('The file could not be uploaded. Try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium text-slate-900">
        Evidence <span className="font-normal text-slate-500">(optional)</span>
      </legend>
      <p id={`${baseId}-count`} className="text-xs text-slate-500">
        {value.length} of {policy.maxEvidenceItems} added. Attachments are visible to coordinators and to you only.
      </p>

      {value.length > 0 && (
        <ul aria-label="Evidence added" className="space-y-2 text-sm text-slate-800">
          {value.map((item, index) => {
            const label =
              item.kind === 'note'
                ? `Note: ${item.text}`
                : `Attachment: ${MIME_LABEL[item.mimeType ?? ''] ?? 'file'}, ${describeSize(item.sizeBytes ?? 0)}`;
            return (
              <li key={`${item.kind}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-2">
                <span className="break-words">{label}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onChange(value.filter((_, position) => position !== index))}
                  aria-label={`Remove ${item.kind} ${index + 1}`}
                  className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-800 disabled:opacity-60"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <label htmlFor={`${baseId}-note`} className="block text-sm text-slate-900">Evidence note</label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id={`${baseId}-note`}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={busy || full}
            aria-describedby={`${baseId}-count`}
            className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addNote}
            disabled={busy || full}
            className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
          >
            Add note
          </button>
        </div>
      </div>

      {onUploadAttachment && (
        <div>
          <label htmlFor={`${baseId}-file`} className="block text-sm text-slate-900">Attach a file</label>
          <input
            id={`${baseId}-file`}
            ref={fileRef}
            type="file"
            accept={accept}
            disabled={busy || full}
            onChange={(event) => void addFile(event.target.files?.[0])}
            aria-describedby={`${baseId}-count`}
            className="mt-1 block min-h-[44px] w-full text-sm"
          />
        </div>
      )}

      <p role="status" className="min-h-[1.25rem] text-sm text-red-700">
        {uploading ? 'Uploading…' : message}
      </p>
    </fieldset>
  );
}

export default EvidenceEditor;
