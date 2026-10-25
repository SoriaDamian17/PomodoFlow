"use client";

import { useEffect, useState } from "react";
import { isDatabaseAvailable } from "@/app/lib/db";
import {
  getSessions,
  SESSIONS_UPDATED_EVENT,
  type SessionRecord,
} from "@/app/lib/sessions";

export interface UseSessionsResult {
  /** Recorded sessions, oldest first. */
  sessions: SessionRecord[];
  /** False until the IndexedDB read settles. */
  ready: boolean;
  /** False when IndexedDB cannot be opened (private mode/quota). */
  storageAvailable: boolean;
}

/**
 * Session history for statistics and streaks (F010/F011/F026).
 *
 * Loads once, then reloads whenever a session is recorded (same-tab custom
 * event) or the tab regains focus, so totals update without a manual reload.
 * Malformed rows are already filtered by `getSessions`.
 */
export function useSessions(): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    async function load() {
      const currentRequest = ++requestId;
      const [stored, available] = await Promise.all([
        getSessions(),
        isDatabaseAvailable(),
      ]);

      // Ignore stale reads when several reloads overlap.
      if (cancelled || currentRequest !== requestId) return;

      setSessions(stored);
      setStorageAvailable(available);
      setReady(true);
    }

    void load();

    const reload = () => {
      void load();
    };

    window.addEventListener(SESSIONS_UPDATED_EVENT, reload);
    window.addEventListener("focus", reload);

    return () => {
      cancelled = true;
      window.removeEventListener(SESSIONS_UPDATED_EVENT, reload);
      window.removeEventListener("focus", reload);
    };
  }, []);

  return { sessions, ready, storageAvailable };
}
