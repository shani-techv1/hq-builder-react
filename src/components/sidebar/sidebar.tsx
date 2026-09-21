"use client";

import { LayoutGroup } from "framer-motion";

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
  /**
   * `vertical` is the 80px left rail; `horizontal` is the tab bar a phone gets
   * across the bottom of the screen instead.
   */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * The editor's menus: the fixed 80px left rail, or on a phone the tab bar along
 * the bottom edge.
 *
 * Either way it never moves: panels open out of it, so this is the one stable
 * anchor in the editor. The two forms are the same items, badges and states —
 * only the direction they run in changes.
 */
export function Sidebar({
  activePanel,
  rememberedPanel,
  badges,
  onSelect,
  orientation = "vertical",
  className,
}: SidebarProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      aria-label="Editor tools"
      className={cn(
        "relative z-30 flex shrink-0 bg-card",
        isHorizontal
          ? // The safe-area inset keeps the tabs clear of a phone's home
            // indicator; the bar's own colour runs down behind it.
            "w-full border-t border-border px-1 pb-[env(safe-area-inset-bottom)]"
          : "h-full w-20 flex-col items-center border-r border-border",
        className,
      )}
    >
      {/* Namespaces the active pill, so the rail and the tab bar — both mounted
          while CSS decides which is shown — never animate into each other. */}
      <LayoutGroup id={orientation}>
        <div
          className={cn(
            "flex w-full",
            isHorizontal
              ? "h-(--bottom-nav-height) items-center gap-0.5"
              : "scrollbar-slim flex-1 flex-col items-center gap-1 overflow-y-auto py-3",
          )}
        >
          {RAIL_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activePanel === item.id}
              isRemembered={activePanel === null && rememberedPanel === item.id}
              badge={badges?.[item.id]}
              onClick={() => onSelect(item.id)}
              className={isHorizontal ? "w-auto min-w-0 flex-1 py-1.5" : undefined}
            />
          ))}
        </div>
      </LayoutGroup>
    </nav>
  );
}
