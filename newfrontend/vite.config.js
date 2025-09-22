import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/landing.html"),
        home: resolve(__dirname, "src/home.html"),
        workspace: resolve(__dirname, "src/workspace.html"),
        analysis: resolve(__dirname, "src/analysis.html"),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  publicDir: "../public",
});
