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
import "./globals.css";

// `--font-sans` is what the Tailwind theme maps `font-sans` onto, so the font
// variable has to be named for the token rather than for the typeface.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

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
      <body className="flex min-h-full flex-col overflow-hidden">
        {children}
      </body>
    </html>
  );
}
