"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshIcon } from "@/app/components/icons";

/**
 * Explicit update prompt for the service worker (F033).
 *
 * `app/sw.ts` installs with `skipWaiting: false`, so a new version waits until
 * the user opts in. Nothing reloads on its own: a running timer is never
 * interrupted by a deploy. The injected `@serwist/next` script owns the actual
 * registration, so this component only observes it.
 */
export function ServiceWorkerUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const reloadRequested = useRef(false);

  useEffect(() => {
    // Dev builds intentionally run without a service worker (`disable` in
    // next.config.ts), so there is nothing to watch.
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    function handleInstalling(reg: ServiceWorkerRegistration) {
      const installing = reg.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (cancelled) return;
        // `controller` is set only for an existing install: the very first
        // worker activates without a prompt.
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          setWaiting(reg.waiting ?? installing);
        }
      });
    }

    function watch(reg: ServiceWorkerRegistration) {
      if (cancelled) return;
      registration = reg;

      // A version activated while the app was closed may already be waiting.
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaiting(reg.waiting);
      }

      reg.addEventListener("updatefound", handleUpdateFound);
    }

    function handleUpdateFound() {
      if (registration) handleInstalling(registration);
    }

    function handleControllerChange() {
      if (reloadRequested.current) window.location.reload();
    }

    function checkForUpdate() {
      if (document.visibilityState !== "visible" || !registration) return;
      void registration.update().catch(() => {
        // Offline or the server rejected the check; the running version stays.
      });
    }

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );
    document.addEventListener("visibilitychange", checkForUpdate);

    void navigator.serviceWorker.ready
      .then((reg) => {
        if (!cancelled) watch(reg);
      })
      .catch(() => {
        // Registration failed (unsupported browser, blocked storage): the app
        // still works, it just cannot update itself.
      });

    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", handleUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  function reload() {
    if (!waiting) return;

    reloadRequested.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });

    // Safety net in case `controllerchange` never arrives: the new worker has
    // skipped waiting by then, so reloading lands on the new version.
    window.setTimeout(() => {
      if (reloadRequested.current) window.location.reload();
    }, 2000);
  }

  if (!waiting || dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 lg:bottom-8">
      <div
        role="status"
        aria-live="polite"
        className="glass-strong pointer-events-auto flex max-w-md flex-col gap-3 rounded-3xl p-3 text-xs sm:flex-row sm:items-center sm:rounded-full sm:py-2 sm:pr-2 sm:pl-4"
      >
        <p className="px-1 sm:px-0">
          <span className="block font-semibold text-foreground">
            A new version is ready
          </span>
          <span className="block text-muted">
            Reload when you are between sessions.
          </span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="h-9 rounded-full px-3 font-medium text-muted transition-colors hover:text-foreground"
          >
            Later
          </button>
          <button
            type="button"
            onClick={reload}
            className="btn-primary h-9 gap-1.5 px-3.5 text-xs"
          >
            <RefreshIcon className="size-3.5" />
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
