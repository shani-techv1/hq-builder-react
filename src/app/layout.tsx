import type { Metadata } from "next";
import {
  Anton,
  Geist,
  Geist_Mono,
  Nunito,
  Oswald,
  Pacifico,
  Playfair_Display,
} from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

/*
 * Geist is artwork-only now.
 *
 * It used to publish itself as `--font-sans` — the token Tailwind maps
 * `font-sans` onto — which made it the interface typeface as a side effect.
 * The interface is set in Aktiv Grotesk, declared in globals.css, so this is
 * named for the typeface it actually is and stays available to the canvas.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/**
 * Adobe Fonts kit that serves Aktiv Grotesk, e.g.
 * `https://use.typekit.net/<kit>.css`.
 *
 * A kit rather than a self-hosted file because the family is licensed per
 * domain — the bytes cannot be committed here. Unset, the interface falls back
 * to the platform grotesk and everything else still works; the storefront embed
 * takes the same URL from the page instead, since it renders no `<head>` of its
 * own — see src/embed.tsx.
 */
const FONT_KIT_URL = process.env.NEXT_PUBLIC_FONT_KIT_URL;

/** The kit's host, for the preconnect. `null` for a value that isn't a URL. */
const FONT_KIT_ORIGIN = (() => {
  if (!FONT_KIT_URL) return null;
  try {
    return new URL(FONT_KIT_URL).origin;
  } catch {
    // A misconfigured value must not take the whole layout down with it.
    return null;
  }
})();

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
 * Typefaces the artwork can be set in — the interface itself never uses them.
 *
 * Self-hosted by `next/font` rather than linked, so there is no render-blocking
 * request to Google and no layout shift when a face lands. Weights are declared
 * to match what the picker offers; anything more would ship bytes nothing draws.
 */
const oswald = Oswald({
  variable: "--font-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const anton = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const nunito = Nunito({
  variable: "--font-rounded",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const pacifico = Pacifico({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

const ARTWORK_FONT_CLASSES = [oswald, anton, playfair, nunito, pacifico]
  .map((font) => font.variable)
  .join(" ");

/**
 * The families the canvas draws with, under names nothing else owns.
 *
 * Set inline, and deliberately not reusing `--font-sans` or `--font-serif`:
 * those are Tailwind theme keys, redeclared in `:root` further down the same
 * stylesheet. At equal specificity the later rule wins, so a font published on
 * one of those names resolves to Tailwind's generic stack instead of the real
 * face — and `--font-sans` is self-referential there, which computes to nothing
 * at all. Fabric resolves these by name at runtime, so they have to be exact.
 */
const ARTWORK_FONT_VARIABLES = {
  "--font-art-sans": geistSans.style.fontFamily,
  "--font-art-mono": geistMono.style.fontFamily,
  "--font-art-condensed": oswald.style.fontFamily,
  "--font-art-display": anton.style.fontFamily,
  "--font-art-serif": playfair.style.fontFamily,
  "--font-art-rounded": nunito.style.fontFamily,
  "--font-art-script": pacifico.style.fontFamily,
} as React.CSSProperties;

export const metadata: Metadata = {
  title: "Design Builder",
  description: "Design, arrange and order custom prints.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      style={ARTWORK_FONT_VARIABLES}
      className={`${geistSans.variable} ${geistMono.variable} ${ARTWORK_FONT_CLASSES} h-full antialiased`}
    >
      {/* Hoisted into the head by React rather than wrapped in one here, which
          is how this version of Next takes an external stylesheet. The kit is
          two hops — the CSS, then the faces it names — so the connection is
          opened alongside the first request rather than after it. */}
      {FONT_KIT_URL ? (
        <>
          {FONT_KIT_ORIGIN ? (
            <>
              <link rel="preconnect" href={FONT_KIT_ORIGIN} />
              <link
                rel="preconnect"
                href={FONT_KIT_ORIGIN}
                crossOrigin="anonymous"
              />
            </>
          ) : null}
          <link rel="stylesheet" href={FONT_KIT_URL} />
        </>
      ) : null}

      <body className="flex min-h-full flex-col overflow-hidden">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
