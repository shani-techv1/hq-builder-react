import path from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

/**
 * Storefront embed build.
 *
 * Emits a self-contained ES-module bundle into
 * ../designer-shopifyApp/public/sheet-editor/, which the Shopify app serves at
 * `<app-url>/sheet-editor/index.js`. The app-proxy page at
 * /apps/designer/sheet-builder loads it with <script type="module">.
 *
 * Vite rather than Next because this is one client-side mount, not a site: the
 * app has no routes, no server actions and no `next/*` imports outside
 * src/app/, so a bundle is all the storefront needs. `npm run dev` and
 * `npm run build` still use Next for the standalone editor.
 *
 * Asset URLs resolve at *runtime* against `window.__SHEET_ASSET_BASE__` rather
 * than being baked in, because the page is served from the shop's domain while
 * the assets live on the app's — and in development that domain is a fresh
 * tunnel URL on every `shopify app dev`.
 */
export default defineConfig({
  // Tailwind v4 runs through its own Vite plugin here. The Next build uses
  // postcss.config.mjs; both compile the same src/app/globals.css.
  plugins: [tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // No @vitejs/plugin-react: it pulls in Babel, whose @babel/core conflicts
  // with the one shadcn depends on. Vite 8 compiles JSX itself, and Fast
  // Refresh — the only other thing the plugin would add — belongs to
  // `next dev`, which is still how this editor is developed.
  //
  // Off, or Vite copies Next's ./public (next.svg, vercel.svg …) in beside the
  // bundle. Those belong to the standalone app; the storefront serves only what
  // the entry actually imports.
  publicDir: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    /*
     * Next inlines NEXT_PUBLIC_* at build time; nothing here does. Defined as
     * `undefined` rather than left alone so the read cannot become a
     * `process is not defined` at runtime, and so it is obvious the storefront
     * gets this value from the page instead — see `__CANVA_API_URL__`, which
     * the app-proxy route injects per deployment. Baking it in here would tie
     * the bundle to whichever machine happened to build it.
     */
    "process.env.NEXT_PUBLIC_CANVA_API_URL": "undefined",
    // Same arrangement for the account service — see `__AUTH_API_URL__`.
    "process.env.NEXT_PUBLIC_AUTH_API_URL": "undefined",
  },
  experimental: {
    renderBuiltUrl(filename) {
      return {
        runtime: `(window.__SHEET_ASSET_BASE__ || "/sheet-editor/") + ${JSON.stringify(filename)}`,
      };
    },
  },
  build: {
    // Defaults to the Shopify app's own public/ so it serves the bundle itself.
    // Set SHEET_OUT_DIR to build it for a CDN instead; the app then points at
    // it via SHEET_ASSET_BASE and editor changes ship without redeploying.
    outDir:
      process.env.SHEET_OUT_DIR ?? "../designer-shopifyApp/public/sheet-editor",
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(__dirname, "src/embed.tsx"),
      output: {
        format: "es",
        entryFileNames: "index.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.names?.[0]?.endsWith(".css")
            ? "index.css"
            : "assets/[name]-[hash][extname]",
        // Fabric is the single largest dependency and nothing paints before it
        // loads anyway; splitting it keeps the entry chunk small enough to
        // parse quickly on a phone.
        manualChunks: (id) =>
          id.includes("node_modules/fabric") ? "fabric" : undefined,
      },
    },
  },
});
