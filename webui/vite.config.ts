import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// The bundle is served by the adsb-setup Flask app from /static/spa/.
// scripts/cachebust.sh renames every static file to <name>.<md5>.<ext> and rewrites
// references in the Jinja templates by basename. For that to work the build must
// produce exactly one JS and one CSS file with stable, distinctive names and no
// lazily loaded chunks (chunk references inside JS would not be rewritten).
const outDir = resolve(import.meta.dirname, "../src/modules/adsb-feeder/filesystem/root/opt/adsb/adsb-setup/static/spa");

// The code is written against the React API but runs on Preact (through preact/compat):
// same components and hooks, but ~15 kB instead of ~200 kB of framework code to download,
// parse and run on every page - the feeders and the phones used to set them up are often slow.
const preactCompat = { react: "preact/compat", "react-dom": "preact/compat" };

export default defineConfig({
  base: "/static/spa/",
  plugins: [tailwindcss()],
  resolve: { alias: preactCompat },
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  build: {
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      input: resolve(import.meta.dirname, "src/main.tsx"),
      // lucide-react marks its modules "use client" (a React server components hint) - irrelevant here
      onwarn(warning, warn) {
        if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning);
      },
      output: {
        entryFileNames: "adsbim-ui.js",
        codeSplitting: false,
        assetFileNames: (asset) =>
          asset.names?.some((n) => n.endsWith(".css")) ? "adsbim-ui.css" : "[name][extname]",
      },
    },
  },
});
