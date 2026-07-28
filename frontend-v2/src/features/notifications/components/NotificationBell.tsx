'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationListResponse {
  data: NotificationItem[];
  total: number;
  unreadCount: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!BASE_URL) return;
    setLoading(true);
    fetch(`${BASE_URL}/notification?limit=5`, {
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => r.json() as Promise<NotificationListResponse>)
      .then((data) => {
        setNotifications(data.data ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {/* silently ignore when API is unavailable */})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const markRead = async (id: string) => {
    if (!BASE_URL) return;
    try {
      await fetch(`${BASE_URL}/notification/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition focus-ring"
      >
        <Bell size={20} className="text-gray-600" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-indigo-600 font-medium">{unreadCount} unread</span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {loading && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Loading...</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${
                  n.isRead ? 'opacity-60' : ''
                }`}
              >
                <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
              </button>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-gray-100">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-indigo-600 hover:text-indigo-700 font-medium py-1"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
