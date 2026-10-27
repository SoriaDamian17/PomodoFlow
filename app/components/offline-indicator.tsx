"use client";

import { useSyncExternalStore } from "react";
import { OfflineIcon } from "@/app/components/icons";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

/**
 * The server cannot know the connection state, so it renders the online state
 * and the client swaps after hydration. This keeps the markup deterministic.
 */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Non-blocking offline banner (F033).
 *
 * Everything in PomodoroFlow is local-first, so being offline never disables a
 * control: the banner only explains that the timer, tasks and history still
 * work and that changes are stored on the device.
 */
export function OfflineIndicator() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 lg:bottom-8">
      <p
        role="status"
        aria-live="polite"
        className="glass flex max-w-md items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-foreground"
      >
        <OfflineIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-accent-text"
        />
        <span>
          Offline — the timer, tasks and session history keep working.
        </span>
      </p>
    </div>
  );
}
