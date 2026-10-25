import type { ReactNode } from "react";
import { cn } from "@/app/lib/cn";

interface StorageNoticeProps {
  /** Render only when storage is unavailable. */
  show: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Visible fallback for the private-mode / quota case (F012).
 *
 * Persistence is best effort everywhere, so instead of failing a read the app
 * keeps working and states clearly that nothing will be stored.
 */
export function StorageNotice({ show, children, className }: StorageNoticeProps) {
  if (!show) return null;

  return (
    <p
      role="alert"
      className={cn(
        "rounded-2xl border border-accent-text/40 bg-accent/10 px-3.5 py-3 text-xs leading-relaxed text-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
