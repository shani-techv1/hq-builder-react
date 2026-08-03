import { Images, Layers, type LucideIcon } from "lucide-react";

/**
 * Every left-rail destination. The id doubles as the key for the panel that
 * the rail opens, so a nav entry and its panel can never drift apart.
 */
export type PanelId = "graphics" | "layers";

export interface NavItem {
  id: PanelId;
  /** Label rendered under the icon in the 80px rail. */
  label: string;
  icon: LucideIcon;
  /** Panel heading — longer than the rail label where that reads better. */
  title: string;
  /** One-line description shown under the panel heading. */
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "graphics",
    label: "Graphics",
    icon: Images,
    title: "Graphics",
    description: "Upload artwork or reuse something you already have.",
  },
  {
    id: "layers",
    label: "Layers",
    icon: Layers,
    title: "Layers",
    description: "Reorder, hide and lock everything on the sheet.",
  },
];

/** Look up a nav entry by panel id. */
export const findNavItem = (id: PanelId): NavItem | undefined =>
  NAV_ITEMS.find((item) => item.id === id);
