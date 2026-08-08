import {
  Images,
  Layers,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Every left-rail destination. The id doubles as the key for the panel that
 * the rail opens, so a nav entry and its panel can never drift apart.
 */
export type PanelId = "graphics" | "canva" | "layers" | "settings";

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
    id: "canva",
    label: "Canva",
    icon: Sparkles,
    title: "Canva",
    description: "Bring a design you already made onto the sheet.",
  },
  {
    id: "layers",
    label: "Layers",
    icon: Layers,
    title: "Layers",
    description: "Reorder, hide and lock everything on the sheet.",
  },
  {
    /**
     * Last in the rail because it is the only contextual one: the other three
     * are places you go, this one is about whatever is currently selected.
     */
    id: "settings",
    label: "Settings",
    icon: SlidersHorizontal,
    title: "Settings",
    description: "Sheet setup, and the properties of anything you select.",
  },
];

/** Look up a nav entry by panel id. */
export const findNavItem = (id: PanelId): NavItem | undefined =>
  NAV_ITEMS.find((item) => item.id === id);
