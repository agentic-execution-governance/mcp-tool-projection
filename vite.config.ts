import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "src/ui/app",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3847",
    },
  },
  build: {
    outDir: path.resolve("dist/ui-app"),
    emptyOutDir: true,
  },
});
