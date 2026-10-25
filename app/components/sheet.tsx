"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/app/lib/cn";
import { CloseIcon } from "@/app/components/icons";
import { IconButton } from "@/app/components/icon-button";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Context shown under the title, e.g. the still-running timer (F022). */
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Native <dialog> sheet: right-side panel on desktop, bottom sheet on mobile.
 * Using showModal() gives us focus trapping, Escape handling and an inert
 * background without hand-written listeners; focus is explicitly returned to
 * the opener on close (F022).
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  headerExtra,
  children,
  className,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      // Remember what had focus so Escape/close can return it (F022).
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  /**
   * Native close event: fires for Escape, backdrop close and programmatic
   * close. Returning focus here (after the dialog is gone) makes the restore
   * deterministic even when the close did not go through our button.
   */
  function handleNativeClose() {
    const opener = openerRef.current;
    openerRef.current = null;

    if (opener && opener.isConnected) {
      opener.focus();
    }

    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={handleNativeClose}
      onClick={handleBackdropClick}
      className={cn(
        "glass-strong m-0 mt-auto max-h-[85dvh] w-full max-w-full rounded-t-3xl p-0 text-foreground",
        "backdrop:bg-black/55 backdrop:backdrop-blur-[3px]",
        "sm:mt-0 sm:mr-0 sm:ml-auto sm:h-dvh sm:max-h-dvh sm:max-w-md sm:rounded-none sm:rounded-l-3xl",
        className,
      )}
    >
      <div className="flex max-h-[85dvh] flex-col sm:h-full sm:max-h-dvh">
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/20 sm:hidden"
        />

        <header className="flex items-start justify-between gap-4 border-b border-glass-border px-6 pt-4 pb-4 sm:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-muted">
                {description}
              </p>
            ) : null}
            {headerExtra ? <div className="mt-3">{headerExtra}</div> : null}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
            <CloseIcon className="size-[18px]" />
          </IconButton>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
      </div>
    </dialog>
  );
}
