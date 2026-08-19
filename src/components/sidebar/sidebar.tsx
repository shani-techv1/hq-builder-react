"use client";

import { SidebarItem } from "@/components/sidebar/sidebar-item";
import { RAIL_ITEMS, type PanelId } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  /** Panel currently open, or `null` when everything is closed. */
  activePanel: PanelId | null;
  /** Last panel the user opened — kept highlighted after it closes. */
  rememberedPanel: PanelId | null;
  /** Warning counts to badge menus with, keyed by panel. */
  badges?: Partial<Record<PanelId, number>>;
  onSelect: (id: PanelId) => void;
  className?: string;
}

/**
 * The fixed 80px left rail.
 *
 * It never moves: panels slide out from behind it, so this column is the one
 * stable anchor in the editor.
 */
export function Sidebar({
  activePanel,
  rememberedPanel,
  badges,
  onSelect,
  className,
}: SidebarProps) {
  return (
    <nav
      aria-label="Editor tools"
      className={cn(
        "relative z-30 flex h-full w-20 shrink-0 flex-col items-center",
        "border-r border-border bg-card",
        className,
      )}
    >
      <div className="scrollbar-slim flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
        {RAIL_ITEMS.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activePanel === item.id}
            isRemembered={activePanel === null && rememberedPanel === item.id}
            badge={badges?.[item.id]}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </nav>
  );
}
