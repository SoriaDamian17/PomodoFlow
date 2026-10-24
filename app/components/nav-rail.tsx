import { cn } from "@/app/lib/cn";
import type { Surface } from "@/app/lib/surfaces";
import {
  BrainIcon,
  ChecklistIcon,
  FlameIcon,
  GearIcon,
  TimerIcon,
} from "@/app/components/icons";

import type { ComponentType, SVGProps } from "react";

interface RailItem {
  id: Surface;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const RAIL_ITEMS: RailItem[] = [
  { id: "timer", label: "Timer", Icon: TimerIcon },
  { id: "streak", label: "Streak", Icon: FlameIcon },
  { id: "insights", label: "Focus insights", Icon: BrainIcon },
  { id: "settings", label: "Settings", Icon: GearIcon },
  { id: "tasks", label: "Tasks", Icon: ChecklistIcon },
];

interface NavRailProps {
  active: Surface;
  onSelect: (surface: Surface) => void;
  className?: string;
}

/** Desktop navigation rail from the draft (F020). */
export function NavRail({ active, onSelect, className }: NavRailProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "glass flex flex-col items-center gap-1 rounded-full p-2",
        className,
      )}
    >
      {RAIL_ITEMS.map(({ id, label, Icon }) => {
        const isActive = id === active;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-label={label}
            title={label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative grid size-11 place-items-center rounded-full transition-colors",
              isActive
                ? "bg-foreground/10 text-accent-strong"
                : "text-muted hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            <span
              aria-hidden="true"
              className="glass-strong pointer-events-none absolute top-1/2 left-full z-20 ml-3 -translate-y-1/2 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
