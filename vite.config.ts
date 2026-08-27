import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  // Relative base so the same build works from a web host AND from
  // Capacitor's local file origin when we wrap this as a native app.
  base: "./",
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Smash Burger Tracker",
        short_name: "Smash",
        description: "Track, score, and rank the smash burgers you try.",
        theme_color: "#141210",
        background_color: "#141210",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
