"use client";

import { useEffect, useState } from "react";
import { cn } from "@/app/lib/cn";
import {
  getPersistenceStatus,
  type PersistenceStatus,
} from "@/app/lib/storage";

interface StoragePersistenceStatusProps {
  className?: string;
}

/**
 * Reports whether the browser granted persistent storage (A5).
 *
 * The permission is requested after the first task/session write; this only
 * reads the current state so Settings can tell the user whether their data is
 * protected from eviction.
 */
export function StoragePersistenceStatus({
  className,
}: StoragePersistenceStatusProps) {
  const [status, setStatus] = useState<PersistenceStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getPersistenceStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === null || status === "unsupported") return null;

  return (
    <p className={cn("text-xs leading-relaxed text-muted", className)}>
      {status === "granted"
        ? "Persistent storage is on: the browser keeps your tasks and history even when space runs low."
        : "Persistent storage is off: the browser may clear your tasks and history when space runs low."}
    </p>
  );
}
