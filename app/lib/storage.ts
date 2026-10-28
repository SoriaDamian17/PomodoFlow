/**
 * Storage persistence (A5).
 *
 * IndexedDB and `localStorage` are "best effort": under storage pressure the
 * browser may evict the whole origin, silently losing tasks, sessions and
 * settings. `navigator.storage.persist()` asks the browser to exempt this
 * origin from that eviction.
 *
 * The request is deliberately made after the user has created real data (first
 * task or first completed session), which is when browsers are most likely to
 * grant it and when it actually matters. Every helper is best effort and never
 * throws: persistence is an optimisation, not a requirement.
 */

export type PersistenceStatus = "granted" | "denied" | "unsupported";

function getStorageManager(): StorageManager | null {
  if (typeof navigator === "undefined") return null;
  return navigator.storage ?? null;
}

/** Current state without prompting. */
export async function getPersistenceStatus(): Promise<PersistenceStatus> {
  const storage = getStorageManager();
  if (!storage || typeof storage.persisted !== "function") {
    return "unsupported";
  }

  try {
    return (await storage.persisted()) ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

/**
 * Requests persistent storage, or reports the already-granted state.
 *
 * Safe to call on every write: once granted it resolves immediately without a
 * prompt. A denied request is not retried aggressively; the next user action
 * can try again.
 */
export async function requestPersistentStorage(): Promise<PersistenceStatus> {
  const storage = getStorageManager();
  if (!storage || typeof storage.persist !== "function") {
    return "unsupported";
  }

  try {
    if (typeof storage.persisted === "function" && (await storage.persisted())) {
      return "granted";
    }
    return (await storage.persist()) ? "granted" : "denied";
  } catch {
    return "denied";
  }
}
