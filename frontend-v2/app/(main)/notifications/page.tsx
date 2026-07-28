'use client';

import React, { useEffect, useState } from 'react';
import type { Metadata } from 'next';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  createdAt: string;
}

interface NotificationListResponse {
  data: NotificationItem[];
  total: number;
  unreadCount: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const PAGE_LIMIT = 20;

const typeColors: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  info: 'bg-blue-100 text-blue-700',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!BASE_URL) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${BASE_URL}/notification?page=${page}&limit=${PAGE_LIMIT}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load notifications');
        return r.json() as Promise<NotificationListResponse>;
      })
      .then((data) => {
        setNotifications(data.data ?? []);
        setTotal(data.total ?? 0);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  const markRead = async (id: string) => {
    if (!BASE_URL) return;
    try {
      await fetch(`${BASE_URL}/notification/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notifications</h1>
        <p className="text-gray-500 mb-8">Stay up to date with your learning activity.</p>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4" aria-hidden="true">🔔</p>
            <p className="text-gray-500">No notifications yet.</p>
          </div>
        )}

        {!loading && !error && notifications.length > 0 && (
          <>
            <div className="space-y-2">
              {notifications.map((n) => (
                <article
                  key={n.id}
                  className={`bg-white rounded-xl border border-gray-100 p-4 flex gap-3 ${
                    n.isRead ? 'opacity-70' : ''
                  }`}
                >
                  <span
                    className={`mt-0.5 px-2 py-0.5 text-xs font-medium rounded-full h-fit ${
                      typeColors[n.type] ?? typeColors.info
                    }`}
                  >
                    {n.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap focus-ring rounded"
                    >
                      Mark read
                    </button>
                  )}
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
