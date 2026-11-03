import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// Cloudflare Vite plugin: builds client SPA + Worker, generates output wrangler.json.
// See https://developers.cloudflare.com/workers/vite-plugin/
export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: { "@": "/src/client", "@shared": "/src/shared" },
  },
});
