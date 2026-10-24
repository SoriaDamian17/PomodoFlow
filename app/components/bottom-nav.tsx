import { cn } from "@/app/lib/cn";
import type { Surface } from "@/app/lib/surfaces";
import { ChecklistIcon, GearIcon, MusicIcon } from "@/app/components/icons";

import type { ComponentType, SVGProps } from "react";

interface BottomNavItem {
  id: Surface;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const BOTTOM_ITEMS: BottomNavItem[] = [
  { id: "music", label: "Music", Icon: MusicIcon },
  { id: "tasks", label: "Tasks", Icon: ChecklistIcon },
  { id: "settings", label: "Settings", Icon: GearIcon },
];

interface BottomNavProps {
  active: Surface;
  onSelect: (surface: Surface) => void;
}

/** Mobile bottom bar from the draft (F021). Rendered only below the lg breakpoint. */
export function BottomNav({ active, onSelect }: BottomNavProps) {
  return (
    <nav aria-label="Quick access" className="fixed inset-x-3 bottom-3 z-30 lg:hidden">
      <div
        className="glass-strong flex items-stretch gap-1 rounded-[26px] p-1.5"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        {BOTTOM_ITEMS.map(({ id, label, Icon }) => {
          const isActive = id === active;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
