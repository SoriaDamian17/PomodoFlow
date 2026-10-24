import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/app/lib/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; icon-only buttons must always provide one. */
  label: string;
}

export function IconButton({ label, className, ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors",
        "hover:bg-foreground/10 hover:text-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    />
  );
}
