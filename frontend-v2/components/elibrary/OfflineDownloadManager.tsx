"use client";

import { useState } from "react";

interface OfflineDownload {
  itemId: string;
  title: string;
  status: "not_downloaded" | "downloading" | "downloaded" | "failed";
  progress: number;
  expiresAt?: string;
}

interface OfflineDownloadManagerProps {
  downloads: OfflineDownload[];
  onStart: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}

export function OfflineDownloadManager({ downloads, onStart, onRemove }: OfflineDownloadManagerProps) {
  const [isOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  if (downloads.length === 0) {
    return <p className="text-sm text-gray-500">No offline downloads yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {isOffline && (
        <li className="text-sm text-amber-700">You are offline. Only downloaded items can be opened.</li>
      )}
      {downloads.map((item) => (
        <li key={item.itemId} className="flex items-center justify-between rounded-md border p-2 text-sm">
          <span>{item.title}</span>
          <span className="flex items-center gap-2">
            {item.status === "not_downloaded" && (
              <button onClick={() => onStart(item.itemId)} className="text-blue-600 underline">
                Download
              </button>
            )}
            {item.status === "downloading" && <span>{item.progress}%</span>}
            {item.status === "downloaded" && (
              <button onClick={() => onRemove(item.itemId)} className="text-red-600 underline">
                Remove
              </button>
            )}
            {item.status === "failed" && (
              <button onClick={() => onStart(item.itemId)} className="text-red-600 underline">
                Retry
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
