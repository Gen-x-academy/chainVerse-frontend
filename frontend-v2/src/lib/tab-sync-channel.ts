/**
 * Cross-tab session sync for issue #829.
 * authStore changes in one tab previously never reached other open tabs.
 * BroadcastChannel is used with a storage-event fallback for older browsers.
 */

export type SessionSyncMessage =
  | { type: 'login'; userId: string }
  | { type: 'logout' }
  | { type: 'expired' };

const CHANNEL_NAME = 'auth-session-sync';

export function broadcastSessionChange(message: SessionSyncMessage) {
  if (typeof window === 'undefined') return;
  if ('BroadcastChannel' in window) {
    new BroadcastChannel(CHANNEL_NAME).postMessage(message);
  } else {
    localStorage.setItem(CHANNEL_NAME, JSON.stringify({ ...message, ts: Date.now() }));
  }
}

export function subscribeToSessionChanges(onMessage: (msg: SessionSyncMessage) => void) {
  if (typeof window === 'undefined') return () => {};

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => onMessage(event.data as SessionSyncMessage);
    return () => channel.close();
  }

  const handler = (event: StorageEvent) => {
    if (event.key === CHANNEL_NAME && event.newValue) {
      onMessage(JSON.parse(event.newValue) as SessionSyncMessage);
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
