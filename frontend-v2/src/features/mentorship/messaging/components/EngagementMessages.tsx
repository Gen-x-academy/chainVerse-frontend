'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Message } from '../types';
import { mentorshipMessagingService } from '../service';

type Props = {
  engagementId: string;
  currentUserId: string;
};

export function EngagementMessages({ engagementId, currentUserId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMessages(await mentorshipMessagingService.list(engagementId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    if (!content.trim()) return;
    try {
      const msg = await mentorshipMessagingService.send(engagementId, content.trim());
      setMessages((m) => [...m, msg]);
      setContent('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    }
  };

  if (loading) return <div role="status">Loading messages...</div>;
  if (error) return <div role="alert">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={m.senderId === currentUserId ? 'text-right' : 'text-left'}>
            <div className="inline-block p-2 rounded bg-slate-100">{m.content}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={content} onChange={(e) => setContent(e.target.value)} className="flex-1 border p-2 rounded" />
        <button onClick={() => void send()} className="px-4 py-2 bg-indigo-600 text-white rounded">Send</button>
      </div>
    </div>
  );
}
