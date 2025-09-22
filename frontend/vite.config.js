import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: resolve(__dirname, "src/landing.html"),
        home: resolve(__dirname, "src/home.html"),
        workspace: resolve(__dirname, "src/workspace.html"),
        analysis: resolve(__dirname, "src/analysis.html"),
      },
      output: {
        entryFileNames: "js/[name]-[hash].js",
        chunkFileNames: "js/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  publicDir: "../public",
  server: {
    port: 3000,
    open: true,
  },
});
