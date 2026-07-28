/**
 * Managed Stellar Wallets Kit subscription helper for issue #837.
 * StellarWalletsKit.on() has no documented unsubscribe, so this tracks
 * registered handlers and lets a caller detach them all on unmount.
 */
import { StellarWalletsKit, KitEventType } from '@creit.tech/stellar-wallets-kit';

type Handler = (event: unknown) => void;

export function createManagedWalletListener() {
  const registered: Array<{ type: KitEventType; handler: Handler }> = [];

  function on(type: KitEventType, handler: Handler) {
    StellarWalletsKit.on(type, handler);
    registered.push({ type, handler });
  }

  function cleanup() {
    for (const { type, handler } of registered) {
      const off = (StellarWalletsKit as unknown as { off?: (t: KitEventType, h: Handler) => void }).off;
      off?.(type, handler);
    }
    registered.length = 0;
  }

  return { on, cleanup };
}
