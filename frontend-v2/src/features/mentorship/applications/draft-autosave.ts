/** MENTOR-031: autosave application drafts locally with debounce, versioning and conflict handling. */
export interface DraftEnvelope<T> {
  applicationId: string;
  /** Increments on every save; used to detect a stale tab overwriting a newer draft. */
  revision: number;
  savedAt: string;
  data: T;
}

export const DRAFT_KEY_PREFIX = 'mentorship:draft:';
export const AUTOSAVE_DELAY_MS = 1500;
export const DRAFT_MAX_AGE_MS = 30 * 86_400_000;

export const draftKey = (applicationId: string) => `${DRAFT_KEY_PREFIX}${applicationId}`;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loadDraft<T>(storage: StorageLike, applicationId: string, now: Date = new Date()): DraftEnvelope<T> | undefined {
  try {
    const raw = storage.getItem(draftKey(applicationId));
    if (!raw) return undefined;
    const env = JSON.parse(raw) as DraftEnvelope<T>;
    if (env.applicationId !== applicationId || typeof env.revision !== 'number') return undefined;
    if (now.getTime() - Date.parse(env.savedAt) > DRAFT_MAX_AGE_MS) {
      storage.removeItem(draftKey(applicationId));
      return undefined;
    }
    return env;
  } catch {
    return undefined;
  }
}

/** Saves unless another tab has already stored a newer revision; returns the envelope now on disk. */
export function saveDraft<T>(
  storage: StorageLike,
  applicationId: string,
  data: T,
  knownRevision: number,
  now: Date = new Date(),
): { saved: boolean; envelope: DraftEnvelope<T> | undefined } {
  const current = loadDraft<T>(storage, applicationId, now);
  if (current && current.revision > knownRevision) return { saved: false, envelope: current };
  const envelope: DraftEnvelope<T> = { applicationId, revision: knownRevision + 1, savedAt: now.toISOString(), data };
  try {
    storage.setItem(draftKey(applicationId), JSON.stringify(envelope));
    return { saved: true, envelope };
  } catch {
    // Quota or private-mode failure: report not saved so the UI can warn instead of claiming success.
    return { saved: false, envelope: current };
  }
}

export const clearDraft = (storage: StorageLike, applicationId: string): void => {
  try {
    storage.removeItem(draftKey(applicationId));
  } catch {
    /* nothing to clear */
  }
};

/** Debounced autosave scheduler; call `flush` on blur/unload and `cancel` on unmount. */
export function createAutosaver(save: () => void, delayMs = AUTOSAVE_DELAY_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        save();
      }, delayMs);
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
        save();
      }
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
