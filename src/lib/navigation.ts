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
  | "settings";

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
];

/** Look up a nav entry by panel id. */
export const findNavItem = (id: PanelId): NavItem | undefined =>
  NAV_ITEMS.find((item) => item.id === id);
