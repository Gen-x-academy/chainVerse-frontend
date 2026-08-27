'use client';

import React from 'react';
import { Modal } from '@/src/shared/components/ui/Modal';
import type { Book } from '../types/book.types';

export interface BookConflictDialogProps {
  isOpen: boolean;
  serverRecord: Book;
  localTitle: string;
  onReload: () => void;
  onKeepEditing: () => void;
  onCompare?: () => void;
  comparing?: boolean;
}

export function BookConflictDialog({
  isOpen,
  serverRecord,
  localTitle,
  onReload,
  onKeepEditing,
  onCompare,
  comparing = false,
}: BookConflictDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onKeepEditing} title="Edit conflict detected">
      <div role="alert" className="space-y-4">
        <p className="text-sm text-gray-600">
          Another librarian saved changes to this record while you were editing. Your changes were
          not saved to prevent silently overwriting their work.
        </p>

        {comparing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="border rounded-lg p-3 bg-gray-50">
              <h3 className="font-medium text-gray-900 mb-2">Your version</h3>
              <dl className="space-y-1">
                <div>
                  <dt className="text-xs text-gray-500">Title</dt>
                  <dd>{localTitle}</dd>
                </div>
              </dl>
            </div>
            <div className="border rounded-lg p-3 bg-amber-50">
              <h3 className="font-medium text-gray-900 mb-2">Server version (v{serverRecord.version})</h3>
              <dl className="space-y-1">
                <div>
                  <dt className="text-xs text-gray-500">Title</dt>
                  <dd>{serverRecord.bibliographic.title}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Description</dt>
                  <dd className="line-clamp-3">{serverRecord.bibliographic.description}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Status</dt>
                  <dd className="capitalize">{serverRecord.status}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <p className="text-sm">
            Server record: <strong>{serverRecord.bibliographic.title}</strong> (version{' '}
            {serverRecord.version})
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={onReload}
            className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg"
          >
            Reload server version
          </button>
          {onCompare && !comparing && (
            <button
              type="button"
              onClick={onCompare}
              className="flex-1 px-4 py-2 text-sm border rounded-lg"
            >
              Compare values
            </button>
          )}
          <button
            type="button"
            onClick={onKeepEditing}
            className="flex-1 px-4 py-2 text-sm border rounded-lg"
          >
            Keep editing mine
          </button>
        </div>
      </div>
    </Modal>
  );
}
