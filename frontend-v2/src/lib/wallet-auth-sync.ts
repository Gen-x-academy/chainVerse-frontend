/**
 * Wallet <-> auth store sync helper for issue #838.
 * WalletContext never wrote back to authStore.walletPublicKey, so connect,
 * restore, account-change, and disconnect events went unmirrored.
 */
import { useAuthStore } from '@/src/store/authStore';

let lastSynced: string | null = null;

/** Call from WalletContext on connect/restore/account-change/disconnect. */
export function syncWalletPublicKey(publicKey: string | null) {
  if (publicKey === lastSynced) return;
  lastSynced = publicKey;
  useAuthStore.getState().setWalletPublicKey(publicKey);
}

/** Reset the dedupe guard, e.g. between tests. */
export function resetWalletAuthSync() {
  lastSynced = null;
}
