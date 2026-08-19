import {
  Grip,
  Images,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

/**
 * Bundled rather than served from /public, because the storefront embed is a
 * Vite build with `publicDir` off whose assets resolve against the app's own
 * origin at runtime — a `/…png` path would only ever exist for the standalone
 * editor. `new URL` rather than a default import because that is the one form
 * both builds turn into the same thing, a URL string: Next's image import
 * hands back a `StaticImageData` object instead.
 */
const CANVA_LOGO_SRC = new URL(
  "../assets/canva-icon-logo.png",
  import.meta.url,
).href;

/**
 * Every left-rail destination. The id doubles as the key for the panel that
 * the rail opens, so a nav entry and its panel can never drift apart.
 */
export type PanelId =
  | "graphics"
  | "canva"
  | "autofill"
  | "layers"
  | "preflight"
  | "settings"
  | "position"
  | "filters";

/**
 * A Lucide glyph, except where the entry stands for another product and its
 * own mark is the thing people recognise in the rail.
 */
export type NavIcon =
  | { kind: "glyph"; glyph: LucideIcon }
  | { kind: "logo"; src: string };

export interface NavItem {
  id: PanelId;
  /** Label rendered under the icon in the 80px rail. */
  label: string;
  icon: NavIcon;
  /**
   * Kept out of the rail.
   *
   * Some panels belong to the selection rather than to the editor — they are
   * reached from the artwork they act on, and a rail button for them would be
   * dead most of the time. They are still panels in every other respect, so
   * they keep an entry here for their heading and their description.
   */
  hidden?: boolean;
  /** Panel heading — longer than the rail label where that reads better. */
  title: string;
  /** One-line description shown under the panel heading. */
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "graphics",
    label: "Graphics",
    icon: { kind: "glyph", glyph: Images },
    title: "Graphics",
    description: "Upload artwork or reuse something you already have.",
  },
  {
    id: "canva",
    label: "Canva",
    icon: { kind: "logo", src: CANVA_LOGO_SRC },
    title: "Canva",
    description: "Bring a design you already made onto the sheet.",
  },
  {
    /**
     * After the two places artwork comes from, because it is the first thing
     * done to artwork once it is on the sheet.
     */
    id: "autofill",
    label: "Autofill",
    icon: { kind: "glyph", glyph: Grip },
    title: "Autofill",
    description: "Repeat the selected artwork across the sheet.",
  },
  {
    id: "layers",
    label: "Layers",
    icon: { kind: "glyph", glyph: Layers },
    title: "Layers",
    description: "Reorder, hide and lock everything on the sheet.",
  },
  {
    id: "preflight",
    label: "Checks",
    icon: { kind: "glyph", glyph: ShieldCheck },
    title: "Checks",
    description: "Overlapping artwork and resolution problems on this sheet.",
  },
  {
    /**
     * Last in the rail because it is the only contextual one: the others are
     * places you go, this one is about whatever is currently selected.
     */
    id: "settings",
    label: "Settings",
    icon: { kind: "glyph", glyph: SlidersHorizontal },
    title: "Settings",
    description: "Sheet setup, and the properties of anything you select.",
  },

  /* Reached from the selection's own menu — see `hidden`. */
  {
    id: "position",
    label: "Position",
    icon: { kind: "glyph", glyph: Layers },
    hidden: true,
    title: "Position",
    description: "Line the selection up with the sheet, and order the stack.",
  },
  {
    id: "filters",
    label: "Filters",
    icon: { kind: "glyph", glyph: SlidersHorizontal },
    hidden: true,
    title: "Filters",
    description: "A look for the selected artwork, and the dials behind it.",
  },
];

/** The entries the rail shows — everything not reached from the artwork itself. */
export const RAIL_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => !item.hidden);

/** Look up a nav entry by panel id. */
export const findNavItem = (id: PanelId): NavItem | undefined =>
  NAV_ITEMS.find((item) => item.id === id);
